const identity = require("../../../fork/identity.json");

const ICON = "./assets/fork/icon.png";
const SPLASH_IMAGE = "./assets/fork/splash-logo.png";
const SPLASH_BACKGROUND = "#c2410c";
const SPLASH_LOGO_WIDTH = 120;

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
        backgroundColor: SPLASH_BACKGROUND,
        dark: {
          ...props.dark,
          image: SPLASH_IMAGE,
          backgroundColor: SPLASH_BACKGROUND,
        },
        android: {
          ...props.android,
          backgroundColor: SPLASH_BACKGROUND,
          dark: {
            ...props.android?.dark,
            backgroundColor: SPLASH_BACKGROUND,
          },
        },
      },
    ];
  });
}

module.exports = function withForkVariant(config) {
  const ios = { ...config.ios, icon: ICON };
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
