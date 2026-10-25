// Metro uses this preset by default. Jest needs it written down to find it.
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
