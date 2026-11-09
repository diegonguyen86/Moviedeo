import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.history', 'stitch_xemnhanhlientay', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Cho phép catch (e) {} để nuốt lỗi có chủ đích (rất nhiều chỗ trong dự án dùng cách này)
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Serverless functions của Vercel chạy trên Node.js
    files: ['api/**/*.js', 'vite.config.js', 'tailwind.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Context files export cả Provider lẫn hook -> chỉ ảnh hưởng hot-reload lúc dev, không phải lỗi
    files: ['src/context/**/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
