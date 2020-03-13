print("Running...");

// connect to DB
conn = new Mongo();
db = conn.getDB("app");

//Set "removed" to false
db.uploads.updateMany({}, {$set: {removed: false}});

print("Done");