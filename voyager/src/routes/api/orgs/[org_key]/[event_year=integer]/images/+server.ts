import { validateUserOrg } from '$lib/server/api-utils';
import utilities from '$lib/server/utilities';
import type { LayoutField } from '$lib/types';
import { json, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import httpAssert from '$lib/httpAssert';
import * as helpers from 'scoutradioz-helpers';
import { S3_BUCKET } from '$env/static/private';

if (!S3_BUCKET) throw new Error('Put S3_BUCKET in your .env file');
process.env.S3_BUCKET = S3_BUCKET; // make it accessible to uploadhelper
// @ts-ignore
const uploadHelper = helpers.default.upload;
uploadHelper.config(utilities);

export const GET: RequestHandler = async ({ params, locals }) => {
	validateUserOrg(locals, params.org_key);

	const year = parseInt(params.event_year);
	const uploadsWithLinks = await uploadHelper.findImagesForYear(params.org_key, year);
	return json(uploadsWithLinks);
};