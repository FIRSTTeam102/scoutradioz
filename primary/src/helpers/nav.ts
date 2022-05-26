import Permissions from './permissions';
import type express from 'express';

/**
 * Nav item that's sent to nav.pug.
 */
interface CompiledNavItem {
	label: string;
	href?: string;
	sprite?: string;
	icon?: string;
	submenu?: CompiledNavItem[];
}

type ResolvableValue<T> = T|((req: express.Request, res: express.Response) => T|undefined)

interface NavItem {
	label: ResolvableValue<string>;
	href?: ResolvableValue<string>;
	icon?: ResolvableValue<string>;
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
				if (item.href) {
					compiledItem.href = resolveToValue(item.href, req, res);
				}
				if (item.sprite) {
					compiledItem.sprite = resolveToValue(item.sprite, req, res);
				}
				else if (item.icon) {
					compiledItem.icon = resolveToValue(item.icon, req, res);
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
	 */
	private _navContents: NavItem[] = [
		{
			label: 'Home',
			href: '/home',
			sprite: 'home',
		},
		{
			label: (req, res) => {
				return `Info and Reports: [[${res.locals.eventName}]]`;
			},
			sprite: 'info',
			visible: userLoggedIn,
			submenu: (req, res) => {
				// Submenu for Info and Reports (yeah, it's a bit of a mess)
				let teams = res.locals.teams;
				let arr = [
					{
						label: 'Teams',
						visible: !!(teams && teams[0]),
						submenu: () => {
							if (!teams) return;
							let yearstr = `Complete Statistics for ${new Date().getFullYear()}`;
							let arr = [];
							for (let team of teams) {
								arr.push({
									label: `${team.team_number}: ${team.nickname}`,
									submenu: [
										{label: 'Upcoming Matches', href: '/reports/upcoming?team_key=' + team.key},
										{label: 'Team Statistics', href: '/reports/teamintel?team_key=' + team.key},
										{label: yearstr, href: '/reports/teamintelhistory?team_key=' + team.key},
									]
								});
							}
							return arr;
						}
					},
					{
						label: 'Current Rankings',
						href: '/reports/rankings',
					},
					{
						label: 'Upcoming Matches',
						href: '/reports/upcoming',
					},
					{
						label: 'Completed Matches',
						href: '/reports/finishedmatches',
					},
					{
						label: 'Stats for All Teams',
						href: '/reports/allteammetrics',
					},
					{
						label: 'Export to CSV',
						sprite: 'download',
						submenu: [
							{
								label: `Match scouting data: [[${req.event.name}]]`,
								href: '/reports/exportdata?type=matchscouting',
								sprite: 'download',
							},
							{
								label: `Pit scouting data: [[${req.event.name}]]`,
								href: '/reports/exportdata?type=pitscouting',
								sprite: 'download',
							},
							{
								label: `Match scouting data: [[All of ${req.event.year}]]`,
								href: '/reports/exportdata?type=matchscouting&span=all',
								sprite: 'download',
							},
							{
								label: `Pit scouting data: [[All of ${req.event.year}]]`,
								href: '/reports/exportdata?type=pitscouting&span=all',
								sprite: 'download',
							}
						]
					}
				];
				return arr;
			}
		},
		{
			label: 'Drive Team Dashboard',
			href: '/dashboard/driveteam',
			sprite: 'wheel',
			visible: userLoggedIn
		},
		{
			label: 'Configure report columns',
			href: (req, res) => `/user/preferences/reportcolumns?rdr=${req.fixRedirectURL(req.url.replace(/alert=.*$/g, ''))}`,
			sprite: 'sheet',
			visible: userLoggedIn
		},
		{
			label: 'Scouting',
			href: '/dashboard',
			sprite: 'radio',
			visible: (req, res) => !!req.user && req._user.role.access_level >= Permissions.ACCESS_SCOUTER,
			submenu: [
				{
					label: 'Pit Scouting',
					href: '/dashboard/pits'
				},
				{
					label: 'Match Scouting',
					href: '/dashboard/matches',
				},
				{
					label: 'Alliance Selection',
					href: '/dashboard/allianceselection',
				}
			]
		},
		// Org Management submenu
		{
			label: (req, res) => `Manage: [[${req._user.org.nickname}]]`,
			href: '/manage',
			sprite: 'settings',
			visible: (req, res) => !!req.user && req.user.role.access_level >= Permissions.ACCESS_TEAM_ADMIN,
			submenu: [
				{
					label: 'Members',
					submenu: [
						{
							label: 'Member List',
							href: '/manage/members'
						},
						{
							label: 'Audit/Reset Member Passwords',
							href: '/manage/members/passwords'
						},
					]
				},
				{
					label: (req, res) => req.event ? `Scouters: [[${req.event.name}]]` : 'Scouters',
					submenu: [
						{
							label: 'Scouting Audit',
							href: '/manage/scoutingaudit'
						},
						{
							label: 'Scouting Assignments',
							href: '/manage/scoutingpairs'
						},
						{
							label: 'Swap in/out Match Scouts',
							href: '/manage/scoutingpairs/swapmembers'
						},
						{
							label: 'Swap Pit Scouting assignments',
							href: '/manage/scoutingpairs/swappitassignments'
						},
						{
							label: 'Set Present',
							href: '/manage/members/present'
						},
					]
				},
				{
					label: (req, res) => req.event ? `Event Data: [[${req.event.name}]]` : 'Event Data',
					submenu: [
						{
							label: 'Matches',
							href: '/manage/currentevent/matches'
						},
						{
							label: 'Alliance Selection Data',
							href: '/manage/allianceselection'
						},
						{
							label: 'Update List of Teams',
							href: '/manage/currentevent/getcurrentteams'
						},
						{
							label: 'Recalculate Derived Metrics',
							href: '/admin/sync/recalcderived'
						},
					]
				}
			]
		},
		{
			label: 'Admin',
			href: '/admin',
			sprite: 'scoutradioz',
			visible: (req, res) => !!req.user && req.user.role.access_level >= Permissions.ACCESS_GLOBAL_ADMIN,
		},
		// User when signed in
		{
			label: (req, res) => `User: [[${req.user ? req.user.name : ''}]]`,
			sprite: 'user',
			visible: (req, res) => !!req.user && req.user.name !== 'default_user',
			submenu: [
				{
					label: 'Log Out',
					href: '/user/logout',
				},
				{
					label: 'Change Password',
					href: '/user/changepassword',
				}
			]
		},
		// User login when not signed in
		{
			label: (req, res) => `Log In: [[${req._user.org.nickname}]]`,
			sprite: 'user',
			visible: (req, res) => !!req.user && req._user.name === 'default_user',
			href: '/user/login'
		},
		// Change org
		{
			label: 'Change Organization',
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
			label: 'Need help? Check our wiki!',
			sprite: 'help',
			href: 'https://github.com/FIRSTTeam102/ScoringApp-Serverless/wiki'
		}
	];
	
	getNavContents() {
		return this._navContents;
	}
}

const navHelpers = module.exports = new NavHelpers();
export default navHelpers;