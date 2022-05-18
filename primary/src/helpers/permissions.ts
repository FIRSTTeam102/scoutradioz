// JL note: To get around process.env.X being 'possibly undefined'...

// TODO: Permissions overhaul using symbols for each permission and roles having a list of permissions,
//	instead of just an access-level number :)

const Permissions = {
	// Standard viewer. Can read reports and upcoming pages.
	ACCESS_VIEWER: 0,
	// Team scouter. Can access scouting-related pages.
	ACCESS_SCOUTER: 1,
	// Manager of scouters. Can manage pairs, scouting audit, set present, set event, set "current" event, reset passwords, create users, and possibly more.
	ACCESS_TEAM_ADMIN: 2,
	// Global Scoutradioz administrator. Able to manage multiple organizations.
	ACCESS_GLOBAL_ADMIN: 3
};

export default Permissions;