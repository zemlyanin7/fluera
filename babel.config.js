module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      ['module-resolver', { root: ['./'], alias: { '@': './src' } }],
      ['react-native-unistyles/plugin', { root: 'src', autoProcessImports: ['react-native-unistyles', '@/theme'] }],
      'react-native-reanimated/plugin',
    ],
  };
};
