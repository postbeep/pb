const identity = require("../../../fork/identity.json");

const ICON = "./assets/fork/icon.png";

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
    ios: {
      ...ios,
      bundleIdentifier: identity.bundleIdentifier,
      appleTeamId: identity.appleTeamId,
    },
    extra: identity.expo.projectId
      ? { ...extra, eas: { projectId: identity.expo.projectId } }
      : extra,
  };
};
