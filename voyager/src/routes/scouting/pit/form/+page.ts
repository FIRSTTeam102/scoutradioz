import { SchemaOperations } from '$lib/DBOperations';
import db from '$lib/localDB';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, parent }) => {
	const { event_key, org_key, event } = await parent();

	const team_key = url.searchParams.get('key');
	const teamNumber = Number(team_key?.replace('frc', ''));

	if (!team_key || !teamNumber) throw error(404, new Error('Team key is either not defined or invalid'));
	if (!event) throw error(404, new Error('Event not found'));

	const { layout } = await SchemaOperations.getSchemaForOrgAndEvent(org_key, event_key, 'pitscouting')

	const pitScoutingEntry = await db.pitscouting
		.where({
			org_key,
			event_key,
			team_key
		})
		.first();

	if (!pitScoutingEntry)
		throw error(404, new Error(`Pit scouting assignment not found for key ${team_key} at event ${event_key}`));

	const team = await db.teams
		.where({
			key: team_key
		})
		.first();

	if (!team) throw error(404, new Error(`Team ${team_key} not found`));
	
	const upload = await db.uploads.where({org_key, year: event.year}).filter(item => item.team_key === team_key && item.index === 0).first();
	let robotPhoto: string|undefined;
	if (upload) {
		let blobs = await db.images.where({s3_key: upload.s3_key}).first();
		if (blobs) robotPhoto = URL.createObjectURL(blobs.md);
	}

	return { layout, key: team_key, teamNumber, pitScoutingEntry, team, robotPhoto };
};
