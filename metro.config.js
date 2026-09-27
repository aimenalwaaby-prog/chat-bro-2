const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  // Keep it disabled for production/CI exports: Metro can race the generated
  // node_modules/react-native-css-interop/.cache/web.css file on Render.
  forceWriteFileSystem: false,
});
