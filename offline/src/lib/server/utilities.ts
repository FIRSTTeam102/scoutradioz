import utilities from '@firstteam102/scoutradioz-utilities';
import fs from 'fs';
import dbJSON from '$lib/../databases.json';
import { env } from '$env/dynamic/private';

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
	stringifyObjectIDs: true,
	mongoClientOptions: mongoClientOptions
});

// @ts-ignore - change this later
utilities.refreshTier(undefined, undefined, env.TIER); 

export default utilities;