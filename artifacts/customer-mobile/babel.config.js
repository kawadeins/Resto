module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 51) already includes the
    // react-native-reanimated plugin and expo-router support.
    presets: ["babel-preset-expo"],
  };
};
