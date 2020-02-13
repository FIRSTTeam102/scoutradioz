print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

// add org_key to scoutingpairs
db.scoutingpairs.update( {}, {$set: {"org_key": "frc102"}}, {multi: true} );
