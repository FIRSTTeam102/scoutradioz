import utilities from 'scoutradioz-utilities';
import fs from 'fs';
import dbJSON from '$lib/../databases.json';
import { env } from '$env/dynamic/private';
import dotenv from 'dotenv';

console.log(`Environment variables: tier=${env.TIER}`);

// hacky temporary fix 
if (env.TIER) {
	// JL note: also a dumb temporary fix i need to figure out a less janky solution
	process.env.TIER = env.TIER;
}
else {
	dotenv.config();
}

let mongoClientOptions = {};
// JL note: I find myself often forgetting to run mongod in the background. Setting a low 
// 	server selection timeout will help remind me/us that the server is not running.
if (process.env.TIER === 'dev') {
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
utilities.refreshTier(); 

export default utilities;