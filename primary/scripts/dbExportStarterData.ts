// JL note: this script is put in primary simply because of the mongodb dependency. Otherwise, it would belong in ../scripts
import type { AnyBulkWriteOperation, Document as MongoDocument, Db } from 'mongodb';
import { MongoClient } from 'mongodb';
import { spawn } from 'child_process';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import { createWriteStream, existsSync, fstat, rmdirSync } from 'fs';
import os from 'os';
import type { OrgClass, OrgSubteam, User } from 'scoutradioz-types';

// Fake names from a random name generator site, to scrub 
const fakeNames = [ 'Blayne Mccallister', 'Karol Mcdade', 'Karon Wei', 'Julieta Wesley', 'Bracha Himes', 'Troy Copeland', 'Roshan Tetreault', 'Annastasia Schaaf', 'Yair Alarcon', 'Ravi Overman', 'Osias Mcandrew', 'Katherin Burgin', 'Valerie Blair', 'Taraji Hooks', 'Nori Vest', 'Kash Buckley', 'Siobhan Phillip', 'Matheo Wynne', 'Blake Gould', 'Rozlyn Hudak', 'Darla Sebastian', 'Tylin Shetler', 'Shalom Haggard', 'Neha Ordaz', 'Esty Sheehy', 'Derrion Gambill', 'Jermiah Shrader', 'Lakai Chauvin', 'Judd Tisdale', 'Everette Ackerson', 'Marilyn Herring', 'Aashi Heintz', 'Mariela Cyr', 'Yazmine Devoe', 'Chad Hagan', 'Jayshawn Mao', 'Breonna Smitherman', 'Natasha Ziegler', 'Zenaida Huckaby', 'Alianna Richey', 'Charliee Ping', 'Makenley Zell', 'Susan Ma', 'Poppy Cagle', 'Maiah Tobar', 'Destin Birch', 'Bradley Blakley', 'Aarin Dewald', 'Zamaya Souders', 'Trevion Goncalves', 'Tucker Schwartz', 'Zacchaeus Lupo', 'Navy Grantham', 'Trevon Carreon', 'Jetta Arambula', 'Hawk Neubauer', 'Wynn Kuhns', 'Coral Aaron', 'Verna Utz', 'Ceasar Burlingame', 'Lillyann Alves', 'Brenleigh Kirkham', 'Emmy Nicholas', 'Amarii Stedman', 'Maxton Christiansen', 'Tiger Husband', 'Fabricio Reinhold', 'Raymundo Terrazas', 'Haider Leiva', 'Aneesh Rideout', 'Yetzali Moynihan', 'Tenlee Halvorsen', 'Khai Vines', 'Aleesa Kellett', 'Marygrace Huhn', 'Janely Mcmichael', 'Brynley Leone', 'Xitlaly Eggert', 'Elynn Galli', 'Hafsah Hoehn', 'Mairead Dry', 'Murphy Hargis', 'Treasure Fagan', 'Rianna Tseng', 'Adysen Kalinowski', 'Morris Mundy', 'Beatrix Anders', 'Neyland Houlihan', 'Gwendolyn Michael', 'Shayla Temple', 'Yelena Kight', 'Malakhi Luong', 'Becket Baptista', 'Krislynn Grass', 'Jonatan Mcgarry', 'Effie Bedell', 'Berenice Runyan', 'Josefina Munguia', 'Hayes Bradberry', 'Lillyan Denham', 'Alasdair Towers', 'Brooks Ung', 'Casimir Eklund', 'Micah Renteria', 'Maliya Choate', 'Kayde Given', 'Rishaan Bills', 'Sterling Parisi', 'Persephone Humphreys', 'Tomas Piper', 'Makinley Close', 'Joselin Grisham', 'Eira Borchardt', 'Adelaide Bridges', 'Payden Bisson', 'Aviana Simons', 'Raygan Oster', 'Addalynn Doan', 'Eleazar Strand', 'Janyah Nair', 'Hadley Tarango', 'Ellowyn Boozer', 'Jibril Claxton', 'Dahlia Mays', 'Adisyn Buckles', 'Freyja Ponder', 'Terence Haugen', 'Yulian Mulvihill', 'Marcello Stock', 'Oz Haddix', 'Kenzi Ragsdale', 'Viola Coughlin', 'Deisy Bolduc', 'Jermani Sudduth', 'Adhrit Bergquist', 'Taym Motes', 'Starla Gragg', 'Willard Beane', 'Alanie Claypool', 'Santino Herron', 'Valentin Hamlin', 'Taven Berndt', 'Vasilios Moffat', 'Aron Lovell', 'Topanga Labbe', 'Anilah Willhite', 'Harley Rosales', 'Rome Kozlowski', 'Earnest Gribble', 'Aizen Sherrod', 'Jaelyn Knowles', 'Milo Summers', 'Hamilton Alcantara', 'Antonino Lawyer', 'Cody Gu', 'Sebastian Turner', 'Lake Marler', 'Tehila Harnish', 'Isha Bruns', 'Briseyda Bristow', 'Kolt Meador', 'Sirena Hom', 'Yamileth Hoyt', 'Corrine Pilgrim', 'Caelum Luedtke', 'Sterling Gorman', 'Bladen Cofield', 'Sammi Pumphrey', 'Kent Covarrubias', 'Viana Towner', 'Mamadou Winfrey', 'Daylin Yeh', 'Jahari Marrs', 'Oliviah Harrold', 'Jaelle Trigg', 'Bailee Dillard', 'Arley Kaczmarek', 'Corra Kass', 'Cobie Encinas', 'Robinson Ramires', 'Kyng Ruggiero', 'Stetson Hackett', 'Era Reif', 'Kimberlynn Daughtry', 'Kaylee Wagner', 'Ela Sturm', 'Blaine Elkins', 'Abbie Horvath', 'Orson Ivory', 'Deklyn Mckeon', 'Audrianna Felton', 'Joshua Roberts', 'Dustin Daly', 'Kendyll Sauls', 'Lucia Mccormick', 'Alanah Lyle', 'Kadence Sweet', 'Aalayah Fiedler', 'Lexa Harriman', 'Lorena Higginbotham' ];
// lorem ipsum to replace otherNotes
const lipsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

const archiver = require('archiver');

process.env.TIER = 'dev';

const tmpdir = os.tmpdir();
const yearsToKeep = [2023, 2024];
const orgsToKeep = [ 'frc102' ];

console.log(`Exporting for the following orgs: ${orgsToKeep.join(', ')}`);

function doConnect(): Promise<{ dbApp: Db; dbExport: Db }> {
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

				resolve({ dbApp, dbExport });
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
				console.log(
					`Expected mongodump to output to ${exportDir} but it does not exist!`
				);
				process.exit(1);
			}

			const archive = archiver('zip');
			const outPath = join(__dirname, '..', '..', '.devcontainer', 'db_export.zip');
			const output = createWriteStream(outPath);

			output.on('close', function () {
				console.log(`Created export at ${outPath}`);
				resolve(undefined);
			});

			// good practice to catch this error explicitly
			archive.on('error', function (err) {
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
	const { dbApp, dbExport } = await doConnect();

	console.log('Dropping database export');
	dbExport.dropDatabase();

	console.log('Caching data from the requested orgs');

	const orgKeyInSpecified = { org_key: { $in: orgsToKeep } };
	const yearInSpecified = { year: { $in: yearsToKeep } };
	const orgKeyAndYearInSpecified = { ...orgKeyInSpecified, ...yearInSpecified };

	const orgs = await dbApp.collection('orgs').find(orgKeyInSpecified).toArray();
	const aggranges = await dbApp
		.collection('aggranges')
		.find(orgKeyAndYearInSpecified)
		.toArray();
	const matchscouting = await dbApp
		.collection('matchscouting')
		.find(orgKeyAndYearInSpecified)
		.toArray();
	const pitscouting = await dbApp
		.collection('pitscouting')
		.find(orgKeyAndYearInSpecified)
		.toArray();
	const uploads = await dbApp
		.collection('uploads')
		.find(orgKeyAndYearInSpecified)
		.toArray();
	const scoutingpairs = await dbApp
		.collection('scoutingpairs')
		.find(orgKeyInSpecified)
		.toArray();
	const users = await dbApp
		.collection('users')
		.find(orgKeyInSpecified)
		.toArray();
	
	const events = await dbApp
		.collection('events')
		.find(yearInSpecified)
		.toArray();
	const eventKeys = await dbApp
		.collection('events')
		.distinct('key', yearInSpecified);
	const matches = await dbApp
		.collection('matches')
		.find({event_key: {$in: eventKeys}})
		.toArray();
	const rankings = await dbApp
		.collection('rankings')
		.find({event_key: {$in: eventKeys}})
		.toArray();
	const teams = await dbApp
		.collection('teams')
		.find()
		.toArray();
	
	const roles = await dbApp.collection('roles')
		.find()
		.toArray();

	console.log(
		`matchscouting: ${matchscouting.length} pitscouting: ${pitscouting.length} scoutingpairs: ${scoutingpairs.length} uploads: ${uploads.length} users: ${users.length}`
	);

	console.log('Inserting into the db export');
	
	// Clear all typed-out pit scouting form entries
	for (let assignment of pitscouting) {
		if (assignment.data) {
			for (let key in assignment.data) {
				if (typeof assignment.data[key] === 'string') {
					assignment.data[key] = '';
				}
			}
		}
	}

	if (orgs.length > 0) await dbExport.collection('orgs').insertMany(orgs);
	if (matchscouting.length > 0) await dbExport.collection('matchscouting').insertMany(matchscouting);
	if (pitscouting.length > 0) await dbExport.collection('pitscouting').insertMany(pitscouting);
	if (scoutingpairs.length > 0) await dbExport.collection('scoutingpairs').insertMany(scoutingpairs);
	if (uploads.length > 0) await dbExport.collection('uploads').insertMany(uploads);
	if (users.length > 0) await dbExport.collection('users').insertMany(users);
	if (aggranges.length > 0) await dbExport.collection('aggranges').insertMany(aggranges);
	if (events.length > 0) await dbExport.collection('events').insertMany(events);
	if (matches.length > 0) await dbExport.collection('matches').insertMany(matches);
	if (rankings.length > 0) await dbExport.collection('rankings').insertMany(rankings);
	if (teams.length > 0) await dbExport.collection('teams').insertMany(teams);
	if (roles.length > 0) await dbExport.collection('roles').insertMany(roles);
	
	// Now, to do some pruning...
	console.log('Pruning users that have no scouting assignments...');
	const distinctUserIdsMatch = await dbExport.collection('matchscouting')
		.distinct('assigned_scorer.id');
	const distinctUserIdsPit = await dbExport.collection('pitscouting')
		.distinct('primary.id');
	const distinctUserIds = [...new Set([...distinctUserIdsMatch, ...distinctUserIdsPit])];
	await dbExport.collection('users')
		.deleteMany({visible: true, _id: {$nin: distinctUserIds}});
	await dbExport.collection('users')
		.deleteMany({visible: false, name: {$nin: ['default_user', 'scoutradioz_admin']}});
	
	// Next, for consistensy, let's delete everyone's password and set them to a scouter
	console.log('Setting everyone as scouter...');
	await dbExport.collection('users')
		.bulkWrite([{
			updateMany: {
				filter: {
					visible: true,
				},
				update: {
					$set: {
						role_key: 'scouter',
						password: 'default',
					},
					$unset: {
						push_subscription: true,
					}
				}
			}
		}]);
	let userOps: AnyBulkWriteOperation<MongoDocument>[] = [];
	// Just set everyone's useragent to an iPhone
	const newUserAgent = {
		ip: '0.0.0.0',
		device: 'Mobile',
		os: 'OS X',
		browser: 'Safari'
	};
	let matchOps: AnyBulkWriteOperation<MongoDocument>[] = [{
		updateMany: {
			filter: {
				useragent: {$ne: null}
			},
			update: {
				$set: {
					useragent: newUserAgent,
				}
			}
		}
	}];
	let pitOps: AnyBulkWriteOperation<MongoDocument>[] = [{
		updateMany: {
			filter: {
				useragent: {$ne: null}
			},
			update: {
				$set: {
					useragent: newUserAgent,
				}
			}
		}
	}];
	let uploadOps: AnyBulkWriteOperation<MongoDocument>[] = [{
		updateMany: {
			filter: {
				'uploader.useragent': {$ne: null}
			},
			update: {
				$set: {
					'uploader.useragent': newUserAgent,
				}
			}
		}
	}];
	const subteams = orgs[0].config.members.subteams as OrgSubteam[];
	const classes = orgs[0].config.members.classes as OrgClass[];

	const visibleUsers = await dbExport.collection('users').find({visible: true}).toArray();
	for (let i in visibleUsers) {
		let thisUser = visibleUsers[i];
		let newName = fakeNames[i];
		if (!newName) {
			console.log(`Couldn't grab a fake name at index ${i}, was visibleUsers too long? - visibleUsers.length: ${visibleUsers.length}`);
			process.exit(1);
		}
		
		// randomly pick a subteam and class
		let newSubteamIdx = Math.floor(Math.random() * subteams.length);
		let newClassIdx = Math.floor(Math.random() * classes.length);
		let newSubteam = subteams[newSubteamIdx].subteam_key;
		let newClass = classes[newClassIdx].class_key;
		
		userOps.push({
			updateMany: {
				filter: {
					_id: thisUser._id,
				},
				update: {
					$set: { name: newName, 'org_info.subteam_key': newSubteam, 'org_info.class_key': newClass },
				},
			},
		});
		for (let key of ['assigned_scorer', 'actual_scorer']) {
			matchOps.push({
				updateMany: {
					filter: {
						[key + '.id']: thisUser._id,
					},
					update: {
						$set: {
							[key + '.name']: newName,
						},
					},
				},
			});
		}
		for (let key of ['primary', 'secondary', 'tertiary', 'actual_scouter']) {
			pitOps.push({
				updateMany: {
					filter: {
						[key + '.id']: thisUser._id
					},
					update: {
						$set: {
							[key + '.name']: newName
						}
					}
				}
			});
		}
		uploadOps.push({
			updateMany: {
				filter: {
					// JL note: uploader ids are strings and not objectids at the moment so this needs to be fixed at some point
					'uploader.id': {$in: [String(thisUser._id), thisUser._id]}
				},
				update: {
					$set: {
						'uploader.name': newName,
					}
				}
			}
		});
	}
	console.log('Rewriting everyone\'s names to autogenerated ones...');
	await dbExport.collection('users').bulkWrite(userOps);
	await dbExport.collection('matchscouting').bulkWrite(matchOps);
	await dbExport.collection('pitscouting').bulkWrite(pitOps);
	await dbExport.collection('uploads').bulkWrite(uploadOps);
	
	console.log('Setting otherNotes to lorem ipsum...');
	for (let col of ['matchscouting', 'pitscouting']) {
		await dbExport
			.collection(col)
			.updateMany(
				{ 'data.otherNotes': { $exists: true, $ne: '' } },
				{ $set: { 'data.otherNotes': lipsum } }
			);
	}
	
	console.log('Updating gearheads org...');
	let newPassword = await bcrypt.hash('password', 10);
	// Modify the org's name and default password
	await dbExport.collection('orgs').updateMany({}, {
		$set: {
			nickname: 'Dev Org (The Gearheads with data tweaked)',
			default_password: newPassword,
		}
	});
	
	// aaand last, add a global admin user
	const user: User = {
		org_key: 'frc102',
		name: '00 Dev Account',
		role_key: 'global_admin',
		password: 'default',
		org_info: {
			subteam_key: 'scoutradioz',
			class_key: 'mentor',
			years: '0',
			seniority: '0',
		},
		event_info: {
			present: true,
			assigned: false,
		},
		visible: true,
	};
	await dbExport.collection('users').insertOne(user);

	await doExportAndArchive();

	console.log('Cleaning up temporary files');
	rmdirSync(join(tmpdir, 'mongodump'), { recursive: true });

	process.exit(1);
})();
