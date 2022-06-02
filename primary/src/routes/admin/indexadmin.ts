import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { MongoDocument } from '@firstteam102/scoutradioz-utilities';
import type { Org, Team } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('indexadmin');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require global-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_GLOBAL_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	
	res.render('./admin/index', { 
		title: 'Administration'
	});
	
}));

router.get('/sitemap', wrap(async (req, res) => {
	logger.addContext('funcName', 'sitemap[get]');
	logger.info('ENTER');
	
	let siteLayout = {
		'index.ts': {
			'/': 'Pick organization',
			'/home': 'home'
		},
		'user.ts': {
			'/user/login': 'Login to org',
			'/user/changepassword': 'Change password',
			'/user/logout': 'Log out',
			'/user/preferences/reportcolumns': 'Choose report columns',
		},
		'dashboard.ts': {
			'/dashboard': 'Exclusive to "assigned" scouters- Pit/match scouting assignments',
			'/dashboard/unassigned': 'Exclusive to "unassigned" scouters- Provides links to "one-off" pit/match scouting',
			'/dashboard/allianceselection': 'Alliance/team "pick-list", to follow along with the alliance selection process',
			'/dashboard/pits': 'List of teams for pit scouting, plus scouter assignments',
			'/dashboard/pits?loadPhotos=1': 'Pit scouting with team photos',
			'/dashboard/matches': 'List of upcoming matches, plus scouter assignments to each team',
			'/dashboard/driveteam': 'Drive team dashboard: Shows intel for upcoming match',
			'/dashboard/driveteam?team_key=frc3201': 'Drive team dashboard for specific team',
		},
		'scouting.ts': {
			'/scouting/pit?team_key=frc102': 'Pit scouting survey + photo upload',
			'/scouting/match?key=2019paca_qm57_frc2656&alliance=Blue': 'Match scouting survey',
			// '/scouting/teampictures': 'Team pictures list (currently broken)',
		},
		'reports.ts': {
			'/reports/alliancestats?teams=frc3260,frc379,frc2053,0,frc2656,frc4085,frc4780': 'show metrics (averages vs. maximums) for individual teams [nominally, to compare alliances]',
			'/reports/allteammetrics': 'show all the metrics for all the teams in single visualization',
			'/reports/finishedmatches': 'shows all the finished matches for the event so far; can get per-match scout data & FIRST data, also individual team scout numbers',
			'/reports/matchdata?key=2019paca_qm55': 'shows "quantifiable" data for all teams from a particular match',
			'/reports/matchintel?key=2019paca_qm55': 'shows the detailed FIRST data for a given match, including the "Watch this match on YouTube" link',
			'/reports/matchmetrics?key=2019paca_qm57': 'show averaged metrics for each alliance',
			'/reports/metricintel?key=totalPieces': 'for a specific metric, show min/avg/var/max for each team, sortable',
			'/reports/metrics': 'show relative values of all the metrics',
			'/reports/metricsranked': 'show the top teams per metric (or "mult" if ties)',
			'/reports/rankings': 'show current event rankings',
			'/reports/teamdata?team_key=frc102': 'shows all the quantifiable data for a given team',
			'/reports/teamintel?team_key=frc1708': 'Team intel',
			'/reports/teamintelhistory?team_key=frc102': 'Team intel history',
			'/reports/teammatchintel?key=2019paca_qm55_frc4027': 'Shows match scouted data displayed in the same form as collection',
			'/reports/upcoming': 'Upcoming matches all teams',
			'/reports/upcoming?team_key=frc1708': 'Upcoming matches specific team',
		},
		'manage/indexmgmt.ts': {
			'/manage': 'Main org-management page',
		},
		'manage/allianceselection.ts': {
			'/manage/allianceselection': 'manage/allianceselection',
		},
		'manage/currentevent.ts': {
			'/manage/currentevent/matches': '"See matches for current event"- (Legacy) Manual match-updating buttons (+ data aggregation?)',
			'/manage/currentevent/getcurrentteams': '"Update list of current teams"- Updates team_keys list for the current event',
			'': 'Note: There are plenty of POST urls in /currentevent for /matches links',
		},
		'manage/manualdata.ts': {
			'/manage/manualdata/teams': 'Manually input teams for current event (Disabled; Not updated for 2020 event/teams data structure yet)',
			'/manage/manualdata/matchschedule': 'Manually input match schedule for current event',
			'/manage/manualdata/matches': 'Manually input match results for current event',
		},
		'manage/members.ts': {
			'/manage/members': 'Member management page - Name, subteam, class, role, # years; Sorted by role',
			'/manage/members/passwords': 'Password audit page to check if team-admins and global-admins have set passwords',
			'/manage/members/present': 'Set who is present at current event',			},
		'manage/orgconfig.ts': {
			'/manage/config/pitsurvey?year=2019': 'Pit-survey layout config page.',
		},
		'manage/scoutingaudit.ts': {
			'/manage/scoutingaudit': 'Match-scouting audit- Sorted by scouter, Grouped by assignment',
			'/manage/scoutingaudit/comments': 'Match-scouting comments audit- Grouped by scouter, only displays "additional notes" comments',
			'/manage/scoutingaudit/bymatch': 'Match-scouting audit- Sorted by match, Grouped by team',
			'/manage/scoutingaudit/uploads': 'Audit page for students\' photo uploads',
		},
		'manage/scoutingpairs.ts': {
			'/manage/scoutingpairs': 'Manage pairs for pit scouting and assignments for match scouting',
			'/manage/scoutingpairs/swapmembers': 'Match scouting swap ',
		},
		'admin/indexadmin.ts': {
			'/admin': 'Admin index page ',
		},
		'admin/externaldata.ts': {
			'/admin/externaldata/events': 'Displays list of events, plus event_keys, for each year.',
			'/admin/externaldata/matches?eventId=2020week0': 'Displays list of matches for a specific ("Non-current") event. (Quite out of date - Might contain "dangerous" code?)',
			'/admin/externaldata/teams': 'List of ALL teams (Note: Very large page)',
		},
	};
	
	res.render('./admin/sitemap', {
		title: 'Site map',
		siteLayout: siteLayout,
	});
	
}));

router.get('/orgs', wrap(async (req, res) => {
	logger.addContext('funcName', 'orgs[get]');
	logger.info('ENTER');
	
	const orgs: Org[] = await utilities.find('orgs', {});
	
	res.render('./admin/orgs', {
		title: 'Manage organizations',
		orgs: orgs
	});
	
}));

router.post('/orgs', wrap(async (req, res) => {
	const thisFuncName = 'orgs[post]: ';
	logger.info('ENTER');
	
	console.log(req.body);
	
	const orgKey = req.body.org_key;
	const nickname = req.body.nickname;
	const teamKey = req.body.team_key;
	const defaultPassword = req.body.default_password;
	
	let org: Org = await utilities.findOne('orgs', {org_key: orgKey});
	
	logger.debug(`${thisFuncName} org=${JSON.stringify(org)}`);
	if (!org) throw Error('Org could not be found');
	
	logger.info(`${thisFuncName} Updating org ${orgKey}, nickname=${nickname}`);
	
	//Aggregate config.members.subteams and config.members.classes
	let subteams: MongoDocument[] = []; // TODO: Change to OrgSubteam[] and OrgClass[], but the code later down will have to be tweaked (got to verify the data structure)
	let classes: MongoDocument[] = [];
	//eslint-disable-next-line
	for (var elem in req.body) {
		let split = elem.split('_');
		let elemIdx = parseInt(split[1]);
		let elemType = split[2];
		let elemKey, elemValue;
		
		switch (elemType) {
			case 'pitscout':
				elemKey = 'pit_scout';
				elemValue = (req.body[elem] == true);
				break;
			case 'youth':
				elemKey = 'youth';
				elemValue = (req.body[elem] == true);
				break;
			case 'subteamkey':
				elemKey = 'subteam_key';
				elemValue = req.body[elem];
				break;
			case 'classkey':
				elemKey = 'class_key';
				elemValue = req.body[elem];
				break;
			default:
				elemKey = elemType;
				elemValue = req.body[elem];
		}
		
		//Go through subteams
		if (elem.includes('subteams')) {
			//if there is no subteam at this idx, create it
			if (!subteams[elemIdx]) {
				subteams[elemIdx] = {};
			}
			//pop in this element into the corresponding part of subteams
			subteams[elemIdx][elemKey] = req.body[elem];
		}
		//Go through classes
		else if (elem.includes('classes')) {
			//if there is no subteam at this idx, create it
			if (!classes[elemIdx]) {
				classes[elemIdx] = {};
			}
			//pop in this element into the corresponding part of classes
			classes[elemIdx][elemKey] = req.body[elem];
		}
	}
	logger.debug(`${thisFuncName} subteams=${JSON.stringify(subteams)} classes=${JSON.stringify(classes)}`);
	
	//Create update query
	let updateQuery: MongoDocument = {
		$set: {
			nickname: nickname,
			'config.members.subteams': subteams,
			'config.members.classes': classes,
		}
	};
	
	//If new default password is set
	if (defaultPassword) {
		//Hash new password
		let hash = await bcrypt.hash(defaultPassword, 10);
		
		logger.info(`${thisFuncName} Setting ${orgKey}'s default password to: ${defaultPassword}`);
		logger.info(`${thisFuncName} Old hash: ${org.default_password} New hash: ${hash}`);
		//Add to updateQuery
		updateQuery['$set'].default_password = hash;
	}
	
	//If a team key is specified
	if (teamKey) {
		if (!teamKey.includes('frc')) throw Error('Team key is invalid.');
		
		let team: Team = await utilities.findOne('teams', {key: teamKey});
		if (!team) throw Error(`Team ${teamKey} could not be found`);
		
		let teamNumber = teamKey.substring(3);
		updateQuery['$set'].team_key = teamKey;
		updateQuery['$set'].team_number = teamNumber;
	}
	
	logger.debug(`${thisFuncName} updateQuery=${JSON.stringify(updateQuery)}`);
	
	//return res.send(200);
	const writeResult = await utilities.update('orgs', 
		{org_key: orgKey}, updateQuery
	);
	
	logger.debug(`${thisFuncName} writeResult=${JSON.stringify(writeResult)}`);
	
	res.redirect('/admin/orgs?alert=Updated successfully.&type=good');
}));

module.exports = router;