import { MongoClient } from 'mongodb';
import fs from 'fs';


const dbJson = require('../databases.json');
const event_key = '2023paphi';
const org_key = 'frc102';

((async () => {
    
    const dbLocal = (await new MongoClient(dbJson.dev.url).connect()).db('app');
    const dbProd = (await new MongoClient(dbJson.prod.url).connect()).db('prod'); // change dbJson.qa and 'qa' to dbJson.prod and 'prod'

    const oldMatchscouting = await dbProd.collection('matchscouting').find({
        event_key,
        org_key
    }).toArray();
    const oldPitscouting = await dbProd.collection('pitscouting').find({
        event_key,
        org_key
    }).toArray();

    const newMatchscouting = await dbLocal.collection('matchscouting').find({
        event_key,
        org_key
    }).toArray();
    const newPitscouting = await dbLocal.collection('pitscouting').find({
        event_key,
        org_key
    }).toArray();

    console.log('Writing a backup json of the scouting collections we\'re about to delete');
    fs.writeFileSync('./donotcommit-oldMatchScouting.json', JSON.stringify(oldMatchscouting, null, 4), 'utf-8');
    fs.writeFileSync('./donotcommit-oldPitScouting.json', JSON.stringify(oldPitscouting, null, 4), 'utf-8');

    console.log('Deleting scouting data from server');
    let pitRemoveResult = await dbProd.collection('pitscouting').deleteMany({
        event_key,
        org_key
    });
    let matchRemoveResult = await dbProd.collection('matchscouting').deleteMany({
        event_key,
        org_key
    });
    console.log('pit remove result: ', pitRemoveResult);
    console.log('match remove result: ', matchRemoveResult);

    console.log('Inserting data into server');
    let pitAddResult = await dbProd.collection('pitscouting').insertMany(newPitscouting);
    let matchAddResult = await dbProd.collection('matchscouting').insertMany(newMatchscouting);
    console.log('pit add result: ', pitAddResult);
    console.log('match add result: ', matchAddResult);

    process.exit(0);

}))();
