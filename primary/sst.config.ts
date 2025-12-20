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

		let domain;
		if ($app.stage === 'prod') {
			domain = {
				name: 'scoutradioz.com',
				redirects: ['www.scoutradioz.com'],
			};
		}
		else {
			domain = `${$app.stage}.scoutradioz.com`;
		}
		// Use Router instead of ApiGatewayV2
		const router = new sst.aws.Router('Router', {
			domain,
			transform: {
				// https://www.pulumi.com/registry/packages/aws/api-docs/cloudfront/cachepolicy/#inputs
				// cachePolicy: {
				// 	defaultTtl: 30, // seconds
				// }
			}
		});
		
		const publicFiles = new sst.aws.StaticSite('Public', {
			path: 'public',
			router: {
				instance: router,
				path: '/public'
			}
		});

		let copyFiles;
		if ($dev) {
			copyFiles = [
				{ from: 'views', to: 'views' },
				{ from: 'locales', to: 'locales' },
				{ from: 'public', to: 'public' },
			];
		}
		else {
			copyFiles = [
				{ from: 'views', to: 'views' },
				{ from: 'locales', to: 'locales' },
			];
		}

		const lambdaFunc = new sst.aws.Function('Primary', {
			handler: 'src/lambda.handler',
			runtime: 'nodejs22.x',
			architecture: 'arm64',
			timeout: '45 seconds',
			memory: '512 MB', // todo reduce if possible
			copyFiles,
			concurrency: {
				provisioned: Number(process.env.PROVISIONED_CONCURRENCY) || 0, // always keep # instances warm (note: could turn quite expensive)
				reserved: Number(process.env.RESERVED_CONCURRENCY) || 1
			},
			environment: {
				COLORIZE_LOGS: String(process.env.COLORIZE_LOGS),
				NODE_ENV: String(process.env.NODE_ENV),
				TIER: $app.stage,
				ALIAS: $app.stage, // todo
				GIT_COMMIT_HASH: String(gitHash),
				UPLOAD_URL: String(process.env.UPLOAD_URL),
				S3_BUCKET: String(process.env.S3_BUCKET), // not needed for public files, but needed for image uploads
				LOG_LEVEL: String(process.env.LOG_LEVEL),
				EMA_ALPHA: String(process.env.EMA_ALPHA),
				AUTH0_SECRET: String(process.env.AUTH0_SECRET),
				AUTH0_CLIENTID: String(process.env.AUTH0_CLIENTID),
				LAMBDA_PUBLISH_DATE: new Date().toISOString().replace(/\D/g, ''), // PJL note: SST sets function version to $LATEST, so we can work around this where we need func. version by using a timestamp
			},
			nodejs: {
				install: ['pug'],
			},
			url: {
				router: {
					instance: router,
					path: '/'
				}
			},
			versioning: true,
		});

		return {
			lambdaFunc: lambdaFunc.name,
			publicFiles: publicFiles.url,
			url: router.url,
		};
	},

});