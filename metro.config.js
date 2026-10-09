const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow .txt files to be required as assets (for bundled Three.js source)
config.resolver.assetExts.push('txt');

module.exports = config;
