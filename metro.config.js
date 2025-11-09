const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Wrap config with nativewind
module.exports = withNativeWind(config, { input: './global.css' });