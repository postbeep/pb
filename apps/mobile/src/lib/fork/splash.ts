export const FORK_SPLASH_BACKGROUND = "#c2410c";
export const FORK_SPLASH_IMAGE = "./assets/fork/splash-logo.png";
export const FORK_SPLASH_LOGO_WIDTH = 120;
export const FORK_SPLASH_LOGO_PIXELS = { width: 548, height: 461 } as const;
export const FORK_SPLASH_LOGO_HEIGHT =
  (FORK_SPLASH_LOGO_WIDTH * FORK_SPLASH_LOGO_PIXELS.height) /
  FORK_SPLASH_LOGO_PIXELS.width;

const STOCK_LOGO_WIDTH = 88;
const STOCK_LOGO_HEIGHT = (STOCK_LOGO_WIDTH * 487) / 581;

export type LaunchLogo = "production" | "production-dark" | "dev" | "fork";

export function forkSplash<Logo>(logo: Logo): {
  background: string;
  logo: Logo;
  width: number;
  height: number;
} {
  const art = selectLaunchArt("fork", "light", "ios");
  return {
    background: art.background,
    logo,
    width: art.width,
    height: art.height,
  };
}

export function selectLaunchArt(
  variant: string | undefined,
  colorScheme: string | null | undefined,
  platform: string,
): {
  background: string;
  logo: LaunchLogo;
  width: number;
  height: number;
} {
  if (variant === "fork") {
    return {
      background: FORK_SPLASH_BACKGROUND,
      logo: "fork",
      width: FORK_SPLASH_LOGO_WIDTH,
      height: FORK_SPLASH_LOGO_HEIGHT,
    };
  }
  const width = STOCK_LOGO_WIDTH;
  const height = STOCK_LOGO_HEIGHT;
  if (colorScheme === "dark") {
    return {
      background: platform === "android" ? "#151515" : "#000000",
      logo: variant === "dev" ? "dev" : "production-dark",
      width,
      height,
    };
  }
  return {
    background: "#ffffff",
    logo: variant === "dev" ? "dev" : "production",
    width,
    height,
  };
}
