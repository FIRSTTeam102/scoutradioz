const express = require('express');
const logger = require('log4js').getLogger();
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const router = express.Router();

router.all('/*', wrap(async (req, res, next) => {
	//Require global-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_GLOBAL_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	
	res.render('./admin/admindashboard', { 
		title: `Administration`
	});
	
}));

router.get('/sitemap', wrap(async (req, res) => {
	
	var siteLayout = {
		'index.js': {
			'/': 'Pick organization',
			'/home': 'home'
		},
		'user.js': {
			'/user/login': 'Login to org',
			'/user/changepassword': 'Change password',
			'/user/logout': 'Log out',
		},
		'dashboard.js': {
			'/dashboard': 'Exclusive to \"assigned\" scouters- Pit/match scouting assignments',
			'/dashboard/unassigned': 'Exclusive to \'unassigned\" scouters- Provides links to \'one-off\" pit/match scouting',
			'/dashboard/allianceselection': 'Alliance/team \"pick-list\", to follow along with the alliance selection process',
			'/dashboard/pits': 'List of teams for pit scouting, plus scouter assignments',
			'/dashboard/matches': 'List of upcoming matches, plus scouter assignments to each team',
			'/dashboard/driveteam': 'Drive team dashboard: Shows intel for upcoming match',
			'/dashboard/driveteam?team_key=frc3201': 'Drive team dashboard for specific team',
		},
		'scouting.js': {
			'/scouting/pit?team=frc102': 'Pit scouting survey + photo upload',
			'/scouting/match?key=2019paca_qm57_frc2656&alliance=Blue': 'Match scouting survey',
			'/scouting/teampictures': 'Team pictures list (currently broken)',
		},
		'reports.js': {
			'/reports/alliancestats?teams=frc3260,frc379,frc2053,0,frc2656,frc4085,frc4780': 'show metrics (averages vs. maximums) for individual teams [nominally, to compare alliances]',
			'/reports/allteammetrics': 'show all the metrics for all the teams in single visualization',
			'/reports/choosecolumns': 'Choose report columns',
			'/reports/finishedmatches': 'shows all the finished matches for the event so far; can get per-match scout data & FIRST data, also individual team scout numbers',
			'/reports/matchdata?key=2019paca_qm55': 'shows \"quantifiable\" data for all teams from a particular match',
			'/reports/matchintel?key=2019paca_qm55': 'shows the detailed FIRST data for a given match, including the \"Watch this match on YouTube\" link',
			'/reports/matchmetrics?key=2019paca_qm57': 'show averaged metrics for each alliance',
			'/reports/metricintel?key=totalPieces': 'for a specific metric, show min/avg/var/max for each team, sortable',
			'/reports/metrics': 'show relative values of all the metrics',
			'/reports/metricsranked': 'show the top teams per metric (or \"mult\" if ties)',
			'/reports/rankings': 'show current event rankings',
			'/reports/teamdata?team_key=frc102': 'shows all the quantifiable data for a given team',
			'/reports/teamintel?team_key=frc1708': 'Team intel',
			'/reports/teamintelhistory?team_key=frc102': 'Team intel history',
			'/reports/teammatchintel?team_key=2019paca_qm55_frc4027': 'Shows match scouted data displayed in the same form as collection',
			'/reports/upcoming': 'Upcoming matches all teams',
			'/reports/upcoming?team_key=frc1708': 'Upcoming matches specific team',
		},
		'manage/indexmgmt.js': {
			'/manage': 'Main org-management page',
		},
		'manage/allianceselection.js': {
			'/allianceselection': 'manage/allianceselection',
		},
		'manage/currentevent.js': {
			'/manage/currentevent/matches': '\"See matches for current event\"- (Legacy) Manual match-updating buttons (+ data aggregation?)',
			'/manage/currentevent/getcurrentteams': '\"Update list of current teams\"- Updates team_keys list for the current event',
			'': 'Note: There are plenty of POST urls in /currentevent for /matches links',
		},
		'manage/manualdata.js': {
			'/manage/manualdata/teams': 'Manually input teams for current event (Disabled; Not updated for 2020 event/teams data structure yet)',
			'/manage/manualdata/matchschedule': 'Manually input match schedule for current event',
			'/manage/manualdata/matches': 'Manually input match results for current event',
		},
		'manage/members.js': {
			'/manage/members': 'Member management page - Name, subteam, class, role, # years; Sorted by role',
			'/manage/members/passwords': 'Password audit page to check if team-admins and global-admins have set passwords',
			'/manage/members/present': 'Set who is present at current event',			},
		'manage/orgconfig.js': {
			'/manage/config/pitsurvey?year=2019': 'Pit-survey layout config page.',
		},
		'manage/scoutingaudit.js': {
			'/manage/scoutingaudit': 'Match-scouting audit- Sorted by scouter, Grouped by assignment',
			'/manage/scoutingaudit/comments': 'Match-scouting comments audit- Grouped by scouter, only displays \"additional notes\" comments',
			'/manage/scoutingaudit/bymatch': 'Match-scouting audit- Sorted by match, Grouped by team',
			'/manage/scoutingaudit/uploads': 'Audit page for students\' photo uploads',
		},
		'manage/scoutingpairs.js': {
			'/manage/scoutingpairs': 'Manage pairs for pit scouting and assignments for match scouting',
			'/manage/scoutingpairs/swapmembers': 'Match scouting swap ',
		},
		'admin/indexadmin.js': {
			'/admin': 'Admin index page ',
		},
		'admin/externaldata.js': {
			'/admin/externaldata/events': 'Displays list of events, plus event_keys, for each year.',
			'/admin/externaldata/matches?eventId=2020week0': 'Displays list of matches for a specific (\"Non-current\") event. (Quite out of date - Might contain \"dangerous\" code?)',
			'/admin/externaldata/teams': 'List of ALL teams (Note: Very large page)',
		},
	}
	
	res.render('./admin/sitemap', {
		title: 'Site map',
		siteLayout: siteLayout,
	});
	
}));

module.exports = router;