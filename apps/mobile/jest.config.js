const path = require("path");

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo/ios",
  // A screen test's first render loads React Native's test renderer, which takes over 5 s (Jest's default) on
  // CI's 2-core machines. The limit only stops a test that hangs; it doesn't change what any test checks.
  testTimeout: 20_000,
  // Same reason as metro.config.js: tests must use this app's React, not the web's.
  moduleNameMapper: {
    "^react$": path.join(__dirname, "node_modules/react"),
    "^react/(.*)$": path.join(__dirname, "node_modules/react/$1"),
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|@retrofit/.*)",
  ],
};
