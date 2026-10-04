const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The web app uses a newer React than this Expo SDK. npm keeps ours in apps/mobile/node_modules,
// but hoisted packages (react-native itself) would find the web's copy at the repo root.
// Two Reacts in one bundle crash at runtime, so every "react" import resolves from this app.
const fromThisApp = path.join(__dirname, "package.json");
const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return resolve({ ...context, originModulePath: fromThisApp }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
