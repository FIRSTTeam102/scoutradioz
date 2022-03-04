const utilities = require('@firstteam102/scoutradioz-utilities');
const readline = require('readline');

process.env.TIER = 'dev';
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
const matchAthenian2022 = [
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
const pitAthenian2022 = [
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

// type, id, label, multiselectOptions, [sliderMin, sliderMax, sliderStep]
const matchGearheads2022 = [
	['h2', 'lblAuto', 'Autonomous'],
	['h3', 'lblAutoUpperHub', 'Upper Hub'],
	['counter', 'autoHighScored', 'Cargo scored by robot'],
	['badcounter', 'autoHighMissed', 'Cargo missed by robot'],
	['h3', 'lblAutoLowerHub', 'Lower Hub'],
	['counter', 'autoLowScored', 'Cargo scored by robot'],
	['badcounter', 'autoLowMissed', 'Cargo missed by robot'],
	['checkbox', 'autoHumanMadeShot', 'Did the human player score? (Only check this if the human player is from Team {{team_number}}!)'],
	['spacer'],
	['h2', 'teleopLabel', 'Teleop'],
	['h3', 'lblTeleUpperHub', 'Upper Hub'],
	['counter', 'teleHighScored', 'Cargo scored'],
	['badcounter', 'teleHighMissed', 'Cargo missed'],
	['h3', 'lblTeleLowerHub', 'Lower Hub'],
	['counter', 'teleopLowScored', 'Cargo scored'],
	['badcounter', 'teleopLowMissed', 'Cargo missed'],
	['spacer'],
	['h2', 'endgameLabel', 'End game'],
	['multiselect', 'attemptedClimb', 'Attempted climb level:', ['None', 'Low', 'Mid', 'High', 'Traversal']],
	['multiselect', 'successfulClimb', 'Successful climb level:', ['None', 'Low', 'Mid', 'High', 'Traversal']],
	['slider', 'climbTimeSeconds', 'Approximately how long did it take them to climb? (seconds)', null, [10, 90, 10]],
	['spacer'],
	['h2', 'generalLabel', 'General'],
	['checkbox', 'defended', 'Defended (stopped or delayed at least one score)?'],
	['checkbox', 'playedCounterDefense', 'Attempted to stop or deflect a defender?'],
	['checkbox', 'diedDuringMatch', 'Died during the match (or never started)?'],
	['checkbox', 'recoveredFromFreeze', 'Recovered from freeze?'],
	['spacer'],
	['textblock', 'otherNotes', 'Other comments and notes:'],
];

const pitGearheads2022 = [
	['h2', 'lblRobotConstruction', 'Robot construction'],
	['textblock', 'driveTrain', 'Describe the robot\'s drive train:'],
	['spacer'],
	// ['h2', 'lblControls', 'Controls'],
	// ['multiselect', 'controls', 'What kind of controls does the driver use?', ['Game controller (Xbox/PS4/etc.)', 'One joystick', 'Two joysticks', 'Other']],
	// ['textblock', 'controlNotes', 'Other info: Any special notes on driving? Are there operator controls? What does the operator use? Etc.'],
	['h2', 'lblAuto', 'Autonomous period'],
	['checkbox', 'doAuto', 'Can they move during the autonomous period?'],
	['slider', 'autoHowManyCargo', 'How many cargo can they shoot during autonomous?', null, [0, 5, 1]],
	['spacer'],
	['h2', 'lblCargo', 'Teleop period'],
	['checkbox', 'doAutoCodeTeleop', 'Do they use any autonomous/assisting code during the match?'],
	['textblock', 'autoCodeTeleopNotes', 'If so, describe how auto/assisting code is used:'],
	['spacer'],
	['checkbox', 'canPickGround', 'Can they pick up cargo from the ground?'],
	['checkbox', 'canPickStation', 'Can they pick up cargo from the Human Player station?'],
	['checkbox', 'canShootLow', 'Can they score cargo in the lower hub?'],
	['checkbox', 'canShootHigh', 'Can they score cargo in the upper hub?'],
	['spacer'],
	['h2', 'lblClimb', 'Climb'],
	['checkbox', 'canClimbLow', 'Can they climb to the Low bar?'],
	['checkbox', 'canClimbMid', 'Can they climb to the Mid bar?'],
	['checkbox', 'canClimbHigh', 'Can they climb to the High bar?'],
	['checkbox', 'canClimbTraversal', 'Can they climb to the Traversal bar?'],
	['textblock', 'climbNotes', 'Describe the robot\'s climb mechanism/strategy:'],
	['spacer'],
	['textblock', 'preferredStrategy', 'What is their preferred strategy?'],
];

const matchDerivedAthenian2022 = [
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

const matchDerivedGearheads2022 = [
	
];

const year = 2022;
// const org_key = 'frc852';
const org_key = 'frc102';

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
	
	if (org_key === 'frc852')
		layoutArr = [...fixArray(matchAthenian2022, matchDerivedAthenian2022, 'matchscouting'), ...fixArray(pitAthenian2022, [], 'pitscouting')];
	else if (org_key === 'frc102')
		layoutArr = [...fixArray(matchGearheads2022, matchDerivedGearheads2022, 'matchscouting'), ...fixArray(pitGearheads2022, [], 'pitscouting')];
	
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