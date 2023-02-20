import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { MongoDocument } from 'scoutradioz-utilities';
import type { Org, Team, Match } from 'scoutradioz-types';

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
	
	// Find a random qualifying match at this event
	let matches = await utilities.find('matches', {event_key: req.event.key, comp_level: 'qm'});
	
	let matchKey, matchTeamKey, teamKey;
	if (matches.length > 0) {
		let randomMatch = matches[Math.floor(Math.random() * matches.length)];
		let randomTeamKey = randomMatch.alliances.blue.team_keys[Math.floor(Math.random() * 3)];
		teamKey = randomTeamKey;
		matchKey = randomMatch.key;
		matchTeamKey = `${matchKey}_${teamKey}`;
	}
	else {
		teamKey = 'frc3201';
		matchKey = '2019paca_qm55';
		matchTeamKey = '2019paca_qm57_frc2656';
	}
	
	// Find a random team at this event
	
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
			[`/dashboard/driveteam?team_key=${teamKey}`]: 'Drive team dashboard for specific team',
		},
		'scouting.ts': {
			[`/scouting/pit?team_key=${teamKey}`]: 'Pit scouting survey + photo upload',
			[`/scouting/match?key=${matchTeamKey}&alliance=Blue`]: 'Match scouting survey',
			// '/scouting/teampictures': 'Team pictures list (currently broken)',
		},
		'reports.ts': {
			'/reports/alliancestats?teams=frc3260,frc379,frc2053,0,frc2656,frc4085,frc4780': 'show metrics (averages vs. maximums) for individual teams [nominally, to compare alliances]',
			'/reports/allteammetrics': 'show all the metrics for all the teams in single visualization',
			'/reports/finishedmatches': 'shows all the finished matches for the event so far; can get per-match scout data & FIRST data, also individual team scout numbers',
			[`/reports/matchdata?key=${matchKey}`]: 'shows "quantifiable" data for all teams from a particular match',
			[`/reports/matchintel?key=${matchKey}`]: 'shows the detailed FIRST data for a given match, including the "Watch this match on YouTube" link',
			[`/reports/matchmetrics?key=${matchKey}`]: 'show averaged metrics for each alliance',
			'/reports/metricintel?key=totalPieces': 'for a specific metric, show min/avg/var/max for each team, sortable',
			'/reports/metrics': 'show relative values of all the metrics',
			'/reports/metricsranked': 'show the top teams per metric (or "mult" if ties)',
			'/reports/rankings': 'show current event rankings',
			[`/reports/teamdata?team_key=${teamKey}`]: 'shows all the quantifiable data for a given team',
			[`/reports/teamintel?team_key=${teamKey}`]: 'Team intel',
			[`/reports/teamintelhistory?team_key=${teamKey}`]: 'Team intel history',
			[`/reports/teammatchintel?key=${matchTeamKey}`]: 'Shows match scouted data displayed in the same form as collection',
			'/reports/upcoming': 'Upcoming matches all teams',
			[`/reports/upcoming?team_key=${teamKey}`]: 'Upcoming matches specific team',
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
			'/manage/manualdata/matchresults': 'Manually input match results for current event',
		},
		'manage/members.ts': {
			'/manage/members': 'Member management page - Name, subteam, class, role, # years; Sorted by role',
			'/manage/members/passwords': 'Password audit page to check if team-admins and global-admins have set passwords',
			'/manage/members/present': 'Set who is present at current event',			},
		'manage/orgconfig.ts': {
			[`/manage/config/pitsurvey?year=${req.event.year}`]: 'Pit-survey layout config page.',
		},
		'manage/scoutingaudit.ts': {
			'/manage/scoutingaudit': 'Match-scouting audit- Sorted by scouter, Grouped by assignment',
			'/manage/scoutingaudit/comments': 'Match-scouting comments audit- Grouped by scouter, only displays "additional notes" comments',
			'/manage/scoutingaudit/bymatch': 'Match-scouting audit- Sorted by match, Grouped by team',
			'/manage/scoutingaudit/uploads': 'Audit page for students\' photo uploads',
		},
		'manage/assignments.ts': {
			'/manage/assignments': 'Manage pairs and assignments for pit scouting',
			'/manage/assignments/matches': 'Generate match scouting assignments',
			'/manage/assignments/swapmatchscouters': 'Match scouting swap ',
			'/manage/assignments/swappitassignments': 'Swap teams for existing pit scouters',
		},
		'admin/indexadmin.ts': {
			'/admin': 'Admin index page ',
		},
		'admin/externaldata.ts': {
			'/admin/externaldata/events': 'Displays list of events, plus event_keys, for each year.',
			[`/admin/externaldata/matches?eventId=${req.event.key}`]: 'Displays list of matches for a specific ("Non-current") event. (Quite out of date - Might contain "dangerous" code?)',
			'/admin/externaldata/teams': 'List of ALL teams (Note: Very large page)',
		},
	};
	
	res.render('./admin/sitemap', {
		title: 'Site map',
		siteLayout: siteLayout,
	});
	
}));

module.exports = router;