// This will restructure entries in previous years' derived metrics to match the new format
process.env.TIER = 'prod';

const utilities = require('scoutradioz-utilities');
const helpers = require('@firstteam102/scoutradioz-helpers');
const mdh = helpers.matchData;
const csv = require('csv');
const readline = require('./readline');
const fs = require('fs');

utilities.config(require('../databases.json'), {
	cache: {
		enable: false,
	},
	debug: true,
});

utilities.refreshTier();
helpers.config(utilities);

(async () => {
	// return;
	
	const file = fs.readFileSync('./matchdata.tsv', {encoding: 'utf-8'});
	const lines = file.replace(/\n\r/g, '\n').split('\n');
	const results = [];
	
	for (let line of lines) {
		let split = line.split('\t');
		let time = split[0];
		let scouter = split[1].trim();
		let data = JSON.parse(split[2]);
		let existing = await utilities.findOne('matchscouting', {match_team_key: data.match_team_key});
		let update = {$set: {data: data, actual_scorer: scouter}};
		console.log(existing.match_key);
		if (!existing.assigned_scorer) {
			update.$set.assigned_scorer = scouter;
		}
		// console.log(update);
		// if (await readline.confirm('Perform the update?')) {
		let writeResult = await utilities.update('matchscouting', {match_team_key: data.match_team_key}, update);
		results.push(writeResult);
		// }
	}
	
	console.log(results);
	
	process.exit(0);
	var layouts = await utilities.find('layout', {operator: {$ne: null}});
	
	console.log(`Found ${layouts.length} derived metrics in database.`);
	if (!await prompt('Update them?')) return process.exit(0);
	let newLayouts = [];
	let ids = [];
	
	for (let l of layouts) {
		newLayouts.push({
			year: parseInt(l.year),
			order: parseInt(l.order),
			type: 'derived',
			operations: [{
				operator: l.operator,
				operands: l.operands,
			}],
			display_percentage: false,
			label: l.label,
			id: l.id,
			form_type: l.form_type,
			org_key: l.org_key,
		});
		ids.push(l._id);
	}
	for (let i in layouts) {
		console.log('OLD:');
		console.log(JSON.stringify(layouts[i], 0, 2));
		console.log('NEW:');
		console.log(JSON.stringify(newLayouts[i], 0, 2));
	}
	if (!await prompt('Do these all look OK? DATABASE TIER: ' + process.env.TIER)) return process.exit(0);
	
	let writeResult = await utilities.remove('layout', {_id: {$in: ids}});
	console.log(writeResult);
	writeResult = await utilities.insert('layout', newLayouts);
	console.log(writeResult);
	process.exit(0);
})();

// (async () => {
// 	process.env.TIER = 'qa';
// 	utilities.refreshTier();
	
// 	var org = await utilities.findOne('orgs', {org_key: 'frc852'});
// 	var users = await utilities.find('users', {org_key: 'frc852'});
	
// 	console.log(`Org found: ${!!org}, users found: ${users.length}`);
	
// 	process.env.TIER = 'test';
// 	utilities.refreshTier();
	
// 	var orgProd = await utilities.findOne('orgs', {org_key: 'frc852'});
// 	var usersProd = await utilities.find('users', {org_key: 'frc852'});
	
// 	console.log(`IN PROD: Org found: ${!!orgProd}, users found: ${usersProd.length}`);
	
// 	if (!await prompt('Insert into prod?')) return process.exit(0);
	
// 	await utilities.insert('orgs', org);
// 	await utilities.insert('users', users);
	
// 	process.exit(0);
// })();