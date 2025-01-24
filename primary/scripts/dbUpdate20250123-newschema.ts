import type { MatchScouting, OrgKey, OrgSchema, PitScouting, Schema, ScoutingPair, User } from 'scoutradioz-types';
import type { Utilities } from 'scoutradioz-utilities';
import type { AnyBulkWriteOperation, ObjectId } from 'mongodb';
import assert from 'assert';

process.env.TIER = 'dev';

const utilities: Utilities = require('scoutradioz-utilities');

utilities.config(require('../databases.json'), {
	cache: {
		enable: true,
		maxAge: 30
	},
	debug: true,
});

// @ts-ignore
utilities.refreshTier();

(async () => {
	const schemaArr: (Schema & { org_key?: OrgKey })[] = await utilities.aggregate('layout', [
		{
			'$sort': {
				'order': 1
			}
		}, {
			'$group': {
				'_id': {
					'org_key': '$org_key',
					'form_type': '$form_type',
					'year': '$year'
				},
				'items': {
					'$push': {
						'type': '$type',
						'id': '$id',
						'label': '$label',
						'operations': '$operations',
						'options': '$options'
					}
				}
			}
		}, {
			'$project': {
				'year': '$_id.year',
				'last_modified': '$$NOW',
				'created': '$$NOW',
				'form_type': '$_id.form_type',
				'items': 1,
				'name': '',
				'description': '',
				'published': {
					'$literal': false
				},
				'owners': [
					'$_id.org_key'
				],
				'_id': 0
			}
		}, {
			'$sort': {
				'owners': 1,
				'year': 1,
				'form_type': 1
			}
		}
	]);
	
	await utilities.remove('schemas', {});
	await utilities.remove('orgschemas', {});

	for (let schema of schemaArr) {
		
		for (let item of schema.items) {
			// @ts-ignore
			if (item.type === 'h2') item.type = 'header';
			// @ts-ignore
			if (item.type === 'h3') item.type = 'subheader';
			// @ts-ignore
			if (item.type === 'counter') {
				item.variant = 'standard';
			}
			// @ts-ignore
			if (item.type === 'badcounter') { item.type = 'counter'; item.variant = 'bad'; item.allow_negative = false; }
			// @ts-ignore
			if (item.type === 'counterallownegative') { item.type = 'counter'; item.variant = 'standard'; item.allow_negative = true; }
			if (item.type === 'slider') {
				item.variant = 'standard';
			}
			// @ts-ignore
			if (item.type === 'timeslider') { item.type = 'slider'; item.variant = 'time'; }
		}

		let writeResult = await utilities.insert('schemas', schema);
		console.log(writeResult);
		let schema_id = writeResult.insertedId;
		let orgSchema: OrgSchema = {
			org_key: schema.owners[0],
			year: schema.year,
			form_type: schema.form_type,
			schema_id,
		};
		writeResult = await utilities.insert('orgschemas', orgSchema);
		console.log(writeResult);
	}

	process.exit(0);
})();