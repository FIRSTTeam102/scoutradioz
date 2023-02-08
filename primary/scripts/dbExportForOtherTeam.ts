import type { Db} from 'mongodb';
import { MongoClient } from 'mongodb';
import { spawn } from 'child_process';
import { join } from 'path';
import { createWriteStream, existsSync, fstat, rmdirSync } from 'fs';
import os from 'os';

const archiver = require('archiver');

process.env.TIER = 'dev';

const tmpdir = os.tmpdir();

if (!(process.argv.includes('--orgs'))) {
	console.log('ts-node dbExportForOtherTeam.ts --orgs <orgs>, e.g. --orgs frc102 frc41');
	process.exit(1);
}
let idx = process.argv.indexOf('--orgs');
const orgsToKeep = process.argv.slice(idx + 1);

console.log(`Exporting for the following orgs: ${orgsToKeep.join(', ')}`);

function doDumpAndCopy() {
	
	return new Promise((resolve) => {
	
		console.log('Performing mongodump from app');
		const args = `--db app --out=${join(tmpdir, 'mongodump')}`.split(' ');
		const mongodump = spawn('mongodump', args);
		
		mongodump.stdout.on('data', function (data) {
			process.stdout.write(data);
		});
		mongodump.stderr.on('data', function (data) {
			process.stdout.write(data);
		});
		mongodump.on('exit', function (code) {
			console.log('mongodump exited with code ' + code);
			
			console.log('Performing mongorestore to export');
			const args = `--db export ${join(tmpdir, 'mongodump', 'app')}`.split(' ');
			const mongorestore = spawn('mongorestore', args);
			
			mongorestore.stdout.on('data', function (data) {
				process.stdout.write(data);
			});
			mongorestore.stderr.on('data', function (data) {
				process.stdout.write(data);
			});
			mongorestore.on('exit', function (code) {
				console.log('mongorestore exited with code ' + code);
				
				console.log('Removing temporary files');
				
				resolve(undefined);
			});
			
		});
	});
}

function doConnect(): Promise<{dbApp: Db, dbExport: Db}> {
	console.log('Attempting to connect');
	return new Promise((resolve, reject) => {
		// Connect to db
		MongoClient.connect('mongodb://127.0.0.1:27017/app', (err, client) => {
			if (!client) return reject(err);
			const dbApp = client.db();
			MongoClient.connect('mongodb://127.0.0.1:27017/export', (err, client) => {
				
				if (!client) return reject(err);
				console.log('Connected');
				const dbExport = client.db();
				
				resolve({dbApp, dbExport});
			});
		});
	});
}

function doExportAndArchive() {
	return new Promise((resolve) => {
		
		
		console.log('Performing mongodump from export');
		const args = `--db export --out=${join(tmpdir, 'mongodump')}`.split(' ');
		const mongodump = spawn('mongodump', args);
		
		mongodump.stdout.on('data', function (data) {
			process.stdout.write(data);
		});
		mongodump.stderr.on('data', function (data) {
			process.stdout.write(data);
		});
		mongodump.on('exit', function (code) {
			console.log('mongodump exited with code ' + code);
			
			const exportDir = join(tmpdir, 'mongodump', 'export');
			if (!existsSync(exportDir)) {
				console.log(`Expected mongodump to output to ${exportDir} but it does not exist!`);
				process.exit(1);
			}
			
			const archive = archiver('zip');
			const outPath = join(__dirname, 'db_export.zip');
			const output = createWriteStream(outPath);
			
			output.on('close', function () {
				console.log(`Created export at ${outPath}`);
				resolve(undefined);
			});
			
			// good practice to catch this error explicitly
			archive.on('error', function(err) {
				throw err;
			});
			
			// pipe archive data to the file
			archive.pipe(output);
			
			archive.directory(exportDir, false);
			
			archive.finalize();
			
		});
	});
}

(async () => {
	
	const {dbApp, dbExport} = await doConnect();
	
	console.log('Dropping database export');
	dbExport.dropDatabase();
	
	await doDumpAndCopy();
	
	// Drop matchscouting, pitscouting, scoutingpairs, sessions, uploads, and users
	console.log('Dropping cols with PII (and orgs)');
	dbExport.dropCollection('matchscouting');
	dbExport.dropCollection('pitscouting');
	dbExport.dropCollection('scoutingpairs');
	dbExport.dropCollection('sessions');
	dbExport.dropCollection('uploads');
	dbExport.dropCollection('users');
	dbExport.dropCollection('passwords'); 
	dbExport.dropCollection('orgs');
	
	console.log('Caching data from the requested orgs');
	
	const orgKeyInSpecified = {org_key: {$in: orgsToKeep}};
	
	const orgs = await dbApp.collection('orgs').find(orgKeyInSpecified).toArray();
	const matchscouting = await dbApp.collection('matchscouting').find(orgKeyInSpecified).toArray();
	const pitscouting = await await dbApp.collection('pitscouting').find(orgKeyInSpecified).toArray();
	const scoutingpairs = await dbApp.collection('scoutingpairs').find(orgKeyInSpecified).toArray();
	const uploads = await dbApp.collection('uploads').find(orgKeyInSpecified).toArray();
	const users = await dbApp.collection('users').find(orgKeyInSpecified).toArray();
	
	console.log(`matchscouting: ${matchscouting.length} pitscouting: ${pitscouting.length} scoutingpairs: ${scoutingpairs.length} uploads: ${uploads.length} users: ${users.length}`);
	
	console.log('Inserting into the db export');
	
	if (orgs.length > 0) await dbExport.collection('orgs').insertMany(orgs);
	if (matchscouting.length > 0) await dbExport.collection('matchscouting').insertMany(matchscouting);
	if (pitscouting.length > 0) await dbExport.collection('pitscouting').insertMany(pitscouting);
	if (scoutingpairs.length > 0) await dbExport.collection('scoutingpairs').insertMany(scoutingpairs);
	if (uploads.length > 0) await dbExport.collection('uploads').insertMany(uploads);
	if (users.length > 0) await dbExport.collection('users').insertMany(users);
	
	await doExportAndArchive();
	
	console.log('Cleaning up temporary files');
	rmdirSync(join(tmpdir, 'mongodump'), {recursive: true});
	
	process.exit(1);
	
})();