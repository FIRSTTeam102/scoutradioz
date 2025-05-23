import Permissions from './permissions';
import type express from 'express';

/**
 * Nav item that's sent to layout.pug.
 */
interface CompiledNavItem {
	label: string;
	href?: string;
	sprite?: string;
	submenu?: CompiledNavItem[];
}

type ResolvableValue<T> = T|((req: express.Request, res: express.Response) => T|undefined)

interface NavItem {
	label: ResolvableValue<string>;
	href?: ResolvableValue<string>;
	sprite?: ResolvableValue<string>;
	visible?: ResolvableValue<boolean>;
	submenu?: ResolvableValue<NavItem[]>;
}

function resolveToValue(...args: unknown[]) {
	let property = args[0];
	if (typeof property == 'function') {
		let params = Array.prototype.slice.call(args, 1);
		return property(...params);
	}
	else return property;
}

function userLoggedIn(req: express.Request) {
	return !!req.user;
}

class NavHelpers {
	compileNavcontents(navcontents: NavItem[], req: express.Request, res: express.Response) {
		let ret = [];
		
		for (let item of navcontents) {
			
			// If the item is not visible, don't go through the work of resolving it or its submenu
			// REMEMBER!!! Make sure all "visible" functions return true or false. 
			// 	Use !!(cond) if testing for existence of a variable!
			let visible = resolveToValue(item.visible, req, res);
			if (visible !== false) {
				let compiledItem: CompiledNavItem = {
					label: resolveToValue(item.label, req, res),
				};
				if (compiledItem.label.startsWith('!')) {
					compiledItem.label = req.msg(compiledItem.label.substring(1));
				}
				if (item.href) {
					compiledItem.href = resolveToValue(item.href, req, res);
				}
				if (item.sprite) {
					compiledItem.sprite = resolveToValue(item.sprite, req, res);
				}
				if (item.submenu) {
					//recursively solve submenu
					let submenu = resolveToValue(item.submenu, req, res);
					if (submenu) {
						compiledItem.submenu = this.compileNavcontents(submenu, req, res);
					}
				}
				ret.push(compiledItem);
			}
		}
		
		return ret;
	}
	
	/**
	 * Navigation contents that get compiled at runtime, depending on the logged-in user.
	 * Labels starting with ! will use i18n
	 */
	private _navContents: NavItem[] = [
		{
			label: '!layout.nav.home',
			href: '/home',
			sprite: 'home',
		},
		{
			label: (req, res) => req.msg('layout.nav.reports.main', {event: res.locals.eventName}),
			sprite: 'info',
			visible: userLoggedIn,
			submenu: (req, res) => {
				// Submenu for Info and Reports (yeah, it's a bit of a mess)
				let teams = res.locals.teams;
				let arr = [
					{
						label: '!layout.nav.reports.teams',
						visible: !!(teams && teams[0]),
						submenu: () => {
							if (!teams) return;
							let arr = [];
							for (let team of teams) {
								arr.push({
									label: req.msg('layout.nav.reports.teamList', {number: team.team_number, name: team.nickname}),
									submenu: [
										{label: '!reports.upcomingMatches', href: '/reports/upcoming?team_key=' + team.key},
										{label: '!layout.nav.reports.teamStats', href: '/reports/teamintel?team_key=' + team.key},
										{label: req.msg('layout.nav.reports.yearStats', {year: req.event.year}), href: '/reports/teamintelhistory?team_key=' + team.key},
									]
								});
							}
							return arr;
						}
					},
					{
						label: '!reports.currentRankings.titleShort',
						href: '/reports/rankings',
					},
					{
						label: '!reports.upcomingMatches',
						href: '/reports/upcoming',
					},
					{
						label: '!reports.completedMatches',
						href: '/reports/finishedmatches',
					},
					{
						label: '!reports.allTeamMetricsTitle',
						href: '/reports/allteammetrics',
					},
					{
						label: '!reports.browsePastEvents',
						href: '/reports/browseevents',
					},
					{
						label: '!layout.nav.reports.export.main',
						sprite: 'download',
						submenu: [
							{
								label: req.msg('layout.nav.reports.export.match', {event: req.event.name}),
								href: '/reports/exportdata?type=matchscouting',
								sprite: 'download',
							},
							{
								label: req.msg('layout.nav.reports.export.pit', {event: req.event.name}),
								href: '/reports/exportdata?type=pitscouting',
								sprite: 'download',
							},
							{
								label: req.msg('layout.nav.reports.export.matchAll', {year: req.event.year}),
								href: '/reports/exportdata?type=matchscouting&span=all',
								sprite: 'download',
							},
							{
								label: req.msg('layout.nav.reports.export.pitAll', {year: req.event.year}),
								href: '/reports/exportdata?type=pitscouting&span=all',
								sprite: 'download',
							},
							{
								label: req.msg('layout.nav.reports.export.photos', {year: req.event.year}),
								href: '/reports/exportimages',
								sprite: 'download',
							},
						]
					}
				];
				return arr;
			}
		},
		{
			label: '!driveDashboard.title',
			href: '/dashboard/driveteam',
			sprite: 'wheel',
			visible: userLoggedIn
		},
		{
			label: '!user.customizereports',
			sprite: 'sheet',
			visible: userLoggedIn,
			submenu: [
				{
					label: '!user.reportcolumns.title',
					href: (req, res) => `/user/preferences/reportcolumns?rdr=${req.fixRedirectURL(req.url.replace(/alert=.*$/g, ''))}`,
				},
				{
					label:'!user.heatmapcolors.title',
					href: (req, res) => `/user/preferences/heatmapcolors?rdr=${req.fixRedirectURL(req.url.replace(/alert=.*$/g, ''))}`
				}
			]
		},
		{
			label: '!layout.nav.scouting',
			href: '/dashboard',
			sprite: 'radio',
			visible: (req, res) => !!req.user && req._user.role.access_level >= Permissions.ACCESS_SCOUTER,
			submenu: [
				{
					label: '!scouting.pit',
					href: '/dashboard/pits'
				},
				{
					label: '!scouting.match',
					href: '/dashboard/matches',
				},
				{
					label: '!allianceselection.title',
					href: '/dashboard/allianceselection',
				},
				{
					label: '!home.formDemos',
					submenu: [
						{
							label: '!home.matchFormDemo',
							href: '/scouting/match?key=2024srdemo_qm99_frc999999&alliance=Blue'
						},
						{
							label: '!home.pitFormDemo',
							href: '/scouting/pit?team_key=frc999999'
						},
					]
				}
			]
		},
		// Org Management submenu
		{
			label: (req, res) => req.msg('layout.nav.manage.main', {org: req._user.org.nickname}),
			href: '/manage',
			sprite: 'settings',
			visible: (req, res) => !!req.user && req.user.role.access_level >= Permissions.ACCESS_TEAM_ADMIN,
			submenu: [
				// Manage members
				{
					label: '!layout.nav.manage.members.main',
					submenu: [
						{
							label: '!layout.nav.manage.members.list',
							href: '/manage/members'
						},
						{
							label: '!layout.nav.manage.members.passwords',
							href: '/manage/members/passwords'
						},
					]
				},
				// Manage scouters
				{
					label: (req, res) => req.event ? req.msg('layout.nav.manage.scouters.event', {event: req.event.name}) : '!layout.nav.manage.scouters.main',
					submenu: [
						{
							label: '!layout.nav.manage.scouters.audit',
							href: '/manage/scoutingaudit'
						},
						{
							label: '!manage.assignments.pit',
							href: '/manage/assignments'
						},
						{
							label: '!manage.assignments.match',
							href: '/manage/assignments/matches'
						},
						{
							label: '!manage.assignments.swapMatchAssignments',
							href: '/manage/assignments/swapmatchscouters'
						},
						{
							label: '!manage.assignments.swapPitAssignments',
							href: '/manage/assignments/swappitassignments'
						},
						{
							label: '!layout.nav.manage.scouters.present',
							href: '/manage/members/present'
						},
					]
				},
				// Manage event data
				{
					label: (req, res) => req.event ? req.msg('manage.event.eventData', {event: req.event.name}) : '!manage.event.main',
					submenu: [
						{
							label: '!manage.event.matches',
							href: '/manage/currentevent/matches'
						},
						{
							label: '!manage.event.allianceSelection',
							href: '/manage/allianceselection'
						},
						{
							label: '!manage.event.getCurrentTeams',
							href: '/manage/currentevent/getcurrentteams'
						},
						{
							label: '!manage.event.recalcDerived',
							href: '/admin/sync/recalcderived'
						},
						{
							label: '!manage.event.editTeams', 
							href: '/manage/manualdata/teams',
							sprite: 'edit',
						},
						{
							label: '!manage.event.editMatchSchedule',
							href: '/manage/manualdata/matchschedule',
							sprite: 'edit',
						},
						{
							label: '!manage.event.editMatchResults',
							href: '/manage/manualdata/matchresults',
							sprite: 'edit',
						},
					]
				},
				{
					label: (req, res) => req.msg('manage.event.setCurrentEvent'),
					href: '/manage#setCurrentEvent',
					// sprite: 'first',
				}
			]
		},
		{
			label: '!layout.nav.admin',
			href: '/admin',
			sprite: 'scoutradioz',
			visible: (req, res) => !!req.user && req.user.role.access_level >= Permissions.ACCESS_GLOBAL_ADMIN,
		},
		// User when signed in
		{
			label: (req, res) => req.user ? req.msg('layout.nav.user.main', {user: req.user.name}) : '!layout.nav.user.fallback',
			sprite: 'user',
			visible: (req, res) => !!req.user && req.user.name !== 'default_user',
			submenu: [
				{
					label: '!layout.nav.user.logout',
					href: '/user/logout',
				},
				{
					label: '!user.changepassword',
					href: '/user/changepassword',
				}
			]
		},
		// User login when not signed in
		{
			label: (req, res) => req.msg('layout.nav.user.login', {org: req._user.org.nickname}),
			sprite: 'user',
			visible: (req, res) => !!req.user && req._user.name === 'default_user',
			href: '/user/login'
		},
		{
			label: '!layout.nav.voyager',
			sprite: 'voyager',
			href: 'https://voyager.scoutradioz.com'
		},
		// Change org
		{
			label: '!layout.nav.user.switchorg',
			sprite: 'org',
			visible: userLoggedIn,
			href: '/user/switchorg'
		},
		// {
		// 	label: (req, res) => `Org: [[${req.user.org.nickname}]]`,
		// 	sprite: 'org',
		// 	visible: userLoggedIn,
		// 	submenu: [
		// 		{
		// 			label: 'Change Organization',
		// 			href: '/user/switchorg',
		// 		},
		// 		{
		// 			label: 'Log In',
		// 			href: '/user/login',
		// 			visible: (req, res) => req.user.name === 'default_user',
		// 		}
		// 	]
		// },
		{
			label: '!layout.nav.help',
			sprite: 'help',
			// 2024-02-19, M.O'C: Changing to the team MediaWiki
			//href: 'https://github.com/FIRSTTeam102/scoutradioz/wiki' -> moved GitHub link to bottom of menu [layout.pug]
			href: 'https://wiki.team102.org/scoutradioz/start'
		},
		{
			label: '!layout.nav.thanks',
			href: '/thankyou',
			sprite: 'heart'
		}
	];
	
	getNavContents() {
		return this._navContents;
	}
}

const navHelpers = module.exports = new NavHelpers();
export default navHelpers;