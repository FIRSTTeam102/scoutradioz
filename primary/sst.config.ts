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
		const gitHash = process.env.HASH;
		console.log('Git commit hash:', gitHash);
		console.log('Stage:', $app.stage);
		if ($dev && $app.stage !== 'dev') {
			throw new Error('Dev mode only allowed on "dev" tier!');
		}
		// only enforce requirements when deploying
		if (!$dev) {
			if (!['prod', 'qa', 'test'].includes($app.stage))
				throw new Error('app.stage must be prod, qa, or test');
			if (!gitHash)
				throw new Error('git hash must be specified via an environment variable HASH=$(git rev-parse HEAD)');
		}

		// Use Router instead of ApiGatewayV2
		const subdomain = ($app.stage === 'prod') ? '' : `${$app.stage}-sst.`;
		const router = new sst.aws.Router('Router', {
			domain: `${subdomain}scoutradioz.com`,
			transform: {
				// https://www.pulumi.com/registry/packages/aws/api-docs/cloudfront/cachepolicy/#inputs
				// cachePolicy: {
				// 	defaultTtl: 30, // seconds
				// }
			}
		});

		const lambdaFunc = new sst.aws.Function('Primary', {
			handler: 'src/lambda.handler',
			runtime: 'nodejs22.x',
			architecture: 'arm64',
			timeout: '45 seconds',
			memory: '512 MB', // todo reduce if possible
			copyFiles: [
				{ from: 'views', to: 'views' },
				{ from: 'locales', to: 'locales' },
			],
			concurrency: {
				provisioned: 0, // always keep # instances warm - todo: 1 warm on prod, 0 on others, use env var
				reserved: 20
			},
			environment: {
				COLORIZE_LOGS: 'false',
				NODE_ENV: ($app.stage === 'prod' || $app.stage === 'qa') ? 'production' : 'development',
				TIER: $app.stage,
				ALIAS: $app.stage, // todo
				GIT_COMMIT_HASH: String(gitHash),
				STATICFILES_USE_S3: 'true',
				S3_BUCKET: String(process.env.S3_BUCKET),
				LOG_LEVEL: String(process.env.LOG_LEVEL),
				EMA_ALPHA: String(process.env.EMA_ALPHA),
			},
			nodejs: {
				install: ['pug'],
			},
			url: {
				router: {
					instance: router,
					path: '/'
				}
			}
		});

		return {
			lambdaFunc: lambdaFunc.name,
			url: router.url,
		};
	},

});