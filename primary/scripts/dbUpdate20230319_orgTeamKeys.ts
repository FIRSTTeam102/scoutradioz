import { MongoClient } from 'mongodb';
import fs from 'fs';
import type { Org } from '../../scoutradioz-types/types';


const dbJson = require('../databases.json');
const tier = 'dev';

((async () => {
    
	const db = (await new MongoClient(dbJson[tier].url).connect()).db(tier);
	
	const orgs = await db.collection('orgs').find({}).toArray() as (Org & {
		team_key?: string;
		team_number?: number;
	})[];
	
	for (let org of orgs) {
		let teamKeys: string[] = [], teamNums: number[] = [];
		if (org.team_key) {
			teamKeys.push(org.team_key);
		}
		if (org.team_number) {
			teamNums.push(org.team_number);
		}
		if (org.team_keys) {
			teamKeys.push(...org.team_keys);
		}
		if (org.team_numbers) {
			teamNums.push(...org.team_numbers);
		}
		let wr = await db.collection<Org>('orgs').updateOne({
			org_key: org.org_key
		}, {
			$unset: {team_key: 1, team_number: 1},
			$set: {
				team_keys: teamKeys,
				team_numbers: teamNums
			}
		});
		console.log(org.org_key, wr);
	}
	console.log('Done');
	process.exit(0);
}))();
