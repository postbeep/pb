import Constants from "expo-constants";

const BB_SCHEME = "bb";

const SCHEME_LINK_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/iu;

export function toBbSchemeLink(
  url: string,
  appSchemes: readonly string[],
): string {
  const match = SCHEME_LINK_PATTERN.exec(url.trim());
  if (!match) return url;
  const [, scheme, rest] = match;
  if (scheme === undefined || rest === undefined) return url;
  const lowerScheme = scheme.toLowerCase();
  if (lowerScheme === BB_SCHEME) return url;
  const isAppScheme = appSchemes.some(
    (appScheme) => appScheme.toLowerCase() === lowerScheme,
  );
  return isAppScheme ? `${BB_SCHEME}://${rest}` : url;
}

function configuredAppSchemes(): readonly string[] {
  const scheme = Constants.expoConfig?.scheme;
  if (scheme === undefined) return [];
  return typeof scheme === "string" ? [scheme] : scheme;
}

export function withAppScheme(url: string): string {
  return toBbSchemeLink(url, configuredAppSchemes());
}
