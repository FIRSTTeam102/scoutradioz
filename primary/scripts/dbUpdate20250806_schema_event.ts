import type { Utilities } from 'scoutradioz-utilities';
import type { Event, Org } from 'scoutradioz-types';
import type { ObjectId } from 'mongodb';

process.env.TIER = 'dev';

const utilities: Utilities = require('scoutradioz-utilities');

utilities.config(require('../databases.json'), {
	cache: {
		enable: true,
		maxAge: 30
	},
	debug: true,
});

utilities.refreshTier();

// Local types for orgschemas only to avoid dependency on changing external schema
interface OldOrgSchema {
	_id?: ObjectId;
	org_key: string;
	year: number;
	form_type: 'matchscouting' | 'pitscouting';
	schema_id: ObjectId;
}

interface NewOrgSchema {
	org_key: string;
	event_key: string;
	form_type: 'matchscouting' | 'pitscouting';
	schema_id: ObjectId;
}

(async () => {
	console.log('Starting migration to convert orgschemas from year-based to event-based...');
	
	// Get all current orgschemas
	const currentOrgSchemas: OldOrgSchema[] = await utilities.find('orgschemas', {});
	console.log(`Found ${currentOrgSchemas.length} existing orgschemas`);
	
	if (currentOrgSchemas.length === 0) {
		console.log('No orgschemas found to migrate');
		process.exit(0);
	}
	
	// Get all events to create a year -> events mapping
	const allEvents: Event[] = await utilities.find('events', {});
	const eventsByYear: { [year: number]: Event[] } = {};
	for (const event of allEvents) {
		if (!eventsByYear[event.year]) {
			eventsByYear[event.year] = [];
		}
		eventsByYear[event.year].push(event);
	}
	console.log(`Found events for years: ${Object.keys(eventsByYear).join(', ')}`);
	
	// For each orgschema, find all the events where it's being used
	const newOrgSchemas: NewOrgSchema[] = [];
	const schemasToRemove: OldOrgSchema[] = [];
	
	for (const orgSchema of currentOrgSchemas) {
		
		// Find events where this org has scouting data for this year
		let eventsWithData: string[] = [];
		
		if (orgSchema.form_type === 'matchscouting') {
			// Look for match scouting data
			const matchEvents = await utilities.distinct('matchscouting', 'event_key', {
				org_key: orgSchema.org_key,
				year: orgSchema.year
			});
			eventsWithData = eventsWithData.concat(matchEvents);
		}
		else if (orgSchema.form_type === 'pitscouting') {
			// Look for pit scouting data
			const pitEvents = await utilities.distinct('pitscouting', 'event_key', {
				org_key: orgSchema.org_key,
				year: orgSchema.year
			});
			eventsWithData = eventsWithData.concat(pitEvents);
		}
		
		// Remove duplicates
		eventsWithData = [...new Set(eventsWithData)];
		
		if (eventsWithData.length === 0) {
			// No data found - let's check if the org has an event_key set for this year
			const yearEvents = eventsByYear[orgSchema.year] || [];
			
			// Get the org's current event_key
			const org: Org | null = await utilities.findOne('orgs', { org_key: orgSchema.org_key });
			const orgCurrentEventKey = org?.event_key;
			
			if (orgCurrentEventKey) {
				// Check if the org's current event is in the correct year
				const orgCurrentEvent = yearEvents.find(event => event.key === orgCurrentEventKey);
				
				if (orgCurrentEvent) {
					// Create orgschema for the org's current event
					const newOrgSchema: NewOrgSchema = {
						org_key: orgSchema.org_key,
						event_key: orgCurrentEventKey,
						form_type: orgSchema.form_type,
						schema_id: orgSchema.schema_id
					};
					newOrgSchemas.push(newOrgSchema);
				}
				else {
					// Fallback: pick the first event in the year
					if (yearEvents.length > 0) {
						const fallbackEvent = yearEvents[0];
						const newOrgSchema: NewOrgSchema = {
							org_key: orgSchema.org_key,
							event_key: fallbackEvent.key,
							form_type: orgSchema.form_type,
							schema_id: orgSchema.schema_id
						};
						newOrgSchemas.push(newOrgSchema);
					}
				}
			}
			else if (yearEvents.length > 0) {
				// Org has no current event_key set, fallback to first event of the year
				const fallbackEvent = yearEvents[0];
				const newOrgSchema: NewOrgSchema = {
					org_key: orgSchema.org_key,
					event_key: fallbackEvent.key,
					form_type: orgSchema.form_type,
					schema_id: orgSchema.schema_id
				};
				newOrgSchemas.push(newOrgSchema);
			}
			else {
				console.log(`    No events found for year ${orgSchema.year}, skipping orgschema for ${orgSchema.org_key}`);
			}
		}
		else {
			// Create new orgschemas for each event where data was found
			for (const event_key of eventsWithData) {
				const newOrgSchema: NewOrgSchema = {
					org_key: orgSchema.org_key,
					event_key: event_key,
					form_type: orgSchema.form_type,
					schema_id: orgSchema.schema_id
				};
				newOrgSchemas.push(newOrgSchema);
			}
		}
		
		// Mark the old orgschema for removal
		schemasToRemove.push(orgSchema);
	}
	
	console.log('\nMigration plan:');
	console.log(`  - Remove ${schemasToRemove.length} old year-based orgschemas`);
	console.log(`  - Create ${newOrgSchemas.length} new event-based orgschemas`);
	
	// Perform the migration
	console.log('\nExecuting migration...');
	
	// Remove all old orgschemas
	const removeResult = await utilities.remove('orgschemas', {});
	console.log(`Removed ${removeResult.deletedCount} old orgschemas`);
	
	// Insert new event-based orgschemas
	if (newOrgSchemas.length > 0) {
		const insertResult = await utilities.insert('orgschemas', newOrgSchemas as any);
		console.log(`Inserted ${(insertResult?.insertedCount || newOrgSchemas.length)} new orgschemas`);
	}
	
	// Verification: Check that we can still find orgschemas
	const finalSchemas = await utilities.find('orgschemas', {});
	console.log(`Migration complete! Final orgschema count: ${finalSchemas.length}`);
	
	process.exit(0);
})();
