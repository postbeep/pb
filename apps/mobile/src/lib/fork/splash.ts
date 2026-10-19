export const FORK_SPLASH_IMAGE = "./assets/fork/splash-logo.png";
export const FORK_SPLASH_IMAGE_DARK = "./assets/fork/splash-logo-dark.png";
export const FORK_SPLASH_LOGO_WIDTH = 97;
export const FORK_SPLASH_LOGO_PIXELS = { width: 639, height: 595 } as const;
export const FORK_SPLASH_LOGO_HEIGHT =
  (FORK_SPLASH_LOGO_WIDTH * FORK_SPLASH_LOGO_PIXELS.height) /
  FORK_SPLASH_LOGO_PIXELS.width;

const STOCK_LOGO_WIDTH = 88;
const STOCK_LOGO_HEIGHT = (STOCK_LOGO_WIDTH * 487) / 581;

export type LaunchLogo =
  | "production"
  | "production-dark"
  | "dev"
  | "fork"
  | "fork-dark";

export type LaunchArt<Logo> = {
  background: string;
  logo: Logo;
  width: number;
  height: number;
};

export function forkSplash<Logo>(
  colorScheme: string | null | undefined,
  platform: string,
  logos: { light: Logo; dark: Logo },
): LaunchArt<Logo> {
  const art = selectLaunchArt("fork", colorScheme, platform);
  return {
    background: art.background,
    logo: art.logo === "fork-dark" ? logos.dark : logos.light,
    width: art.width,
    height: art.height,
  };
}

function launchLogo(variant: string | undefined, dark: boolean): LaunchLogo {
  if (variant === "fork") return dark ? "fork-dark" : "fork";
  if (variant === "dev") return "dev";
  return dark ? "production-dark" : "production";
}

export function selectLaunchArt(
  variant: string | undefined,
  colorScheme: string | null | undefined,
  platform: string,
): LaunchArt<LaunchLogo> {
  const fork = variant === "fork";
  const dark = colorScheme === "dark";
  return {
    background: dark
      ? platform === "android"
        ? "#151515"
        : "#000000"
      : "#ffffff",
    logo: launchLogo(variant, dark),
    width: fork ? FORK_SPLASH_LOGO_WIDTH : STOCK_LOGO_WIDTH,
    height: fork ? FORK_SPLASH_LOGO_HEIGHT : STOCK_LOGO_HEIGHT,
  };
}
