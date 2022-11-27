function buildBabelConfig () {
  return (api) => {
    api.cache(true);

    return {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: '18'
            },
          },
        ],
        ['@babel/preset-typescript', {}],
      ],
    }
  };
};

module.exports = buildBabelConfig();
