import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import scoutradiozplugin from 'eslint-plugin-scoutradioz-eslint';
import globals from 'globals';

export default tseslint.config(
	eslint.configs.recommended,
	tseslint.configs.recommended,
	{
		ignores: [
			'**/node_modules/**',
			'*/build/*',
			'*/types/*',
			'**/.*',
			'**/lib/**',
			'**/.sst/**',
		],
		plugins: { 'scoutradioz-eslint': scoutradiozplugin },
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.commonjs,
			},
			parserOptions: {
				ecmaVersion: 'latest',
			},
			ecmaVersion: 2020,
		},
		rules: 
			{
				'brace-style': [ 'error', 'stroustrup', { allowSingleLine: true, } ],
				quotes: ['error', 'single'],
				indent: ['error', 'tab', {SwitchCase: 1}],
				semi: ['error', 'always'],
				'global-require': 'error',
				'no-new-require': 'error',
				'no-mixed-requires': 'error',
				'no-prototype-builtins': 'off',
				'scoutradioz-eslint/res-render-require-title': 'error',
				'prefer-const': 'off',
				'no-unused-vars': 'off', // Must be turned off because typescript-eslint/no-unused-vars supecedes this
				'@typescript-eslint/no-explicit-any': 'off',
				'@typescript-eslint/no-unused-vars': ['warn', {args: 'none'}],
				'@typescript-eslint/no-var-requires': 'off',
				'@typescript-eslint/no-namespace': 'off',
				'@typescript-eslint/ban-ts-comment': 'warn',
				'@typescript-eslint/consistent-type-imports': ['warn', {
					prefer: 'type-imports',
					disallowTypeAnnotations: true,
					fixStyle: 'separate-type-imports'
				}]
			}
		
	}
);