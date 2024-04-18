import { parseArgs } from 'util';
import { $ } from 'bun';

const s3Bucket = 'scoutradioz';

const { values, } = parseArgs({
	args: Bun.argv,
	options: {
		tier: {
			type: 'string'
		},
		folder: {
			type: 'string'
		},
	},
	strict: true,
	allowPositionals: true,
});

await $`aws s3 sync ${values.folder} s3://${s3Bucket}/${values.tier} --exclude "*.js" --acl public-read`;
await $`aws s3 sync ${values.folder} s3://${s3Bucket}/${values.tier} --include "*.js" --content-type "application/javascript" --acl public-read`;