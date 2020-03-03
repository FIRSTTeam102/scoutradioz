const monk = require("monk");
const fs = require("fs");
const logger = require('@log4js-node/log4js-api').getLogger();

var utilities = module.exports =  {};

// cached DB reference
var dbRef, url;
var lastRequestTime;
var refMaxAge = 20000;
// database configuration file and location
var dbConfig;
var dbConfigLocation;

/**
 * (Required) Configure utilities with database config file.
 * @param {String} configFile Location of database configuration file (JSON format).
 */
utilities.config = function(configFile){
	
	if (typeof configFile != "string") throw new TypeError("Utilities.config: configFile must be a string");
	
	if (fs.existsSync(configFile)) {
		dbConfigLocation = configFile;
		
		try {
			dbConfig = require(dbConfigLocation);
			console.log("Success!");
		}
		catch(err) {
			throw new Error("Could not read configFile json", err)
		}
	}
	else {
		throw new ReferenceError("configFile is not a valid path or file does not exist");
	}
}

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
	
	var url;
	//Check if db has been configured
	if(dbConfig) {
		
		//Grab process tier 
		var thisProcessTier = process.env.TIER;
				
		//If a process tier is specified, then attempt to read db URL from that tier.
		if(thisProcessTier){
			
			var thisDBinfo = dbConfig[thisProcessTier];
			
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
			
			var thisDBinfo = dbConfig["default"];
			
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
 * @param {Object} query Filter for query.
 * @param {Object} options Query options, such as sort.
 */
utilities.find = async function(collection, query, options, cacheOptions){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("Utilities.find: Collection must be specified.");
	}
	//If query query are not set, create an empty object for the DB call.
	if(!query){
		var query = {};
	}
	//If query exists and is not an object, throw an error. 
	if(typeof(query) != "object"){
		throw new TypeError("Utilities.find: query must be of type object");
	}
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error.
	if(typeof(options) != "object"){
		throw new TypeError("Utilities.find: Options must be of type object");
	}
	
	logger.trace(`utilities.find: ${collection}, ${JSON.stringify(query)}, ${JSON.stringify(options)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Find in collection with query and options
	var data = [];
	data = await Col.find(query, options);
	
	logger.trace(`utilities.find: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "findOne" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} query Filter for query.
 * @param {Object} options Query options, such as sort.
 */
utilities.findOne = async function(collection, query, options){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("Utilities.findOne: Collection must be specified.");
	}
	//If query query are not set, create an empty object for the DB call.
	if(!query){
		var query = {};
	}
	//If query exists and is not an object, throw an error. 
	if(typeof(query) != "object"){
		throw new TypeError("Utilities.findOne: query must be of type object");
	}
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error.
	if(typeof(options) != "object"){
		throw new TypeError("Utilities.findOne: Options must be of type object");
	}
	logger.warn("hello")
	
	logger.trace(`utilities.findOne: ${collection}, ${JSON.stringify(query)}, ${JSON.stringify(options)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	
	//Find in collection with query and options
	var data = [];
	data = await Col.findOne(query, options);
	
	logger.trace(`utilities.findOne: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "distinct" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {String} field Which field to distinct.
 * @param {Object} query The query for filtering the set of documents to which we apply the distinct filter.
 */
utilities.distinct = async function(collection, field, query){
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("Utilities.distinct: Collection must be specified.");
	}
	if(typeof(field) != "string"){
		throw new TypeError("Utilities.distinct: Field string must be specified.")
	}
	//If query filter are not set, create an empty object for the DB call.
	if(!query){
		var query = {};
	}
	//If query exists and is not an object, throw an error. 
	if(typeof(query) != "object"){
		throw new TypeError("Utilities.distinct: query must be of type object");
	}
	
	logger.trace(`utilities.distinct: ${collection}, ${JSON.stringify(query)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Find in collection with query and options
	var data = [];
	data = await Col.distinct(field, query);
	
	logger.trace(`utilities.distinct: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "aggregate" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} pipeline Array containing all the aggregation framework commands for the execution.
 */
utilities.aggregate = async function(collection, pipeline) {
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("Utilities.aggregate: Collection must be specified.");
	}
	//If query does not exist or is not an object, throw an error. 
	if(typeof(pipeline) != "object"){
		throw new TypeError("Utilities.aggregate: pipieline must be of type object");
	}
	
	logger.trace(`utilities.aggregate: ${collection}, ${JSON.stringify(pipeline)}`);
	
	var db = this.getDB();
	
	var Col = db.get(collection);
	//Find in collection with query and options
	var data = [];
	data = await Col.aggregate(pipeline);
	
	logger.trace(`utilities.aggregate: result: ${data}`);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous "update" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Object} query Filter query.
 * @param {Object} update Update query.
 * @param {Object} options Query options, such as sort.
 */
utilities.update = async function(collection, query, update, options){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("Utilities.update: Collection must be specified.");
	}
	//If query query are not set, create an empty object for the DB call.
	if(!query){
		var query = {};
	}
	//If query exists and is not an object, throw an error. 
	if(typeof(query) != "object"){
		throw new TypeError("Utilities.update: query must be of type object");
	}
	//If update does not exist or is not an object, throw an error. 
	if(typeof(update) != "object"){
		throw new TypeError("Utilities.update: update must be specified and of type object");
	}
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error.
	if(typeof(options) != "object"){
		throw new TypeError("Utilities.update: Options must be of type object");
	}
	
	logger.trace(`utilities.update: ${collection}, param: ${JSON.stringify(query)}, update: ${JSON.stringify(update)}, options: ${JSON.stringify(options)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Remove in collection with query
	var writeResult;
	writeResult = await Col.update(query, update, options);
	
	//console.log(`utilities.update: writeResult: ${JSON.stringify(writeResult)}`);
	logger.trace(`utilities.update: writeResult: ${JSON.stringify(writeResult)}`);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous "bulkWrite" function to a collection specified in first parameter.
 * @param {String} collection Collection to find in.
 * @param {Array} operations Array of Bulk operations to perform.
 * @param {Object} options Optional settings.
 */
utilities.bulkWrite = async function(collection, operations, options){
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("Utilities.bulkWrite: Collection must be specified.");
	}
	
	//If operations does not exist or is not an array, throw an error. 
	if(!Array.isArray(operations)){
		throw new TypeError("Utilities.bulkWrite: Operations must be specified and is an array of operations");
	}
	
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error. 
	if(typeof(options) != "object"){
		throw new TypeError("Utilities.bulkWrite: options must be of type object");
	}
	
	logger.trace(`utilities.bulkWrite: ${collection}, operations: ${JSON.stringify(operations)}, param: ${JSON.stringify(options)}`);

	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Update in collection with options
	var writeResult;
	writeResult = await Col.bulkWrite(operations, options);
	
	logger.trace(`utilities.bulkWrite: writeResult: ${JSON.stringify(writeResult)}`);
	
	//return result
	return writeResult;
}

/**
 * Asynchronous "remove" function to a collection specified in first parameter.
 * @param {String} collection Collection to remove from.
 * @param {Object} query Filter for element/s to remove.
 */
utilities.remove = async function(collection, query){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("utilities.remove: Collection must be specified.");
	}
	//If query query are not set, create an empty object for the DB call.
	if(!query){
		var query = {};
	}
	//If query exists and is not an object, throw an error. 
	if(typeof(query) != "object"){
		throw new TypeError("utilities.remove: query must be of type object");
	}
	
	logger.trace(`utilities.remove: ${collection}, param: ${JSON.stringify(query)}`);
	
	var db = this.getDB();
	
	//Get collection
	var Col = db.get(collection);
	//Remove in collection with query
	var writeResult;
	writeResult = await Col.remove(query);
	
	logger.trace(`utilities.remove: writeResult: ${JSON.stringify(writeResult)}`);
	
	//return writeResult
	return writeResult;
}

/**
 * Asynchronous "insert" function to a collection specified in first parameter.
 * @param {String} collection Collection to insert into.
 * @param {Object} elements [Any] Element or array of elements to insert
 */
utilities.insert = async function(collection, elements){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new TypeError("utilities.insert: Collection must be specified.");
	}
	//If elements are not set, throw an error
	if(!elements){
		throw new TypeError("utilities.insert: Must contain an element or array of elements to insert.");
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
	var requestURL = "https://www.thebluealliance.com/api/v3/" + url + `?t=${Date.now()}`;
	
	logger.info(`Sending request to TheBlueAlliance at ${url}`);
	
	//Get TBA key
	var headers = await utilities.getTBAKey();
	
	//Create promise first
	var thisPromise = new Promise(function(resolve, reject){
		
		var Client = require('node-rest-client').Client;
		var client = new Client();
		
		//Inside promise function, perform client request
		client.get(requestURL, headers, function(tbaData, response){
			
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
	
	var tbaArgs = await utilities.findOne("passwords", {name: "tba-api-headers"});
	
	if(tbaArgs){
		var headers = tbaArgs.headers;
		var key = {"headers": headers};
		return key;
	}
	else{
		//**********CONSIDER ANOTHER OPTION FOR HANDLING "CAN'T FIND REQUEST ARGS"
		logger.warn("utilities.getTBAKey: Could not find tba-api-headers in database");
		return null;
	}
}