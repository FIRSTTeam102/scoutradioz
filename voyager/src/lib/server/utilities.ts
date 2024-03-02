import utilities from 'scoutradioz-utilities';
import dbJSON from '$lib/../databases.json';
import { env } from '$env/dynamic/private';

console.log(`Environment variables: TIER=${env.TIER}`);
if (!env.TIER) {
	console.error('env.TIER not defined! Please edit voyager/.env and set the TIER environment variable (preferrably to "dev").');
	process.exit(1);
}

let mongoClientOptions = {};
// JL note: I find myself often forgetting to run mongod in the background. Setting a low 
// 	server selection timeout will help remind me/us that the server is not running.
if (env.TIER === 'dev') {
	mongoClientOptions = {
		connectTimeoutMS: 1000,
		serverSelectionTimeoutMS: 1000,
	}
}

utilities.config(dbJSON, {
	cache: {
		enable: true,
		maxAge: 30,
	},
	debug: (env.UTILITIES_DEBUG === 'true'),
	// ObjectIDs result in an error "Data returned from `load` while rendering / is not serializable: Cannot stringify arbitrary non-POJOs (data.user._id)"
	// JL TODO: (note 2024-02-02): current stringifyObjectIds implementation is bork.
	// 	Dates get turned into strings due to the JSON-parse-JSON-stringify method.
	// stringifyObjectIDs: true,
	mongoClientOptions: mongoClientOptions,
	schemasWithNumberIds: ['users'],
});

utilities.refreshTier(env.TIER);

export default utilities;
