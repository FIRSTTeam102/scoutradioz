const monk = require("monk");
const fs = require("fs");

var utilities = module.exports =  {};

// cached DB reference
var dbRef;

utilities.getDB = async function(dbName) {
	if (dbRef)
		return dbRef;
	
	var db = utilities.getDBinner();
	await new Promise(resolve => setTimeout(() => resolve(), 2000));
	console.log("DEBUG - utilities.js - getDB*: Post 2000");
	//db = dbRef;
	//return db;
}

/**
 * One-time function that returns Monk DB, with specified DB string name.
 * @param {string} dbName name of DB
 * @return {*} Monk db
 */
utilities.getDBinner = async function(uri) {
	console.log("DEBUG - utilities.js - utilities.getDB: ENTER");

	//check if we have a db user file
	var hasDBUserFile = fs.existsSync(".dbuser");
	var db;
	
	// if we already have a cached copy, use that
	if (dbRef) {
		console.log("DEBUG - usefunctions.js - functions.getDB: Using reference");
		db = dbRef;
	}
	// otherwise, get a reference
	else
	{
		if(hasDBUserFile) {
			var dbUser = JSON.parse(fs.readFileSync(".dbuser", {"encoding": "utf8"}));
			console.log(dbUser);
			console.log(`${dbUser.username}:${dbUser.password}@localhost:27017/${dbName}`);	
			db = monk(`${dbUser.username}:${dbUser.password}@localhost:27017/${dbName}`);	
		}
		else {
			console.log("DEBUG - utilities.js - getDB: Retrieving remote...");
			const dbMonk = monk("mongodb://USER:PASSWORD@scoutradioz-test-01-shard-00-00-obbqu.mongodb.net:27017,scoutradioz-test-01-shard-00-01-obbqu.mongodb.net:27017,scoutradioz-test-01-shard-00-02-obbqu.mongodb.net:27017/app?ssl=true&replicaSet=Scoutradioz-Test-01-shard-0&authSource=admin&retryWrites=true&w=1");
			//await monk("mongodb://USER:PASSWORD@scoutradioz-test-01-shard-00-00-obbqu.mongodb.net:27017,scoutradioz-test-01-shard-00-01-obbqu.mongodb.net:27017,scoutradioz-test-01-shard-00-02-obbqu.mongodb.net:27017/app?ssl=true&replicaSet=Scoutradioz-Test-01-shard-0&authSource=admin&retryWrites=true&w=1").then(function() {});
			console.log("DEBUG - app.js - getDB - dbMonk=" + dbMonk);
			db = dbMonk;
			//db = await monk("mongodb://USER:PASSWORD@scoutradioz-test-01-shard-00-00-obbqu.mongodb.net:27017,scoutradioz-test-01-shard-00-01-obbqu.mongodb.net:27017,scoutradioz-test-01-shard-00-02-obbqu.mongodb.net:27017/app?ssl=true&replicaSet=Scoutradioz-Test-01-shard-0&authSource=admin&retryWrites=true&w=1");
			//db = monk(uri);			//Local db on localhost without authentication
		}
		// set the DB reference for re-use later
		dbRef = db;
	}


	console.log("DEBUG - utilities.js - utilities.getDB: EXIT returning db=" + db);
	return db;
}

//
//var db = utilities.getDB("mongodb+srv://USER:PASSWORD@cluster0-obbqu.mongodb.net/test?retryWrites=true");
//var db = utilities.getDB(`localhost:27017/app`);

/**
 * Asynchronous "find" function to a collection specified in first parameter.
 * @param collection [String] Collection to find in.
 * @param parameters [Object] Query parameters.
 * @param options [Object] Query options, such as sort.
 */
utilities.find = async function(collection, parameters, options){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	//If parameters exists and is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.find Error: Parameters must be of type object");
	}
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error.
	if(typeof(options) != "object"){
		throw new Error("Utilities.find Error: Options must be of type object");
	}
	
	//Get collection
	console.log("DEBUG - utilities.js - find: Calling getDB()");
	var db;
	if (!dbRef)
		db = this.getDB();
	db = dbRef;
	console.log("DEBUG - utilities.js - find: db=" + db);
	
	var Col = db.get(collection);
	//Find in collection with parameters and options
	var data = [];
	data = await Col.find(parameters, options);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "findOne" function to a collection specified in first parameter.
 * @param collection [String] Collection to find in.
 * @param parameters [Object] Query parameters.
 * @param options [Object] Query options, such as sort.
 */
utilities.findOne = async function(collection, parameters, options){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	//If parameters exists and is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.find Error: Parameters must be of type object");
	}
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error.
	if(typeof(options) != "object"){
		throw new Error("Utilities.find Error: Options must be of type object");
	}
	
	//Get collection
	console.log("DEBUG - utilities.js - find: Calling getDB()");
	var db;
	if (!dbRef)
		db = this.getDB();
	db = dbRef;
	console.log("DEBUG - utilities.js - find: db=" + db);
	
	var Col = db.get(collection);
	//Find in collection with parameters and options
	var data = [];
	data = await Col.findOne(parameters, options);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "update" function to a collection specified in first parameter.
 * @param collection [String] Collection to find in.
 * @param parameters [Object] Query parameters.
 * @param update [Object] Update query.
 * @param options [Object] Query options, such as sort.
 */
utilities.update = async function(collection, parameters, update, options){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	//If parameters exists and is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.find Error: Parameters must be of type object");
	}
	//If update does not exist or is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.find Error: Parameters must be specified and of type object");
	}
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error.
	if(typeof(options) != "object"){
		throw new Error("Utilities.find Error: Options must be of type object");
	}
	
	var db;
	if (!dbRef)
		db = this.getDB();
	db = dbRef;
	
	//Get collection
	var Col = db.get(collection);
	//Remove in collection with parameters
	var writeResult;
	writeResult = await Col.update(parameters, update, options);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous "remove" function to a collection specified in first parameter.
 * @param collection [String] Collection to remove from.
 * @param parameters [Object] Query parameters (Element/s to remove).
 */
utilities.remove = async function(collection, parameters){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	//If parameters exists and is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.find Error: Parameters must be of type object");
	}
	
	var db;
	if (!dbRef)
		db = this.getDB();
	db = dbRef;
	
	//Get collection
	var Col = db.get(collection);
	//Remove in collection with parameters
	var writeResult;
	writeResult = await Col.remove(parameters);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous "insert" function to a collection specified in first parameter.
 * @param collection [String] Collection to insert into.
 * @param parameters [Any] Element or array of elements to insert
 */
utilities.insert = async function(collection, elements){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!elements){
		throw new Error("Must contain an element or array of elements to insert.");
	}
	
	var db;
	if (!dbRef)
		db = this.getDB();
	db = dbRef;
	
	//Get collection
	var Col = db.get(collection);
	//Insert in collection
	var writeResult;
	writeResult = await Col.insert(elements);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous request to TheBlueAlliance. Requires a URL ending to execute correctly.
 * @param {string} url ENDING of URL, after "https://.../api/v3/"
 * @return {Promise} Promise; Resolves when client receives a request from TBA
 */
utilities.requestTheBlueAliance = async function(url){
	
	//Setup our request URL, including specified URL ending parameter
	var requestURL = "https://www.thebluealliance.com/api/v3/" + url;
	
	//Get TBA key
	var tbaKey = await getTBAKey();
	
	//Create promise first
	var thisPromise = new Promise(function(resolve, reject){
		
		//Inside promise function, perform client request
		client.get(requestURL, tbaKey, function(tbaData, response){
			
			tbaData = JSON.parse(tbaData);
			//Inside client callback, resolve promise
			resolve(tbaData);
		});
	});
	
	//Resolve promise
	return thisPromise;
}

/**
 * Asynchronous function to get our TheBlueAlliance API key from the DB.
 * @return {Promise} - [Object] TBA arguments
 */
utilities.getTBAKey = async function(){
	
	var passwordsCol = db.get("passwords");
	
	var tbaArgsArray = await passwordsCol.find({name: "thebluealliance-args"});
	
	if(tbaArgsArray && tbaArgsArray[0]){
		var headers = tbaArgsArray[0].headers;
		var tbaArgs = {"headers": headers};
		return tbaArgs;
	}
	else{
		//**********CONSIDER ANOTHER OPTION FOR HANDLING "CAN'T FIND REQUEST ARGS"
		return null;
	}
}

/**
 * Asynchronous function to get current event from database.
 * @return {Promise}-[Object] Event key and name for current event
 */
utilities.getCurrent = async function(){
	
	var currentCol = db.get("current");
	var current = {
		key: "undefined",
		name: "undefined"
	};
	
	var currentKey = await currentCol.find({});
	
	if(currentKey && currentKey[0]){
		current.key = currentKey[0].event;
		
		var currentData = await find("events", {key: current.key});
		
		if(currentData && currentData[0]){
			current.name = currentData[0].name;
		}
	}
	
	return current;
}