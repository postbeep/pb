import {
  buildBridgeInjectionScript,
  type NativeShellApi,
  type NativeShellHandshake,
} from "@bb/mobile-bridge";
import { describe, expect, it } from "vitest";
import { FORK_MARKER, withForkMarker } from "./fork-marker";

const handshake: NativeShellHandshake = {
  bridgeVersion: 2,
  appVersion: "0.39.0",
  platform: "ios",
  profileMode: "direct",
  secureContext: true,
  safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  capabilities: [
    "haptic",
    "badge",
    "share",
    "open-external",
    "safe-area",
    "open-native",
  ],
};

interface FakeWindow {
  location: { href: string };
  ReactNativeWebView: { postMessage(raw: string): void };
  bb?: { native?: NativeShellApi };
  bbFork?: unknown;
}

function createWindow(): FakeWindow {
  return {
    location: { href: "https://test/threads/one" },
    ReactNativeWebView: { postMessage: () => undefined },
  };
}

function run(fakeWindow: FakeWindow, script: string): void {
  new Function("window", script)(fakeWindow);
}

describe("withForkMarker", () => {
  it("defines a frozen, read-only window.bbFork", () => {
    const fakeWindow = createWindow();
    run(fakeWindow, withForkMarker(""));
    expect(fakeWindow.bbFork).toEqual({ backgroundAudio: true, version: 1 });
    expect(Object.isFrozen(fakeWindow.bbFork)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(fakeWindow, "bbFork")).toMatchObject(
      { writable: false, configurable: false, enumerable: false },
    );
    expect(() => {
      fakeWindow.bbFork = { backgroundAudio: false };
    }).toThrow(TypeError);
    expect(fakeWindow.bbFork).toEqual(FORK_MARKER);
  });

  it("keeps the stock bridge and its handshake", () => {
    const stock = createWindow();
    run(stock, buildBridgeInjectionScript(handshake));
    const fork = createWindow();
    run(fork, withForkMarker(buildBridgeInjectionScript(handshake)));
    const native = fork.bb?.native;
    expect(native).toBeDefined();
    expect({
      bridgeVersion: native?.bridgeVersion,
      capabilities: native?.capabilities,
    }).toEqual({
      bridgeVersion: stock.bb?.native?.bridgeVersion,
      capabilities: stock.bb?.native?.capabilities,
    });
    expect(fork.bbFork).toEqual(FORK_MARKER);
    expect(stock.bbFork).toBeUndefined();
  });

  it("leaves the marker in place when the script runs again", () => {
    const fakeWindow = createWindow();
    const script = withForkMarker(buildBridgeInjectionScript(handshake));
    run(fakeWindow, script);
    const marker = fakeWindow.bbFork;
    expect(() => run(fakeWindow, script)).not.toThrow();
    expect(fakeWindow.bbFork).toBe(marker);
  });
});
