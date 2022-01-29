const log4js = require('log4js');
const utilities = require('./utilities');

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
	app: {url: 'mongodb://localhost:27017/app'},
	dev: {url: 'mongodb://localhost:27017/dev'}
});

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
	
	var writeResult = await utilities.insert('test', {'foo': 'bar'});
	logger.info(`writeResult=${JSON.stringify(writeResult)}`);
	
	var obj = await utilities.findOne('test', {'foo': 'bar'});
	logger.info(`In dev: ${obj}`);
	
	process.env.TIER = 'app';
	utilities.refreshTier();
	obj = await utilities.findOne('test', {'foo': 'bar'});
	logger.info(`In app: ${obj}`);
	
	process.env.TIER = 'dev';
	utilities.refreshTier();
	
	var delResult = await utilities.remove('test', {'foo': 'bar'});
	logger.info(`delResult: ${delResult}`);
	
	logger.info('Done');
}

testMultipleDbs();