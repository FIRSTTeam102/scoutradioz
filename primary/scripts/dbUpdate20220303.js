
process.env.TIER = 'qa';

const utilities = require('@firstteam102/scoutradioz-utilities');
const readline = require('readline');

utilities.config(require('../databases.json'), {
	cache: {
		enable: false,
	},
	debug: true,
});

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
	
	var org = await utilities.findOne('orgs', {org_key: 'frc852'});
	var users = await utilities.find('users', {org_key: 'frc852'});
	
	console.log(`Org found: ${!!org}, users found: ${users.length}`);
	
	process.env.TIER = 'prod';
	utilities.refreshTier();
	
	var orgProd = await utilities.findOne('orgs', {org_key: 'frc852'});
	var usersProd = await utilities.find('users', {org_key: 'frc852'});
	
	console.log(`IN PROD: Org found: ${!!orgProd}, users found: ${usersProd.length}`);
	
	if (!await prompt('Insert into prod?')) return process.exit(0);
	
	await utilities.insert('orgs', org);
	await utilities.insert('users', users);
	
	process.exit(0);
})();