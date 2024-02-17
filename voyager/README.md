Scoutradioz PWA built with [SvelteKit](https://kit.svelte.dev/) and [Material UI](https://sveltematerialui.com/)

## Development

1. Install dependencies with `npm install`
2. Make sure `.env` is populated with necessary environment variables for your system
3. Start a development server with `npm run dev`

## Production

- `npm i -g serverless` - Serverless is the CLI we used to create this cloudformation and using to update the lambda code
- `sls deploy function --function svelte` - update the function code
- `aws s3 rm s3://scoutradioz-voyager-static-assets --include "*" --recursive` - delete public files - they need to be deleted beforehand cuz there are random numbers appended to the public source code files that change each build
- `aws s3 sync build/assets s3://scoutradioz-voyager-static-assets --acl public-read` - re upload public files

## Notes

- `yarn sst dev` to run the SST stuff in dev mode. It'll ask you for a stage name based on your username, just accept whatever it suggests. Make sure not to deploy with that name, though.
- `yarn sst deploy --stage <stage>`, e.g. `yarn sst deploy --stage prod` to deploy
- `yarn preview` to preview a production build locally
