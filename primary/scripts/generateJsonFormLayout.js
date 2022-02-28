const utilities = require('@firstteam102/scoutradioz-utilities');
const readline = require('readline');

process.env.TIER = 'qa';
utilities.config(require('../databases.json'), {
	cache: {
		enable: false,
	},
	debug: false,
});

utilities.refreshTier();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function prompt(question) {
	return new Promise((resolve, reject) => {
		rl.question(question, answer => {
			resolve(answer);
		});
	});
}

// type, id, label, multiselectOptions, [sliderMin, sliderMax, sliderStep]
const matchAthenian = [
	['h2', 'autoLabel', 'Autonomous'],
	['counter', 'autoBallScored', 'Balls scored'],
	['checkbox', 'autoHumanMadeShot', 'Human Player made shot'],
	['textblock', 'autoDescription', 'Auto description'],
	['spacer'],
	['h2', 'teleopLabel', 'Teleop'],
	['counter', 'teleopBallsScored', 'Balls scored'],
	['checkbox', 'defensePlayed', 'Defense played'],
	['checkbox', 'counterDefensePlayed', 'Counter defense played'],
	['spacer'],
	['h2', 'endgameLabel', 'End game'],
	['multiselect', 'climb', 'Climb', [0, 'Low', 'Mid', 'High', 'Traversal']],
	['spacer'],
	['h2', 'generalLabel', 'General'],
	['slider', 'shooterConsistency', 'Shooter consistency', null, [1, 10, 1]],
	['slider', 'agilityOnField', 'Agility on the field', null, [1, 5, 1]],
	['checkbox', 'diedOnField', 'Died on field'],
	['spacer'],
	['textblock', 'otherNotes', 'Other comments and notes:'],
];
const pitAthenian = [
	['h2', 'robotLabel', 'Robot construction'],
	['multiselect', 'drivetrainType', 'Drivetrain Type', ['Swerve', 'Tank', 'West Coast', 'Other']],
	['textblock', 'drivetrainDescription', 'Describe their drivetrain:'],
	['textblock', 'shooterDescription', 'Describe their shooter (High/Low, Single Flywheel/Double Flywheel/Manipulator, Turret Yes/No, Hood Angle):'],
	['textblock', 'intakeDescription', 'Describe their method of cargo intake (Over The Bumper Yes/No, Flywheels Yes/No, etc.):'],
	['spacer'],
	['h2', 'autoLabel', 'Gameplay'],
	['textblock', 'climberDescription', 'Describe their climbing method:'],
	['multiselect', 'theoreticalClimb', 'Theoretical Max Climb', ['0', 'Low', 'Mid', 'High', 'Traversal']],
	['textblock', 'autoPlan', 'Describe their plan for autonomous:'],
	['spacer'],
	['textblock', 'other', 'Other'],
];

const matchDerived = [
	// {
	// 	order: 500,
	// 	label: 'Shooter consistency',
	// 	id: 'shooterConsistencyNum',
	// 	operator: 'multiselect',
	// 	operands: [{id: 'shooterConsistency', numerical: true}],
	// },
	// {
	// 	order: 510,
	// 	label: 'Agility on the field',
	// 	id: 'agilityOnFieldNum',
	// 	operator: 'multiselect',
	// 	operands: [{id: 'agilityOnField', numerical: true}],
	// },
	{
		order: 520,
		label: 'Climb points',
		id: 'climbPoints',
		operator: 'multiselect',
		operands: [{
			id: 'climb',
			quantifiers: {
				0: 0,
				'Low': 4,
				'Mid': 6,
				'High': 10,
				'Traversal': 15,
			}
		}]
	},
];

const year = 2022;
const org_key = 'frc852';

let layoutArr = [];

function fixArray(arr, derived, formType) {
	let ret = [];
	for (let i = 0; i < arr.length; i++) {
		let item = arr[i];
		let order = (i * 10);
		let type = item[0];
		let id = item[1];
		let label = item[2];
		let options = item[3];
		let slider = item[4];
		let newItem = {
			year: year,
			order: order,
			type: type,
		};
		if (label) newItem.label = label;
		if (options) newItem.options = options;
		if (id) newItem.id = id;
		if (slider) {
			newItem.options = {
				min: slider[0],
				max: slider[1],
				step: slider[2],
			};
		}
		newItem.form_type = formType;
		newItem.org_key = org_key;
		ret.push(newItem);
	}
	for (let i = 0; i < derived.length; i++) {
		let item = derived[i];
		let newItem = {
			year: year,
			order: item.order,
			type: 'derived',
			operator: item.operator,
			label: item.label,
			id: item.id,
			form_type: formType,
			org_key: org_key
		};
		if (item.operands) newItem.operands = item.operands;
		if (item.numerical) newItem.numerical = item.numerical;
		ret.push(newItem);
	}
	return ret;
}

main();

async function main() {
	
	layoutArr = [...fixArray(matchAthenian, matchDerived, 'matchscouting'), ...fixArray(pitAthenian, [], 'pitscouting')];
	
	let existing = await utilities.find('layout', {org_key: org_key, year: year});
	let proceed, writeResult;
	
	if (existing.length == 0) {
		console.log(`No entries found in database for org_key ${org_key} year ${year}.`);
	}
	else {
		console.log(`${existing.length} entries found in database for org_key ${org_key} year ${year}.`);
		proceed = (await prompt(`Delete ${existing.length} entries? [DATABASE TIER: ${process.env.TIER}] [y/N] `)).toLowerCase().startsWith('y');
		
		if (proceed) {
			console.log('Deleting entries...');
			writeResult = await utilities.remove('layout', {org_key: org_key, year: year});
			console.log(`Done, nRemoved = ${writeResult.removedCount}`);
			
		}
	}
	
	console.log(`${layoutArr.length} new items to add for org_key ${org_key} year ${year}.`);
	proceed = (await prompt(`Insert ${layoutArr.length} entries? [y/N] `)).toLowerCase().startsWith('y');
	
	if (proceed) {
		writeResult = await utilities.insert('layout', layoutArr);
		console.log(`${writeResult.nInserted || writeResult.insertedCount} items inserted.`);
	}
	
	rl.close();
	process.exit(0);
}