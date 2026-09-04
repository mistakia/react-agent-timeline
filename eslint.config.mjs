import globals from 'globals'
import babelParser from '@babel/eslint-parser'
import neostandard from 'neostandard'
import react from 'eslint-plugin-react'

export default [
  {
    ignores: ['node_modules/**/*']
  },
  ...neostandard({
    noJsx: true
  }),
  {
    ...react.configs.flat.recommended,
    files: ['**/*.{js,mjs,jsx}']
  },
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: babelParser,
      ecmaVersion: 12,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
        requireConfigFile: false
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      camelcase: 'off',
      curly: 'off',
      // Prettier is the formatter of record here, and it writes `function f(` —
      // leaving this on would make `yarn prettier` and `yarn lint` disagree
      // permanently, which is what keeps a repo out of the prettier-clean
      // pre-commit set.
      '@stylistic/space-before-function-paren': 'off',
      '@stylistic/indent': 'off',
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/jsx-indent-props': 'off',
      '@stylistic/jsx-closing-bracket-location': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/quote-props': 'off',
      'react/jsx-indent': 'off'
    }
  },
  {
    files: ['test/**/*.{mjs,jsx}'],
    languageOptions: {
      globals: { ...globals.mocha, ...globals.node }
    }
  }
]
