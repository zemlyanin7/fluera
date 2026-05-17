const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Добавляем поддержку .csv расширения для asset bundler
config.resolver.assetExts = [...config.resolver.assetExts, 'csv'];

module.exports = config;
