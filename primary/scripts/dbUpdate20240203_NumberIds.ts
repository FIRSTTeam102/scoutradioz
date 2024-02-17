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
		let newId = index + 1;
		let newUser = {
			...user
		};
		oidToNumIdMap[String(user._id)] = newId; // save the old index for scouterrecords
		// @ts-ignore
		newUser._id = newId;
		
		// _id is immutable on mongodb so we have to do delete-then-insert
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
	
	console.log('Updating users');
	let writeResult = await utilities.bulkWrite('users', ops);
	console.log(writeResult);
	
	let scoutingpairs = await utilities.find('scoutingpairs', {});
	let ops2: AnyBulkWriteOperation<ScoutingPair>[] = [];
	scoutingpairs.forEach((pair, index) => {
		
		let setClause: {[key: string]: any} = {};
		
		if (pair.member1) {
			setClause['member1.id'] = oidToNumIdMap[String(pair.member1.id)] || -1;
		}
		if (pair.member2) {
			setClause['member2.id'] = oidToNumIdMap[String(pair.member2.id)] || -1;
		}
		if (pair.member3) {
			setClause['member3.id'] = oidToNumIdMap[String(pair.member3.id)] || -1;
		}
		
		ops2.push({
			updateOne: {
				filter: {
					_id: pair._id,
				},
				update: {
					$set: setClause,
				}
			}
		});
	});
	
	let matchscouting = await utilities.find('matchscouting', {});
	let ops3: AnyBulkWriteOperation<MatchScouting>[] = [];
	matchscouting.forEach(item => {
		
		let setClause: {[key: string]: any} = {};

		if (item.actual_scorer) {
			setClause['actual_scorer.id' ]= oidToNumIdMap[String(item.actual_scorer.id)] || -1;
		}
		if (item.assigned_scorer) {
			setClause['assigned_scorer.id' ]= oidToNumIdMap[String(item.assigned_scorer.id)] || -1;
		}
		
		ops3.push({
			updateOne: {
				filter: {
					_id: item._id,
				},
				update: {
					$set: setClause,
				}
			}
		});
	});
	
	let pitscouting = await utilities.find('pitscouting', {});
	let ops4: AnyBulkWriteOperation<PitScouting>[] = [];
	pitscouting.forEach(item => {

		let setClause: {[key: string]: any} = {};
		
		if (item.primary) {
			setClause['primary.id'] = oidToNumIdMap[String(item.primary.id)] || -1;
		}
		if (item.secondary) {
			setClause['secondary.id'] = oidToNumIdMap[String(item.secondary.id)] || -1;
		}
		if (item.tertiary) {
			setClause['tertiary.id'] = oidToNumIdMap[String(item.tertiary.id)] || -1;
		}
		
		ops4.push({
			updateOne: {
				filter: {
					_id: item._id,
				},
				update: {
					$set: setClause,
				}
			}
		});
	});
	
	console.log('Scoutingpairs...');
	console.log(await utilities.bulkWrite('scoutingpairs', ops2));
	console.log('Matchscouting...');
	console.log(await utilities.bulkWrite('matchscouting', ops3));
	console.log('Pitscouting...');
	console.log(await utilities.bulkWrite('pitscouting', ops4));
	
	process.exit(0);
	
})();