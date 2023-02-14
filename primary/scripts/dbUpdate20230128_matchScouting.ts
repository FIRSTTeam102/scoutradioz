import { User } from '@firstteam102/scoutradioz-types';
import type { Utilities } from '@firstteam102/scoutradioz-utilities';
import type { AnyBulkWriteOperation } from 'mongodb';

process.env.TIER = 'dev';

const utilities: Utilities = require('@firstteam102/scoutradioz-utilities');
const ObjectId = require('mongodb').ObjectId;

const readline = require('readline');

utilities.config(require('../databases.json'), {
	cache: {
		enable: true,
		maxAge: 30
	},
	debug: true,
});

// @ts-ignore
utilities.refreshTier();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function prompt(question) {
	return new Promise((resolve, reject) => {
		rl.question(question + ' [y/N]: ', answer => {
			if (answer.toLowerCase().startsWith('y')) resolve(true);
			else resolve(false);
		});
	});
}

(async () => {
	
	// Get the ids of default users for each org
	const defaultUsers = await utilities.find('users', {name: 'default_user', visible: false});
	
	const deletedUsersMap = {};
	for (let user of defaultUsers) {
		deletedUsersMap[user.org_key] = {
			_id: user._id,
			name: '(Deleted)',
		};
	}
	
	const matchscouting = await utilities.find('matchscouting', {$or: [{assigned_scorer: {$type: 'string'}}, {actual_scorer: {$type: 'string'}}]});
	
	let bulkWriteOps: AnyBulkWriteOperation[] = [];
	
	for (let match of matchscouting) {
		let assigned_scorer = (await utilities.findOne('users', {name: match.assigned_scorer})) || deletedUsersMap[match.org_key];
		let actual_scorer = (await utilities.findOne('users', {name: match.actual_scorer})) || deletedUsersMap[match.org_key];
		// update assigned scorer
		if (match.assigned_scorer && assigned_scorer) {
			bulkWriteOps.push({
				updateOne: {
					filter: {
						_id: match._id,
					},
					update: {
						$set: {
							assigned_scorer: {
								id: assigned_scorer._id,
								name: assigned_scorer.name
							}
						}
					}
				}
			});
		}
		// update actual scorer
		if (match.actual_scorer && actual_scorer) {
			bulkWriteOps.push({
				updateOne: {
					filter: {
						_id: match._id,
					},
					update: {
						$set: {
							actual_scorer: {
								id: actual_scorer._id,
								name: actual_scorer.name
							}
						}
					}
				}
			});
		}
		// only console log if actual scorer is defined and is string
		else if (typeof match.actual_scorer === 'string') console.log(`Could not find actual_scorer for key ${match.match_team_key}, name=${match.actual_scorer}`);
	}
	
	console.log(`Going to send ${bulkWriteOps.length} update operations.`);
	if (!await prompt('Submit them?')) return process.exit(0);
	
	let writeResult = await utilities.bulkWrite('matchscouting', bulkWriteOps);
	
	console.log(writeResult);
	
	process.exit();
})();