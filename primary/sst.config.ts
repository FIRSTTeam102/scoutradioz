/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: 'primary',
			removal: input?.stage === 'production' ? 'retain' : 'remove',
			protect: ['production'].includes(input?.stage),
			home: 'aws',
			providers: {
				aws: {
					region: 'us-east-1'
				}
			}
		};
	},
	async run() {
		const lambdaFunc = new sst.aws.Function('PrimaryFunction', {
			handler: 'src/lambda.handler',
			runtime: 'nodejs22.x',
			architecture: 'arm64',
			timeout: '45 seconds',
			memory: '1024 MB', // todo reduce if possible
			copyFiles: [
				{from: 'views', to: 'views'},
				{from: 'locales', to: 'locales'},
			],
			environment: {
				COLORIZE_LOGS: 'false',
				NODE_ENV: ($app.stage === 'prod' || $app.stage === 'qa') ? 'production' : 'development',
				S3_BUCKET: 'scoutradioz', // todo change later
				TIER: 'test',
				ALIAS: 'test', // todo
				STATICFILES_USE_S3: 'true',
			},
			nodejs: {
				install: ['pug'],
			},
		});
		const api = new sst.aws.ApiGatewayV2('PrimaryApi', {
			domain: 'sst.scoutradioz.com'
		});
		api.route('ANY /{proxy+}', lambdaFunc.arn);
		return {
			lambdaFunc: lambdaFunc.name,
			api: api.url,
		};
	},
});