const log4js = require('log4js');
/** @type {import('./src/utilities').default} */
const utilities = require('./build/utilities');

//log4js config
log4js.configure({
	appenders: { out: { type: 'stdout', layout: {
		type: 'pattern',
		//Non-colored pattern layout (default)
		pattern: '%[[%d{hh:mm:ss}] [%x{tier}] [%p] %c.%x{funcName} - %]%m',
		tokens: {
			'tier': logEvent => 'TEST|'+process.env.TIER,
			'funcName': logEvent => {
				if (logEvent.context && logEvent.context.funcName) {
					return logEvent.context.funcName;
				}
				else {
					return '';
				}
			},
		},
	} } },
	categories: { default: { appenders: ['out'], level: 'info' } }
});
const logger = log4js.getLogger();
logger.level = 'trace';

utilities.config({
	app: {url: 'mongodb://127.0.0.1:27017/app'},
	dev: {url: 'mongodb://127.0.0.1:27017/dev'}
}, {cache: {enable: true}, debug: true});

//Test utilities.getURL
async function testGetUrl() {
	logger.info('Attempting to get url...');
	var url = await utilities.getDBurl();
	logger.info(`url=${url}`);
}
logger.info('Calling testGetUrl');
testGetUrl();
process.env.TIER = 'app';
logger.info('Refreshing tier');
utilities.refreshTier();

async function testMultipleDbs(){
	
	//app
	process.env.TIER = 'app';
	utilities.refreshTier();
	
	var teams = await utilities.find('teams', {team_number: 102});
	logger.info(`app: teamFind=${JSON.stringify(teams)}`);
	
	//dev
	process.env.TIER = 'dev';
	utilities.refreshTier();
	
	teams = await utilities.find('teams', {team_number: 102});
	logger.info(`dev: teamFind=${JSON.stringify(teams)}`);
	
	//app second time
	process.env.TIER = 'app';
	utilities.refreshTier();
	
	teams = await utilities.find('teams', {team_number: 102});
	logger.info(`app: teamFind=${JSON.stringify(teams)}`);
	
	//test insert
	process.env.TIER = 'dev';
	utilities.refreshTier();
	
	await utilities.insert('test', {'foo': 'bar'});
	
	var obj = await utilities.findOne('test', {'foo': 'bar'});
	logger.info(`In dev: ${JSON.stringify(obj)}`);
	
	process.env.TIER = 'app';
	utilities.refreshTier();
	obj = await utilities.findOne('test', {'foo': 'bar'});
	logger.info(`In app: ${JSON.stringify(obj)}`);
	
	process.env.TIER = 'dev';
	utilities.refreshTier();
	
	await utilities.remove('test', {'foo': 'bar'});
	
	await utilities.insert('users', {
		name: 'test_user',
		org_key: 'none',
	});
	
	await utilities.insert('users', [{name: 'test_user 2'}, {name: 'test_user 3'}, {name: 'test_user 4'}, {name: 'test_user 5'}]);
	
	process.env.TIER = 'app';
	utilities.refreshTier();
	
	var teamAvatar = await utilities.requestFIRST('2020/avatars?teamNumber=238&teamNumber=102');
	logger.info(`teamAvatar: ${JSON.stringify(teamAvatar, null, 2)}`);
	
	var teamAvatars = await utilities.requestFIRST('2022/avatars?eventCode=mrcmp');
	console.log(teamAvatars);
	
	var eventTeams = await utilities.requestTheBlueAlliance('event/2022mttd/teams/simple');
	console.log(eventTeams);
	
	try {
		var result = await utilities.requestTheBlueAlliance('aklsfejslakfjd');
	}
	catch (err) {
		console.log('Error from TBA:', err);
		console.log('If the above is an error, then this individual test was successful.');
	}
	
	logger.info('Done');
	process.exit(0);
}

testMultipleDbs();