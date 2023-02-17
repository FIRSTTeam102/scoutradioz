// BIG TODO
// Automated way to add indexes to our database collections so we don't have to add them manually on every tier

/*

	Rankings: 
		- event_key (-1 maybe, because latest year is most common?)
		- rank: 1 (for sort)
	
	Matches:
		- event_key: -1, alliances.red.score: 1 (compound)
		
	Matchscouting:
		- org_key: 1, event_key: -1, team_key: 1 (compound)

*/

const colIndexes = {
	rankings: [
		[{
			event_key: -1,
			rank: 1
		}, {
			name: 'event+rank',
		}]
	],
	matches: [
		[{
			event_key: -1,
			'alliances.red.score': 1
		}, {
			name: 'event+score',
		}]
	],
	matchscouting: [
		[{
			org_key: 1,
			event_key: -1,
			team_key: 1
		}, {
			name: 'org+event+team',
		}]
	]
};
		

process.env.TIER = 'dev';

const utilities = require('scoutradioz-utilities');
const readline = require('./readline');

utilities.config(require('../databases.json'), {
	cache: {
		enable: false,
	},
	debug: true,
});

utilities.refreshTier();

(async () => {
	
	let tier = await readline.ask('Enter the database tier on which to operate: ');
	process.env.TIER = tier;
	utilities.refreshTier();
	
	let db = await utilities.getDB();
	
	for (let colName in colIndexes) {
		let col = db.collection(colName);
		console.log(`Dropping indexes for ${colName}`);
		col.dropIndexes();
		let indexes = colIndexes[colName];
		for (let index of indexes) {
			let fields = index[0];
			let options = index[1];
			let indexName = await col.createIndex(fields, options);
			console.log('Created index ' + indexName);
		}
	}
	process.exit(0);
})();