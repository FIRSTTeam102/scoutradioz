import type { SSTConfig } from 'sst';
import { SvelteKitSite } from 'sst/constructs';

export default {
	config(_input) {
		return {
			name: 'voyager-sst',
			region: 'us-east-1',
		};
	},
	stacks(app) {
		app.stack(function Site({ stack }) {

			let domainName =
			stack.stage === 'prod' ? 'voyager.scoutradioz.com'
				: `${stack.stage}.voyager.scoutradioz.com`;

			const site = new SvelteKitSite(stack, 'site', {
				customDomain: {
					domainName,
					hostedZone: 'scoutradioz.com',
				},
				environment: {
					TIER: stack.stage,
				},
				assets: {
					fileOptions: [
						{
							files: '**\/*.wasm',
							contentType: 'application/wasm',
						}
					]
				},
				nodejs: {
					loader: {
						'.node': 'copy',
					},
				},
			});
			stack.addOutputs({
				url: site.url,
			});
		});
	},
} satisfies SSTConfig;
