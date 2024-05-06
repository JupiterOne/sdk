module.exports = {
  hooks: {
    'pre-commit':
      'npm run j1-integration document && git add docs/jupiterone.md && lint-staged',
    'pre-push': 'npm run prepush',
  },
};
