const router = require('express').Router();
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const logger = require('log4js').getLogger('index');
const e = require('@firstteam102/http-errors');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

// Grabs team avatars from the FIRST API. TODO: Store the date that it was retrieved & update in the DB if it's older than a week or something (in case the team updates their avatar mid season)
router.all('/team-avatars', wrap(async (req, res) => {
	logger.addContext('funcName', 'team-avatars');
	
	const teamsStr = req.query.teamNumbers; // Comma-separated list of teams to request. Handled by client.
	const event_year = req.event.year;
	
	logger.debug(`ENTER, event_year=${event_year} teams=${teamsStr}`);
	
	if (!teamsStr) return res.send({status: 400, message: 'No teams provided'});
	
	// Split the list of teams into an array, and parse the team numbers
	const teamsArr = teamsStr.split(',')
		.map(teamNum => parseInt(teamNum));
	
	let foundAvatars = await utilities.find('teamavatars', 
		{ event_year: event_year, team_number: {$in: teamsArr} }, 
		{}, 
		{ allowCache: true, maxCacheAge: 300 }
	);
	
	let reqPromises = [];
	
	for (let i in teamsArr) {
		let teamNum = teamsArr[i];
		let foundInDb = false;
		// Check if the team was found in the database
		for (let foundAvatar of foundAvatars){
			if (foundAvatar.team_number === teamNum) {
				foundInDb = true;
				break;
			}
		}
		if (!foundInDb) {
			reqPromises.push(utilities.requestFIRST(`${event_year}/avatars?teamNumber=${teamNum}`));
		}
	}
	
	try {
		let responses = await Promise.all(reqPromises);
		let itemsToInsert = [];
		
		for (let response of responses) {
			if (response && response.teams && response.teams[0]) {
				let teamResponse = response.teams[0];
				logger.trace(`teamResponse=${JSON.stringify(teamResponse)}`);
				
				// Create object with keys that follow our database naming scheme
				let newTeamAvatar = {
					team_number: teamResponse.teamNumber,
					event_year: event_year,
					encoded_avatar: teamResponse.encodedAvatar,
				};
				
				itemsToInsert.push(newTeamAvatar);
				foundAvatars.push(newTeamAvatar);
			}
		}
		
		await utilities.insert('teamavatars', itemsToInsert);
	}
	catch (err) {
		return res.send({status: 500, error: err});
	}
	
	return res.send(foundAvatars);
	// eslint-disable-next-line no-unreachable
	try {
		let response = await utilities.requestFIRST(`${event_year}/avatars?teamNumber=${teamNumber}`);
		if (response && response.teams && response.teams[0]) {
			let teamResponse = response.teams[0];
			logger.trace(`teamResponse=${JSON.stringify(teamResponse)}`);
			
			// Create object with keys that follow our database naming scheme
			let newTeamAvatar = {
				team_number: teamResponse.teamNumber,
				event_year: event_year,
				encoded_avatar: teamResponse.encodedAvatar,
			};
			
			await utilities.insert('teamavatars', newTeamAvatar);
		}
		
		res.send(response);
	} 
	catch (error) {
		res.send({status: 500, error: error});
	}
	
}));

module.exports = router;