import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FORK_SPLASH_BACKGROUND,
  FORK_SPLASH_LOGO_HEIGHT,
  FORK_SPLASH_LOGO_PIXELS,
  FORK_SPLASH_LOGO_WIDTH,
  selectLaunchArt,
} from "./splash";

const MOBILE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("selectLaunchArt", () => {
  it("uses the cream-on-terracotta mark for the fork in either appearance", () => {
    for (const colorScheme of ["light", "dark"] as const) {
      for (const platform of ["ios", "android"]) {
        expect(selectLaunchArt("fork", colorScheme, platform)).toEqual({
          background: FORK_SPLASH_BACKGROUND,
          logo: "fork",
          width: FORK_SPLASH_LOGO_WIDTH,
          height: FORK_SPLASH_LOGO_HEIGHT,
        });
      }
    }
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

describe("fork splash logo", () => {
  it("is a transparent png of the measured letter size", () => {
    const bytes = readFileSync(
      join(MOBILE_ROOT, "assets", "fork", "splash-logo.png"),
    );
    expect(bytes.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(bytes.readUInt32BE(16)).toBe(FORK_SPLASH_LOGO_PIXELS.width);
    expect(bytes.readUInt32BE(20)).toBe(FORK_SPLASH_LOGO_PIXELS.height);
    expect(bytes.readUInt8(25)).toBe(6);
  });
});
