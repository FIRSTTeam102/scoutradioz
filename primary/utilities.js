const monk = require("monk");
const fs = require("fs");
const logger = require('log4js').getLogger();

var utilities = module.exports =  {};

// cached DB reference
var dbRef, url;
var lastRequestTime;
var refMaxAge = 20000;

/**
 * Function that first caches, then returns the cached database for the server process.
 */
utilities.getDB = function(){
	
	//create db return variable
	var db;
	
	//if dbRef doesn't exist, then create dbRef
	if (!dbRef || !url) {
		logger.info('utilities.getDB: Creating db ref');
		url = this.getDBurl();
		dbRef = monk(url);
		dbRef.then(result => {
			logger.info("Connected!");
		}).catch(err => {
			logger.error(JSON.stringify(err));
		});
	}
	
	//if ref has aged past its prime, then close and reopen it
	if (lastRequestTime && lastRequestTime + refMaxAge < Date.now()) {
		
		logger.info('utilities.getDB: Ref has aged too much; Reconnecting');
		try {
			dbRef.close();
			dbRef = monk(url);
		}
		catch (err) {
			logger.error(err);
			dbRef = monk(url);
		}
		dbRef.then(result => {
			//renew lastRequestTime
			lastRequestTime = Date.now();
			db = dbRef;
			logger.info("Connected!");
		}).catch(err => {
			logger.error(JSON.stringify(err));
		});
	}
	
	//renew lastRequestTime
	lastRequestTime = Date.now();
	db = dbRef;
	
	//return
	return db;
}

/**
 * Function that retrieves the database connection string from databases, and returns that connection string URL.
 * If databases does not exist, it defaults to localhost.
 */
utilities.getDBurl = function(){	
	const thisFuncName = 'utilities.getDBurl: ';
	//check if we have a db file
	const hasDotDatabase = fs.existsSync("databases.json");
	var url;
	
	if(hasDotDatabase) {
		
		//Read JSON-encoded database file.
		//var dotdatabase = JSON.parse(fs.readFileSync("databases", {"encoding": "utf8"}));
		var dotdatabase = require('./databases.json');
		//Grab process tier 
		var thisProcessTier = process.env.TIER;
				
		//If a process tier is specified, then attempt to read db URL from that tier.
		if(thisProcessTier){
			
			var thisDBinfo = dotdatabase[thisProcessTier];
			
			//If there is an object inside databases for process tier, proceed with connecting to db.
			if(thisDBinfo){
				//Connect to db with specified url.
				logger.info(`${thisFuncName} Connecting to tier: ${thisProcessTier}: "${thisDBinfo.url.substring(0, 23)}..."`);
				url = thisDBinfo.url;
			}
			//If there is no object in databases for process tier, throw an error.
			else{
				throw new Error(`${thisFuncName} No database specified for process tier ${thisProcessTier} in databases`);
			}
		}
		//If there is no process tier, then connect to specified default db
		else{
			
			var thisDBinfo = dotdatabase["default"];
			
			//If default db exists, proceed with connecting to db.
			if(thisDBinfo){
				//Connect to db with specified url.
				logger.info(`${thisFuncName}: Connecting to tier: ${thisProcessTier}: "${thisDBinfo.url.substring(0, 23)}..."`);
				url = thisDBinfo.url;
			}
			//If there is no object in databases for default, throw an error.
			else{
				throw new Error(`${thisFuncName}: No default database URL specified in databases`);
			}
		}
	}
	//If there is no databases file, then connect to localhost
	else {
		logger.warn("utilities: No databases file found; Defaulting to localhost:27017");
		url = "mongodb://localhost:27017/app";
	}
	
	return url;
}

/**
 * Asynchronous "find" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} parameters Query parameters.
 * @param {Object} options Query options, such as sort.
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
	
	logger.trace(`utilities.find: ${collection}, ${JSON.stringify(parameters)}, ${JSON.stringify(options)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Find in collection with parameters and options
	var data = [];
	data = await Col.find(parameters, options);
	
	logger.trace(`utilities.find: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "findOne" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} parameters Query parameters.
 * @param {Object} options Query options, such as sort.
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
	
	logger.trace(`utilities.findOne: ${collection}, ${JSON.stringify(parameters)}, ${JSON.stringify(options)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	
	//Find in collection with parameters and options
	var data = [];
	data = await Col.findOne(parameters, options);
	
	logger.trace(`utilities.findOne: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "distinct" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} parameters Query parameters.
 */
utilities.distinct = async function(collection, parameters){
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Utilities.distinct Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	
	logger.trace(`utilities.distinct: ${collection}, ${JSON.stringify(parameters)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Find in collection with parameters and options
	var data = [];
	data = await Col.distinct(parameters);
	
	logger.trace(`utilities.distinct: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "aggregate" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} parameters Query parameters.
 */
utilities.aggregate = async function(collection, parameters) {
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Utilities.aggregate Error: Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	//If parameters exists and is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.aggregate Error: Parameters must be of type object");
	}
	
	logger.trace(`utilities.aggregate: ${collection}, ${JSON.stringify(parameters)}`);
	
	var db = this.getDB();
	
	var Col = db.get(collection);
	//Find in collection with parameters and options
	var data = [];
	data = await Col.aggregate(parameters);
	
	logger.trace(`utilities.aggregate: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "update" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} parameters Query parameters.
 * @param {Object} update Update query.
 * @param {Object} options Query options, such as sort.
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
	
	logger.trace(`utilities.update: ${collection}, param: ${JSON.stringify(parameters)}, update: ${JSON.stringify(update)}, options: ${JSON.stringify(options)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Remove in collection with parameters
	var writeResult;
	writeResult = await Col.update(parameters, update, options);
	
	//console.log(`utilities.update: writeResult: ${JSON.stringify(writeResult)}`);
	logger.trace(`utilities.update: writeResult: ${JSON.stringify(writeResult)}`);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous "bulkWrite" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Array} operations Array of bulkWrite operations.
 * @param {Object} parameters Query parameters.
 */
utilities.bulkWrite = async function(collection, operations, parameters){
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Collection must be specified.");
	}

	//If operations does not exist or is not an array, throw an error. 
	if(!Array.isArray(operations)){
		throw new Error("Utilities.bulkWrite Error: Operations must be specified and is an array of operations");
	}
	
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	//If parameters exists and is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.find Error: Parameters must be of type object");
	}
	
	logger.trace(`utilities.bulkWrite: ${collection}, operations: ${JSON.stringify(operations)}, param: ${JSON.stringify(parameters)}`);

	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Update in collection with parameters
	var writeResult;
	writeResult = await Col.bulkWrite(operations, parameters);
	
	logger.trace(`utilities.bulkWrite: writeResult: ${JSON.stringify(writeResult)}`);
	
	//return result
	return writeResult;
}

/**
 * Asynchronous "remove" function to a collection specified in first parameter.
 * @param {String} collection Collection to remove from.
 * @param {Object} parameters Query parameters (Element/s to remove).
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
	
	logger.trace(`utilities.remove: ${collection}, param: ${JSON.stringify(parameters)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Remove in collection with parameters
	var writeResult;
	writeResult = await Col.remove(parameters);
	
	logger.trace(`utilities.remove: writeResult: ${JSON.stringify(writeResult)}`);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous "insert" function to a collection specified in first parameter.
 * @param {String} collection Collection to insert into.
 * @param {Object} parameters [Any] Element or array of elements to insert
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
	
	logger.trace(`utilities.insert: ${collection}, elements: ${JSON.stringify(elements)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Insert in collection
	var writeResult;
	writeResult = await Col.insert(elements);
	
	logger.trace(`utilities.insert: writeResult: ${JSON.stringify(writeResult)}`);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous request to TheBlueAlliance. Requires a URL ending to execute correctly.
 * @param {string} url ENDING of URL, after "https://.../api/v3/" DO NOT INCLUDE A / AT THE START
 * @return {Promise} Promise; Resolves when client receives a request from TBA
 */
utilities.requestTheBlueAlliance = async function(url){
	
	//Setup our request URL, including specified URL ending parameter
	var requestURL = "https://www.thebluealliance.com/api/v3/" + url;
	
	logger.info(`Sending request to TheBlueAlliance at ${url}`);
	
	//Get TBA key
	var tbaKey = await utilities.getTBAKey();
	
	//Create promise first
	var thisPromise = new Promise(function(resolve, reject){
		
		var Client = require('node-rest-client').Client;
		var client = new Client();
		
		//Inside promise function, perform client request
		client.get(requestURL, tbaKey, function(tbaData, response){
			
			//If newline characters are not deleted, then CloudWatch logs get spammed
			let str = tbaData.toString().replace(/\n/g, "");
			
			logger.debug(`TBA response: ${str.substring(0, 1000)}...`);
			logger.trace(`Full TBA response: ${str}`);
			
			//tbaData = JSON.parse(tbaData);
			//Inside client callback, resolve promise
			resolve(tbaData);
		});
	});
	
	//Resolve promise
	return thisPromise;
}

/**
 * Asynchronous function to get our TheBlueAlliance API key from the DB.
 * @return {Promise} - TBA arguments
 */
utilities.getTBAKey = async function(){
	
	var tbaArgsArray = await utilities.find("passwords", {name: "thebluealliance-args"});
	
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