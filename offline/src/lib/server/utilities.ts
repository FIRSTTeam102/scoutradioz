import utilities from '@firstteam102/scoutradioz-utilities';
import fs from 'fs';
import dbJSON from '$lib/../databases.json'

utilities.config(dbJSON, {
	cache: {
		enable: true,
		maxAge: 30,
	},
	debug: (process.env.UTILITIES_DEBUG === 'true'),
	// ObjectIDs result in an error "Data returned from `load` while rendering / is not serializable: Cannot stringify arbitrary non-POJOs (data.user._id)"
	stringifyObjectIDs: true, 
});

// @ts-ignore  - change this later
utilities.refreshTier(); 

export default utilities;