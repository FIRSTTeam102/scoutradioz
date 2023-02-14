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
	
	const scoutingpairs = await utilities.find('scoutingpairs', {$or: [{member1: {$type: 'string'}}, {member2: {$type: 'string'}}, {member3: {$type: 'string'}}]});
	const pitscouting = await utilities.find('pitscouting', {$or: [{primary: {$type: 'string'}}, {secondary: {$type: 'string'}}, {tertiary: {$type: 'string'}}, {actual_scouter: {$type: 'string'}}]});
	
	
	let bulkWriteOpsPairs: AnyBulkWriteOperation[] = [];
	let bulkWriteOpsPit: AnyBulkWriteOperation[] = [];
	
	for (let pair of scoutingpairs) {
		let member1 = (await utilities.findOne('users', {name: pair.member1})) || deletedUsersMap[pair.org_key];
		let member2 = (await utilities.findOne('users', {name: pair.member2})) || deletedUsersMap[pair.org_key];
		let member3 = pair.member3 ? (await utilities.findOne('users', {name: pair.member2})) || deletedUsersMap[pair.org_key] : undefined;
		
		// member1 and member2
		if (typeof pair.member1 === 'string' && typeof pair.member2 === 'string')
			bulkWriteOpsPairs.push({
				updateOne: {
					filter: {
						_id: pair._id,
					},
					update: {
						$set: {
							member1: {
								id: member1._id,
								name: member1.name,
							},
							member2: {
								id: member2._id,
								name: member2.name,
							}
						}
					}
				}
			});
		// member3 optional
		if (member3) {
			bulkWriteOpsPairs.push({
				updateOne: {
					filter: {
						_id: pair._id,
					},
					update: {
						$set: {
							member3: {
								id: member3._id,
								name: member3.name,
							},
						}
					}
				}
			});
		}
	}
	
	for (let item of pitscouting) {
		let primary = (await utilities.findOne('users', {name: item.primary})) || deletedUsersMap[item.org_key];
		let secondary = (await utilities.findOne('users', {name: item.secondary})) || deletedUsersMap[item.org_key];
		let tertiary = item.tertiary ? (await utilities.findOne('users', {name: item.tertiary})) || deletedUsersMap[item.org_key] : undefined;
		let actual_scouter = item.actual_scouter ? (await utilities.findOne('users', {name: item.actual_scouter})) || deletedUsersMap[item.org_key] : undefined;
		
		// member1 and member2
		if (typeof item.primary === 'string' && typeof item.secondary === 'string')
			bulkWriteOpsPit.push({
				updateOne: {
					filter: {
						_id: item._id,
					},
					update: {
						$set: {
							primary: {
								id: primary._id,
								name: primary.name,
							},
							secondary: {
								id: secondary._id,
								name: secondary.name,
							}
						},
						$unset: {member1: '', member2: '', member3: ''}
					}
				}
			});
		// member3 optional
		if (tertiary) {
			bulkWriteOpsPit.push({
				updateOne: {
					filter: {
						_id: item._id,
					},
					update: {
						$set: {
							tertiary: {
								id: tertiary._id,
								name: tertiary.name,
							},
						}
					}
				}
			});
		}
		// actual_scouter optional
		if (actual_scouter) {
			bulkWriteOpsPit.push({
				updateOne: {
					filter: {
						_id: item._id,
					},
					update: {
						$set: {
							actual_scouter: {
								id: actual_scouter._id,
								name: actual_scouter.name,
							},
						}
					}
				}
			});
		}
	}
	
	if (bulkWriteOpsPairs.length) {
		console.log(`Going to send ${bulkWriteOpsPairs.length} update operations on scoutingpairs.`);
		if (!await prompt('Submit them?')) return process.exit(0);
	
		let writeResult = await utilities.bulkWrite('scoutingpairs', bulkWriteOpsPairs);
		
		console.log(writeResult);
	}
	else console.log('No scoutingpairs operations to do');
	
	console.log(`Going to send ${bulkWriteOpsPit.length} update operations on pitscouting.`);
	if (!await prompt('Submit them?')) return process.exit(0);
	
	let writeResult = await utilities.bulkWrite('pitscouting', bulkWriteOpsPit);
	
	console.log(writeResult);
	
	process.exit();
})();