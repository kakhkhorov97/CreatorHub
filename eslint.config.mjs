import eslint from '@eslint/js';
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default [
	{ ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.local/**', '**/._*'] },
	{
		files: ['apps/**/*.ts'],
		languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
		plugins: { '@typescript-eslint': plugin },
		rules: {
			...eslint.configs.recommended.rules,
			...plugin.configs.recommended.rules,
			...prettier.rules,
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
	{ files: ['apps/**/test/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
];
