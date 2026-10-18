import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = join(HERE, "..", "..", "..");
const REPO_ROOT = join(MOBILE_ROOT, "..", "..");
const requireFromHere = createRequire(import.meta.url);

const identitySchema = z.object({
  name: z.string(),
  slug: z.string(),
  scheme: z.string(),
  bundleIdentifier: z.string(),
  appleTeamId: z.string(),
  expo: z.object({
    owner: z.string().nullable(),
    projectId: z.string().nullable(),
  }),
});

const resolvedConfigSchema = z.object({
  name: z.string(),
  slug: z.string(),
  scheme: z.string(),
  owner: z.string().optional(),
  icon: z.string(),
  ios: z.object({
    bundleIdentifier: z.string(),
    appleTeamId: z.string().optional(),
    icon: z.union([
      z.string(),
      z.object({ light: z.string(), dark: z.string() }),
    ]),
    associatedDomains: z.array(z.string()).optional(),
    infoPlist: z.object({ UIBackgroundModes: z.array(z.string()) }),
  }),
  extra: z.object({
    bbMobileVariant: z.string(),
    eas: z.object({ projectId: z.string() }).optional(),
  }),
});

type ResolvedConfig = z.infer<typeof resolvedConfigSchema>;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const COLOR_TYPES_WITH_ALPHA = new Set([4, 6]);

function readIdentity(): z.infer<typeof identitySchema> {
  const raw: unknown = JSON.parse(
    readFileSync(join(REPO_ROOT, "fork", "identity.json"), "utf8"),
  );
  return identitySchema.parse(raw);
}

function resolveConfig(variant: string | undefined): ResolvedConfig {
  const configure = requireFromHere(
    join(MOBILE_ROOT, "app.config.js"),
  ) as (input: { config: unknown }) => unknown;
  const appJson = z
    .object({ expo: z.record(z.string(), z.unknown()) })
    .parse(JSON.parse(readFileSync(join(MOBILE_ROOT, "app.json"), "utf8")));
  const previous = process.env.BB_MOBILE_VARIANT;
  if (variant === undefined) delete process.env.BB_MOBILE_VARIANT;
  else process.env.BB_MOBILE_VARIANT = variant;
  try {
    return resolvedConfigSchema.parse(configure({ config: appJson.expo }));
  } finally {
    if (previous === undefined) delete process.env.BB_MOBILE_VARIANT;
    else process.env.BB_MOBILE_VARIANT = previous;
  }
}

function readPngHeader(relativePath: string): {
  width: number;
  height: number;
  colorType: number;
} {
  const bytes = readFileSync(join(MOBILE_ROOT, relativePath));
  expect(bytes.subarray(0, 8), `${relativePath} is not a PNG`).toEqual(
    PNG_SIGNATURE,
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

describe("fork app variant", () => {
  it("builds Postbeep's identity from fork/identity.json", () => {
    const identity = readIdentity();
    const config = resolveConfig("fork");
    expect({
      name: config.name,
      slug: config.slug,
      scheme: config.scheme,
      bundleIdentifier: config.ios.bundleIdentifier,
      appleTeamId: config.ios.appleTeamId,
      variant: config.extra.bbMobileVariant,
    }).toEqual({
      name: identity.name,
      slug: identity.slug,
      scheme: identity.scheme,
      bundleIdentifier: identity.bundleIdentifier,
      appleTeamId: identity.appleTeamId,
      variant: "fork",
    });
  });

  it("drops bb's universal links, Expo owner, and Expo project", () => {
    const identity = readIdentity();
    const production = resolveConfig(undefined);
    const fork = resolveConfig("fork");
    expect(fork.ios.associatedDomains).toBeUndefined();
    expect(fork.owner).toBe(identity.expo.owner ?? undefined);
    expect(fork.owner).not.toBe(production.owner);
    expect(fork.extra.eas?.projectId).toBe(
      identity.expo.projectId ?? undefined,
    );
    expect(fork.extra.eas?.projectId).not.toBe(production.extra.eas?.projectId);
    expect(fork.ios.bundleIdentifier).not.toBe(production.ios.bundleIdentifier);
    expect(fork.scheme).not.toBe(production.scheme);
  });

  it("uses its own opaque 1024x1024 icon", () => {
    const production = resolveConfig(undefined);
    const fork = resolveConfig("fork");
    expect(fork.ios.icon).toBe(fork.icon);
    expect(fork.icon).not.toBe(production.icon);
    const { width, height, colorType } = readPngHeader(fork.icon);
    expect({ width, height }).toEqual({ width: 1024, height: 1024 });
    expect(COLOR_TYPES_WITH_ALPHA.has(colorType)).toBe(false);
  });

  it("leaves the production and dev variants as upstream ships them", () => {
    const production = resolveConfig("production");
    const dev = resolveConfig("dev");
    expect(resolveConfig(undefined)).toEqual(production);
    expect({
      name: production.name,
      scheme: production.scheme,
      owner: production.owner,
      bundleIdentifier: production.ios.bundleIdentifier,
      associatedDomains: production.ios.associatedDomains,
      backgroundModes: production.ios.infoPlist.UIBackgroundModes,
      variant: production.extra.bbMobileVariant,
    }).toEqual({
      name: "bb",
      scheme: "bb",
      owner: "bb-team",
      bundleIdentifier: "app.getbb.mobile",
      associatedDomains: ["applinks:getbb.app", "applinks:*.getbb.app"],
      backgroundModes: ["remote-notification"],
      variant: "production",
    });
    expect({
      name: dev.name,
      bundleIdentifier: dev.ios.bundleIdentifier,
      variant: dev.extra.bbMobileVariant,
    }).toEqual({
      name: "bb dev",
      bundleIdentifier: "app.getbb.mobile",
      variant: "dev",
    });
  });

  it("still rejects an unknown variant", () => {
    expect(() => resolveConfig("staging")).toThrow(
      "BB_MOBILE_VARIANT must be production or dev",
    );
  });
});
