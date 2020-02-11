print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

// move 'current' event into "orgs"
db.orgs.update( {"org_key": "frc102"}, {$set: {"event_key": "2019paca"}} );
db.current.drop();

// tweak 'currentaggranges' into org- & event-specific values, shift into 'aggranges'
db.currentaggranges.update( {}, {$set: {"event_key": "2019paca", "org_key": "frc102"}}, {multi: true} );
db.currentaggranges.renameCollection("aggranges");

// change 'currentrankings' into event-specific 'rankings'
db.currentrankings.update( {}, {$set: {"event_key": "2019paca"}}, {multi: true} );
db.currentrankings.renameCollection("rankings");

// drop 'currentteams'
db.currentteams.drop();

// update config data in 'orgs'
//// MANUALLY add flag for pit_scouting to config.members.subteams array
//// MANUALLY add flag for student to config.members.classes array
//// MANUALLY add value for seniority to config.members.classes array
