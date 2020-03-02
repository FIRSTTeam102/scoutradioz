print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

// Rename the old demo
db.orgs.update({org_key: 'demo'}, {$set: {org_key: 'demo2', nickname: 'Prior demo (DEPRECATED)'}});
db.users.update({org_key: 'demo', name: 'Jordan Lees'}, {$set: {org_key: 'demo2'}});

// Create and adjust the demo org
db.orgs.find({org_key: 'frc102'}).forEach( function(obj) { obj._id = ObjectId(); obj.org_key = 'demo'; db.orgs.insert(obj); } );
db.orgs.update({org_key: 'demo'}, {$set: {org_key: 'demo', nickname: 'Your Team Here (BETA / Demo)', team_number: 999999, team_key: 'frc999999'}});

// 'Assigned' pit scouts from 2019paca:
// "James Scout",
// "Will L.",
// "Ramiro L.",
// "Spencer C.",
// "Callahan O.",
// "Marcus D.",

// Insert new scouting pairs
db.scoutingpairs.insert({org_key: 'demo', member1: 'James Scout', member2: 'Will L.'});
db.scoutingpairs.insert({org_key: 'demo', member1: 'Ramiro L.', member2: 'Spencer C.'});
db.scoutingpairs.insert({org_key: 'demo', member1: 'Callahan O.', member2: 'Marcus D.'});

// Copy user data from frc102 to demo
db.users.find().forEach( function(obj) { obj.org_key = 'demo'; obj._id = ObjectId(); db.users.insert(obj); } );
// Change the names
db.users.update({org_key: 'demo', name: 'Ahmad Insanally'}, {$set: {name: 'Ahmad I.'}});
db.users.update({org_key: 'demo', name: 'Aidan O\'Connell'}, {$set: {name: 'Aidan O.'}});
db.users.update({org_key: 'demo', name: 'Alex Giardina'}, {$set: {name: 'Alex G.'}});
db.users.update({org_key: 'demo', name: 'Andrew Daily'}, {$set: {name: 'Andrew D.'}});
db.users.update({org_key: 'demo', name: 'Ben Parker'}, {$set: {name: 'Ben P.'}});
db.users.update({org_key: 'demo', name: 'Callahan O\'Connell'}, {$set: {name: 'Callahan O.'}});
db.users.update({org_key: 'demo', name: 'Connor Reinhart'}, {$set: {name: 'Connor R.'}});
db.users.update({org_key: 'demo', name: 'Derrick Chin'}, {$set: {name: 'Derrick C.'}});
db.users.update({org_key: 'demo', name: 'Emily Vogel'}, {$set: {name: 'Emily V.'}});
db.users.update({org_key: 'demo', name: 'Ethan Miller'}, {$set: {name: 'Ethan M.'}});
db.users.update({org_key: 'demo', name: 'James Girgis'}, {$set: {name: 'James G.'}});
db.users.update({org_key: 'demo', name: 'Jordan Lees'}, {$set: {name: 'Jordan L.'}});
db.users.update({org_key: 'demo', name: 'Joseph Bogan'}, {$set: {name: 'Joseph B.'}});
db.users.update({org_key: 'demo', name: 'Josh Rutka'}, {$set: {name: 'Josh R.'}});
db.users.update({org_key: 'demo', name: 'Kiera Karl'}, {$set: {name: 'Kiera K.'}});
db.users.update({org_key: 'demo', name: 'Matt Exil'}, {$set: {name: 'Matt E.'}});
db.users.update({org_key: 'demo', name: 'Michael Paternoster'}, {$set: {name: 'Michael P.'}});
db.users.update({org_key: 'demo', name: 'Mike O\'Connell'}, {$set: {name: 'Mike O.'}});
db.users.update({org_key: 'demo', name: 'Nirav Patel'}, {$set: {name: 'Nirav P.'}});
db.users.update({org_key: 'demo', name: 'Ramiro Lapola'}, {$set: {name: 'Ramiro L.'}});
db.users.update({org_key: 'demo', name: 'Seth Caskey'}, {$set: {name: 'Seth C.'}});
db.users.update({org_key: 'demo', name: 'Spencer Clarke'}, {$set: {name: 'Spencer C.'}});
db.users.update({org_key: 'demo', name: 'Tyler Kazar'}, {$set: {name: 'Tyler K.'}});
db.users.update({org_key: 'demo', name: 'Will Landrieu'}, {$set: {name: 'Will L.'}});

// scouting layouts
db.layout.find({org_key: 'frc102', year: 2019}).forEach( function(obj) { obj._id = ObjectId(); obj.org_key = 'demo'; db.layout.insert(obj); } );

// pit scouting data
db.pitscouting.find({org_key: 'frc102', event_key: '2019paca'}).forEach( function(obj) { obj._id = ObjectId(); obj.org_key = 'demo'; db.pitscouting.insert(obj); } );

// match scouting data
db.matchscouting.find({org_key: 'frc102', event_key: '2019paca'}).forEach( function(obj) { obj._id = ObjectId(); obj.org_key = 'demo'; db.matchscouting.insert(obj); } );

// aggranges
db.aggranges.find({org_key: 'frc102', event_key: '2019paca'}).forEach( function(obj) { obj._id = ObjectId(); obj.org_key = 'demo'; db.aggranges.insert(obj); } );

// afterwards: use Compass to manuall delete org 'demo2'; also manually delete user in 'demo2' org
