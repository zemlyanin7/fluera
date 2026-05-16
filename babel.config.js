module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // WatermelonDB модели используют legacy decorators (@field, @date, @children).
      // Должен идти ПЕРЕД TypeScript-плагином (TS plugin живёт внутри babel-preset-expo).
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['module-resolver', { root: ['./'], alias: { '@': './src' } }],
      ['react-native-unistyles/plugin', {
        root: 'src',
        autoProcessImports: ['react-native-unistyles', '@/theme'],
      }],
      // reanimated/plugin ОБЯЗАН быть последним.
      'react-native-reanimated/plugin',
    ],
  };
};
