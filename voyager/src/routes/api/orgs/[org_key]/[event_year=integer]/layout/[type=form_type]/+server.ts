import { validateUserOrg } from '$lib/server/api-utils';
import utilities from '$lib/server/utilities';
import type { LayoutField } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import httpAssert from '$lib/httpAssert';

export const GET: RequestHandler = async ({ params, locals }) => {
	validateUserOrg(locals, params.org_key);
	const form_type = (params.type + 'scouting') as 'pitscouting'|'matchscouting';
	
	// Get the current event for this org to find the event_key
	const org = await utilities.findOne('orgs', { org_key: params.org_key });
	httpAssert(org?.event_key, 404, `No current event set for org ${params.org_key}`);
	
	const orgschema = await utilities.findOne('orgschemas',
		{org_key: params.org_key, form_type, event_key: org.event_key},
		{},
		{ allowCache: true },
	);
	httpAssert(orgschema, 500, `Org schema not found, ${params.org_key}, ${org.event_key}`);
	const schema = await utilities.findOne('schemas',
		{_id: orgschema.schema_id},
		{},
		{allowCache: true},
	);
	httpAssert(schema, 500, `Schema not found, ${params.org_key}, ${params.event_year}`);

	return json({orgschema, schema});
};