const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /.*expo-updates_tmp_.*/,
];

module.exports = config;
