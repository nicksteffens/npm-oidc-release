module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow sentence-case for Dependabot commits (e.g., "Bump actions/checkout")
    'subject-case': [2, 'always', ['lower-case', 'sentence-case']],
  },
};
