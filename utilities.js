const monk = require("monk");
const fs = require("fs");

var utilities = module.exports =  {};

// cached DB reference
var dbRef;

/**
 * Function that first caches, then returns the cached database for the server process.
 */
utilities.getDB = function(){
	
	//create db return variable
	var db;
	
	//if cached db reference doesn't exist, create it by connecting to db
	if(!dbRef){
		dbRef = connectToDB();
	}
	
	//set return var equal to dbRef
	db = dbRef;
	
	//return
	return db;
}

//Make it a local variable too
var getDB = utilities.getDB;

/**
 * Internal function that connects to a database, depending on .databases file inside process directory.
 */
function connectToDB(){
	console.log("DEBUG - utilities.js - utilities.connectToDB: ENTER");
	
	//check if we have a db file
	var hasDotDatabase = fs.existsSync(".databases");
	var db;
	
	if(hasDotDatabase) {
		
		//Read JSON-encoded database file.
		var dotdatabase = JSON.parse(fs.readFileSync(".databases", {"encoding": "utf8"}));
		//Grab process tier 
		var thisProcessTier = process.env.tier;
		
		console.log(dotdatabase);
		
		//If a process tier is specified, then attempt to read db URL from that tier.
		if(thisProcessTier){
			
			var thisDBinfo = dotdatabase[thisProcessTier];
			
			//If there is an object inside .databases for process tier, proceed with connecting to db.
			if(thisDBinfo){
				//Connect to db with specified url.
				console.log(`utilities.connectToDB: Connecting to ${thisProcessTier} : ${thisDBinfo.url}`);
				db = monk(thisDBinfo.url);
			}
			//If there is no object in .databases for process tier, throw an error.
			else{
				throw new Error(`utilities.connectToDB: No database specified for process tier ${thisProcessTier} in .databases`);
			}
		}
		//If there is no process tier, then connect to specified default db
		else{
			
			var thisDBinfo = dotdatabase["default"];
			
			//If default db exists, proceed with connecting to db.
			if(thisDBinfo){
				//Connect to db with specified url.
				console.log(`utilities.connectToDB: Connecting to ${thisProcessTier} : ${thisDBinfo.url}`);
				db = monk(thisDBinfo.url);
			}
			//If there is no object in .databases for default, throw an error.
			else{
				throw new Error(`utilities.connectToDB: No default database URL specified in .databases`);
			}
		}
	}
	//If there is no .databases file, then connect to localhost
	else {
		console.log("utilities: No .databases file found; Connecting to localhost:27017");
		db = monk("localhost:27017");
	}
	
	return db;
}

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
	
	var db = getDB();
	
	//Get collection
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
	
	console.log("DEBUG - utilities.js - dbref: " + dbRef);
	
	//Get collection
	console.log("DEBUG - utilities.js - find: " + collection);
	
	var db = getDB();
	
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
	
	var db = getDB();
	
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
	
	var db = getDB();
	
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
	
	var db = getDB();
	
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
utilities.requestTheBlueAlliance = async function(url){
	
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