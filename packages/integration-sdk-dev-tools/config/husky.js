module.exports = {
  hooks: {
    'pre-commit':
      'yarn j1-integration document && git add docs/jupiterone.md && lint-staged',
    'pre-push': 'yarn prepush',
  },
};
