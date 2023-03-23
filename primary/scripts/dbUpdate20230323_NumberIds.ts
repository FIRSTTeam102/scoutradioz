import type { MatchScouting, PitScouting, ScoutingPair, User } from 'scoutradioz-types';
import type { Utilities } from 'scoutradioz-utilities';
import type { AnyBulkWriteOperation, ObjectId } from 'mongodb';

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
	
	console.log(`RUNNING OPERATION FOR TIER ${process.env.TIER}`);
	
	const users = await utilities.find('users', {_id: {$type: 'objectId'}});
	
	const oidToNumIdMap: {[key: string]: number} = {};
	
	let ops: AnyBulkWriteOperation<User>[] = [];
	users.forEach((user, index) => {
		let newUser = {
			...user
		};
		oidToNumIdMap[String(user._id)] = index; // save the old index for scouterrecords
		// @ts-ignore
		newUser._id = index;
		
		ops.push({
			deleteOne: {
				filter: {
					_id: user._id
				}
			},
		});
		ops.push({
			insertOne: {
				document: newUser
			}
		});
	});
	
	if (!ops.length) {
		console.log('No users have been updated!');
		process.exit(1);
	}
	
	let writeResult = await utilities.bulkWrite('users', ops);
	console.log(writeResult);
	
	let scoutingpairs = await utilities.find('scoutingpairs', {});
	let ops2: AnyBulkWriteOperation<ScoutingPair>[] = [];
	scoutingpairs.forEach((pair, index) => {
		let newPair = {...pair};
		
		if (newPair.member1) {
			// @ts-ignore
			newPair.member1.id = oidToNumIdMap[String(newPair.member1.id)] || -1;
		}
		if (newPair.member2) {
			// @ts-ignore
			newPair.member2.id = oidToNumIdMap[String(newPair.member2.id)] || -1;
		}
		if (newPair.member3) {
			// @ts-ignore
			newPair.member3.id = oidToNumIdMap[String(newPair.member3.id)] || -1;
		}
		
		ops2.push({
			deleteOne: {
				filter: {
					_id: pair._id
				}
			},
		});
		ops2.push({
			insertOne: {
				document: newPair
			},
		});
	});
	
	let matchscouting = await utilities.find('matchscouting', {});
	let ops3: AnyBulkWriteOperation<MatchScouting>[] = [];
	matchscouting.forEach(item => {
		let newMS = {...item};
		
		if (newMS.actual_scorer) {
			// @ts-ignore
			newMS.actual_scorer.id = oidToNumIdMap[String(newMS.actual_scorer.id)] || -1;
		}
		if (newMS.assigned_scorer) {
			// @ts-ignore
			newMS.assigned_scorer.id = oidToNumIdMap[String(newMS.assigned_scorer.id)] || -1;
		}
		
		ops3.push({
			deleteOne: {
				filter: {
					_id: item._id
				}
			}
		});
		ops3.push({
			insertOne: {
				document: newMS
			}
		});
	});
	
	let pitscouting = await utilities.find('pitscouting', {});
	let ops4: AnyBulkWriteOperation<PitScouting>[] = [];
	pitscouting.forEach(item => {
		let newPS = {...item};
		
		if (newPS.primary) {
			// @ts-ignore
			newPS.primary.id = oidToNumIdMap[String(newPS.primary.id)] || -1;
		}
		if (newPS.secondary) {
			// @ts-ignore
			newPS.secondary.id = oidToNumIdMap[String(newPS.secondary.id)] || -1;
		}
		if (newPS.tertiary) {
			// @ts-ignore
			newPS.tertiary.id = oidToNumIdMap[String(newPS.tertiary.id)] || -1;
		}
		
		ops4.push({
			deleteOne: {
				filter: {
					_id: item._id
				}
			}
		});
		ops4.push({
			insertOne: {
				document: newPS
			}
		});
	});
	
	console.log(await utilities.bulkWrite('scoutingpairs', ops2));
	console.log(await utilities.bulkWrite('matchscouting', ops3));
	console.log(await utilities.bulkWrite('pitscouting', ops4));
	
	process.exit(0);
	
})();