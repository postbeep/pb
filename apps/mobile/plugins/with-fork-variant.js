const identity = require("../../../fork/identity.json");

const ICON = "./assets/fork/icon.png";
const ICON_DARK = "./assets/fork/icon-dark.png";
const SPLASH_IMAGE = "./assets/fork/splash-logo.png";
const SPLASH_IMAGE_DARK = "./assets/fork/splash-logo-dark.png";
const SPLASH_LOGO_WIDTH = 97;

function withForkSplash(plugins) {
  if (!Array.isArray(plugins)) return plugins;
  return plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-splash-screen") {
      return plugin;
    }
    const props = plugin[1] ?? {};
    return [
      plugin[0],
      {
        ...props,
        image: SPLASH_IMAGE,
        imageWidth: SPLASH_LOGO_WIDTH,
        dark: { ...props.dark, image: SPLASH_IMAGE_DARK },
      },
    ];
  });
}

module.exports = function withForkVariant(config) {
  const ios = { ...config.ios, icon: { light: ICON, dark: ICON_DARK } };
  delete ios.associatedDomains;
  const extra = { ...config.extra, bbMobileVariant: "fork" };
  delete extra.eas;
  return {
    ...config,
    name: identity.name,
    slug: identity.slug,
    scheme: identity.scheme,
    owner: identity.expo.owner ?? undefined,
    icon: ICON,
    plugins: withForkSplash(config.plugins),
    ios: {
      ...ios,
      bundleIdentifier: identity.bundleIdentifier,
      appleTeamId: identity.appleTeamId,
      infoPlist: {
        ...ios.infoPlist,
        UIBackgroundModes: [
          ...new Set([...(ios.infoPlist?.UIBackgroundModes ?? []), "audio"]),
        ],
      },
    },
    extra: identity.expo.projectId
      ? { ...extra, eas: { projectId: identity.expo.projectId } }
      : extra,
  };
};
