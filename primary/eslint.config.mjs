import root from '../eslint.config.mjs';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
	{
		files: [
			'src/**/*.ts',
			'public-src/**/*.ts',
			'*.js'
		],
		ignores: [
			'**/lib/*',
			'bundle.js',
			'**/*.d.ts',
			'public/js/*',
			'eslint.config.mjs',
			'public/service-worker-v1.js',
		],
		rules: {
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-require-imports': 'off',
		},
		languageOptions: {
			globals: {
				...globals.serviceworker,
			},
			parserOptions: {
				// projectService: {
				// 	allowDefaultProject: ['*.mjs', 'public/service-worker-v1.js'],
				// },
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		extends: root,
	}
);