import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FORK_SPLASH_LOGO_HEIGHT,
  FORK_SPLASH_LOGO_PIXELS,
  FORK_SPLASH_LOGO_WIDTH,
  forkSplash,
  selectLaunchArt,
} from "./splash";

const MOBILE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_RGBA = 6;

const forkSize = {
  width: FORK_SPLASH_LOGO_WIDTH,
  height: FORK_SPLASH_LOGO_HEIGHT,
};

describe("selectLaunchArt", () => {
  it("shows the fork's light mark on white in the light appearance", () => {
    for (const colorScheme of ["light", null, undefined]) {
      for (const platform of ["ios", "android"]) {
        expect(selectLaunchArt("fork", colorScheme, platform)).toEqual({
          background: "#ffffff",
          logo: "fork",
          ...forkSize,
        });
      }
    }
  });

  it("shows the fork's dark mark on the stock dark fields", () => {
    expect(selectLaunchArt("fork", "dark", "ios")).toEqual({
      background: "#000000",
      logo: "fork-dark",
      ...forkSize,
    });
    expect(selectLaunchArt("fork", "dark", "android")).toEqual({
      background: "#151515",
      logo: "fork-dark",
      ...forkSize,
    });
  });

  it("leaves the stock splash art unchanged", () => {
    expect(selectLaunchArt("production", "light", "ios")).toEqual({
      background: "#ffffff",
      logo: "production",
      width: 88,
      height: (88 * 487) / 581,
    });
    expect(selectLaunchArt(undefined, "dark", "ios").logo).toBe(
      "production-dark",
    );
    expect(selectLaunchArt("production", "dark", "ios").background).toBe(
      "#000000",
    );
    expect(selectLaunchArt("production", "dark", "android").background).toBe(
      "#151515",
    );
    expect(selectLaunchArt("dev", "light", "ios").logo).toBe("dev");
    expect(selectLaunchArt("dev", "dark", "ios")).toMatchObject({
      background: "#000000",
      logo: "dev",
    });
  });
});

describe("forkSplash", () => {
  const logos = { light: "light.png", dark: "dark.png" };

  it("hands back the logo for the appearance with its field and size", () => {
    expect(forkSplash("light", "ios", logos)).toEqual({
      background: "#ffffff",
      logo: "light.png",
      ...forkSize,
    });
    expect(forkSplash("dark", "ios", logos)).toEqual({
      background: "#000000",
      logo: "dark.png",
      ...forkSize,
    });
    expect(forkSplash("dark", "android", logos)).toEqual({
      background: "#151515",
      logo: "dark.png",
      ...forkSize,
    });
    expect(forkSplash(null, "android", logos).logo).toBe("light.png");
  });
});

describe("fork splash logos", () => {
  it("are transparent pngs of the measured mark size", () => {
    for (const file of ["splash-logo.png", "splash-logo-dark.png"]) {
      const bytes = readFileSync(join(MOBILE_ROOT, "assets", "fork", file));
      expect(bytes.subarray(0, 8), file).toEqual(PNG_SIGNATURE);
      expect(
        { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
        file,
      ).toEqual(FORK_SPLASH_LOGO_PIXELS);
      expect(bytes.readUInt8(25), file).toBe(PNG_RGBA);
    }
  });

  it("show at the stock mark's scale: bb's 581 px logo is 88 points wide", () => {
    expect(FORK_SPLASH_LOGO_WIDTH).toBe(
      Math.round((88 * FORK_SPLASH_LOGO_PIXELS.width) / 581),
    );
  });
});
