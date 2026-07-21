import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/']
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      'complexity': ['warn', 10],
      'max-depth': ['warn', 3],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'no-warning-comments': [
        'warn',
        { terms: ['TODO', 'FIXME', 'HACK', 'XXX'], location: 'start' }
      ]
    }
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off'
    }
  },
  {
    files: ['*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' }
    }
  },
  eslintConfigPrettier
);
