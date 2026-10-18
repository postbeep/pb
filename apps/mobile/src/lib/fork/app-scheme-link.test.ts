import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeConstants {
  expoConfig: { scheme?: string | string[] } | null;
}

const constants = vi.hoisted((): FakeConstants => ({ expoConfig: {} }));

vi.mock("expo-constants", () => ({ default: constants }));

import { resolveShellIncomingLink } from "../shell/shell-links";
import { toBbSchemeLink, withAppScheme } from "./app-scheme-link";

const context = {
  profiles: [
    { id: "p_bee", serverUrl: "https://bee.getbb.app" },
    { id: "p_prefix", serverUrl: "https://box.example.ts.net/bb" },
  ],
  activeProfileId: "p_bee",
  developerRoutesEnabled: false,
};

const UPSTREAM_SCHEME_LINKS = [
  "bb://",
  "bb://threads/thr_1",
  "bb://connect?code=ABCD-EFGH",
  "bb://settings/servers/add",
  "bb://settings/device",
  "bb://settings/notifications",
  "bb://settings",
  "bb://settings/general",
  "bb://connections",
  "bb://dev/webview-spike",
];

function inPostbeepScheme(link: string): string {
  return link.replace(/^bb:/u, "postbeep:");
}

beforeEach(() => {
  constants.expoConfig = {};
});

describe("toBbSchemeLink", () => {
  it.each(UPSTREAM_SCHEME_LINKS)(
    "resolves the postbeep form of %s as the bb form",
    (link) => {
      const forked = inPostbeepScheme(link);
      const stock = resolveShellIncomingLink(link, context);
      expect(stock.kind).toBe("navigate");
      expect(resolveShellIncomingLink(forked, context)).toEqual({
        kind: "passthrough",
      });
      expect(
        resolveShellIncomingLink(toBbSchemeLink(forked, ["postbeep"]), context),
      ).toEqual(stock);
    },
  );

  it.each(["POSTBEEP://threads/thr_1", "PostBeep://threads/thr_1"])(
    "ignores letter case in %s",
    (link) => {
      expect(toBbSchemeLink(link, ["postbeep"])).toBe("bb://threads/thr_1");
    },
  );

  it("keeps the query and fragment", () => {
    expect(
      toBbSchemeLink(" postbeep:///settings/servers/?x=1#frag ", ["postbeep"]),
    ).toBe("bb:///settings/servers/?x=1#frag");
  });

  it.each([
    "https://bee.getbb.app/threads/x?a=1",
    "mailto:x@y.z",
    "",
    "postbeep:threads/thr_1",
    "postbeepx://threads/thr_1",
    "exp+postbeep://threads/thr_1",
    "bb://threads/thr_1",
    "BB://e2e/reset",
  ])("leaves %s unchanged", (url) => {
    expect(toBbSchemeLink(url, ["postbeep"])).toBe(url);
  });

  it("changes nothing when the app's scheme is bb or absent", () => {
    for (const url of [
      "postbeep://threads/thr_1",
      "bb://threads/thr_1",
      "BB://threads/thr_1",
      " bb://threads/thr_1 ",
    ]) {
      expect(toBbSchemeLink(url, ["bb"])).toBe(url);
      expect(toBbSchemeLink(url, [])).toBe(url);
    }
  });
});

describe("withAppScheme", () => {
  it("rewrites the scheme from the app config", () => {
    constants.expoConfig = { scheme: "postbeep" };
    expect(withAppScheme("postbeep://threads/thr_1")).toBe(
      "bb://threads/thr_1",
    );
  });

  it("accepts a list of schemes", () => {
    constants.expoConfig = { scheme: ["bb", "postbeep"] };
    expect(withAppScheme("postbeep://threads/thr_1")).toBe(
      "bb://threads/thr_1",
    );
    expect(withAppScheme("bb://threads/thr_1")).toBe("bb://threads/thr_1");
  });

  it("leaves links alone in the stock app and without a config", () => {
    constants.expoConfig = { scheme: "bb" };
    expect(withAppScheme("postbeep://threads/thr_1")).toBe(
      "postbeep://threads/thr_1",
    );
    constants.expoConfig = null;
    expect(withAppScheme("postbeep://threads/thr_1")).toBe(
      "postbeep://threads/thr_1",
    );
  });
});
