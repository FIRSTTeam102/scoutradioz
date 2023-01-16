Scoutradioz PWA built with [SvelteKit](https://kit.svelte.dev/) and [Material UI](https://sveltematerialui.com/)

## Development

1. Install dependencies with `npm install`
2. Make sure `.env` is populated with necessary environment variables for your system
3. Start a development server with `npm run dev`

## Production

- `npm i -g serverless` - Serverless is the CLI we used to create this cloudformation and using to update the lambda code
- `sls deploy function --function svelte` - update the function code
- `aws s3 rm s3://scoutradioz-offline-static-assets --include "*" --recursive` - delete public files - they need to be deleted beforehand cuz there are random numbers appended to the public source code files that change each build
- `aws s3 sync build/assets s3://scoutradioz-offline-static-assets --acl public-read` - re upload public files