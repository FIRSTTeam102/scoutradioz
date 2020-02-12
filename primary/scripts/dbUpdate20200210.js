print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

// Add org_key to layouts
db.scoringlayout.update( {}, {$set: {"org_key": "frc102", "form_type": "matchscouting"}}, {multi: true} );
db.scoutinglayout.update( {}, {$set: {"org_key": "frc102", "form_type": "pitscouting"}}, {multi: true} );
// Combine
db.scoringlayout.find().forEach( function(obj) { db.scoutinglayout.insert(obj); } );
db.scoutinglayout.renameCollection("layout");
db.scoringlayout.drop();

// rename 'scoringdata' to 'matchscouting'
db.scoringdata.update( {}, {$set: {"org_key": "frc102"}}, {multi: true} );
db.scoringdata.renameCollection("matchscouting");

// rename 'scoutingdata' to 'pitscouting'
db.scoutingdata.update( {}, {$set: {"org_key": "frc102"}}, {multi: true} );
db.scoutingdata.renameCollection("pitscouting");
