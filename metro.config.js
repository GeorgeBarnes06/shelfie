const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Bundle Shelfie's ingredient detector (assets/models/*.onnx) as an asset.
config.resolver.assetExts.push("onnx");

module.exports = withNativeWind(config, { input: "./global.css" });
