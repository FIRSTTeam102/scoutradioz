const navHelpers = module.exports = {};

function resolveToValue(property, /**/) {
	if (typeof property == 'function') {
		let args = Array.prototype.slice.call(arguments, 1);
		return property(...args);
	}
	else return property;
}

navHelpers.compileNavcontents = function(navcontents, req, res) {
	let ret = [];
	
	for (let item of navcontents) {
		
		// If the item is not visible, don't go through the work of resolving it or its submenu
		// REMEMBER!!! Make sure all "visible" functions return true or false. 
		// 	Use !!(cond) if testing for existence of a variable!
		let visible = resolveToValue(item.visible, req, res);
		if (visible !== false) {
			let compiledItem = {
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
					compiledItem.submenu = navHelpers.compileNavcontents(submenu, req, res);
				}
			}
			ret.push(compiledItem);
		}
	}
	
	return ret;
};

function userLoggedIn(req, res) {
	return !!req.user;
}

navHelpers.getNavContents = () => {
	return [
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
								label: 'Export match scouting data',
								href: '/reports/exportdata?type=matchscouting',
								sprite: 'download',
							},
							{
								label: 'Export pit scouting data',
								href: '/reports/exportdata?type=pitscouting',
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
			visible: (req, res) => !!req.user && req.user.role.access_level >= process.env.ACCESS_SCOUTER,
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
			label: (req, res) => `Manage: [[${req.user.org.nickname}]]`,
			href: '/manage',
			sprite: 'settings',
			visible: (req, res) => !!req.user && req.user.role.access_level >= process.env.ACCESS_TEAM_ADMIN,
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
			visible: (req, res) => !!req.user && req.user.role.access_level >= process.env.ACCESS_GLOBAL_ADMIN,
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
			label: (req, res) => `Log In: [[${req.user.org.nickname}]]`,
			sprite: 'user',
			visible: (req, res) => !!req.user && req.user.name === 'default_user',
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
};