/* eslint-disable global-require */
'use strict';
const monk = require('@firstteam102/monk-fork');
const crypto = require('crypto');
const NodeCache = require('node-cache');
var logger;
try {
	logger = require('log4js').getLogger('utilities');
}
catch(err) {
	logger = require('@log4js-node/log4js-api').getLogger('utilities');
}

var utilities = module.exports =  {
	activeTier: null,
	dbConfig: null,
	ready: false,
	whenReadyQueue: [],
	options: {
		cache: {
			enable: false,
			maxAge: 30
		},
		debug: false,
	},
	cache: new NodeCache({stdTTL: 30}),
};

// cached DB reference
var dbRefs = {}, urls = {};
var lastRequestTime;
var refMaxAge = 20000;

//Performance debugging if enabled
function consoleTime(name) {
	if (utilities.options.debug == true) console.time(name + '\t\t');
}
function consoleTimeEnd(name) {
	if (utilities.options.debug == true) console.timeEnd(name + '\t\t');
}

/**
 * (Required) Configure utilities with database config file.
 * @param {object} databaseConfig JSON object for database config (use require('databases.json') for security)
 * @param {object} [options] Optional settings
 * @param {object} [options.cache] Cache settings
 * @param {boolean} [options.cache.enable=false] Whether to enable or disable caching in find requests
 * @param {number} [options.cache.maxAge=30] Default maximum age of cached requests, in seconds
 * @param {debug} [options.debug=false] Whether to enable extra debug logging (Performance, timing, etc.)
 */
utilities.config = function(databaseConfig, options){
	if (typeof databaseConfig != 'object') throw new TypeError('opts.databaseConfig must be provided. Use require("databases.json").');
	
	if (!options) options = {};
	if (typeof options != 'object') throw new TypeError('opts must be an object');
	if (!options.cache) options.cache = {};
	if (options.cache.enable == undefined) options.cache.enable = false; //global trigger to enable/disable cache
	if (options.cache.maxAge == undefined) options.cache.maxAge = 30; //max age in seconds
	if (typeof options.cache != 'object') throw new TypeError('opts.cache must be an object');
	if (typeof options.cache.enable != 'boolean') throw new TypeError('opts.cache.enable must be a boolean');
	if (typeof options.cache.maxAge != 'number') throw new TypeError('opts.cache.maxAge must be a number');
	
	if (!options.cache.enable) options.cache.enable = false;
	if (!options.cache.maxAge) options.cache.maxAge = 30;
	if (!options.debug) options.debug = false;
	
	if (options.cache.enable == true) logger.warn('utilities: Caching is enabled');
	
	//Set config variable
	this.dbConfig = databaseConfig;
	this.options = options;
};

/**
 * Function that first caches, then returns the cached database for the server process.
 * @returns {monk.IMonkManager} Monk database manager
 */
utilities.getDB = async function(){
	//logger.addContext('funcName', 'getDB');
	
	//create db return variable
	var db;
	
	var tier = this.activeTier;
	var dbRef = dbRefs[tier];
	var url = urls[tier];
	logger.trace(`(getDB) tier=${tier} dbRef=${dbRef} url=${url}`);
	
	//2020-03-23 JL: one db ref for every tier
	if (!dbRef || !url) {
		logger.info(`(getDB) Creating db ref for ${tier}`);
		url = await this.getDBurl();
		dbRef = monk(url);
		logger.trace(`(getDB) Got url, url=${url}, tier=${tier} this.activeTier=${this.activeTier}`);
		
		dbRef.then(result => {
			logger.info('(getDB) Connected!');
		}).catch(err => {
			logger.error(JSON.stringify(err));
		});
		urls[tier] = url;
		dbRefs[tier] = dbRef;
	}
	
	//if ref has aged past its prime, then close and reopen it
	if (lastRequestTime && lastRequestTime + refMaxAge < Date.now()) {
		
		logger.info('(getDB) Ref has aged too much; Reconnecting');
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
			logger.info('(getDB) Connected!');
		}).catch(err => {
			logger.error(JSON.stringify(err));
		});
	}
	
	//renew lastRequestTime
	lastRequestTime = Date.now();
	db = dbRef;
	
	logger.trace('(getDB) returning db');
	//logger.removeContext('funcName');
	//return
	//Must use object destructuring becasue for SOME reason,
	// returning monk from an async function hangs the process
	return {db};
};

/**
 * Function that retrieves the database connection string from databases, and returns that connection string URL.
 * If databases does not exist, it defaults to localhost.
 * @returns {string} Database connection uri.
 */
utilities.getDBurl = function(){
	logger.addContext('funcName', 'getDBurl');
	logger.trace('Returning promise');
	
	return new Promise((resolve, reject) => {
		//only execute when utilities.js is ready
		this.whenReady(() => {
			logger.addContext('funcName', 'getDBurl(whenReady cb)');
			logger.trace('BEGIN');
			//if no config is provided
			if (!this.dbConfig) {
				logger.warn('No database config provided; Defaulting to localhost:27017/app');
				return resolve('mongodb://localhost:27017/app');
			}
			//if no tier exists, something went wrong
			if (!this.activeTier) {
				logger.error('Something went wrong; activeTier is not defined');
				return reject(new Error('Something went wrong; activeTier is not defined'));
			}
			var thisDBinfo = this.dbConfig[this.activeTier];
			
			if (!thisDBinfo || !thisDBinfo.url) {
				return reject('No database URL specified for tier '+ this.activeTier);
			}
			
			logger.info(`Connecting to tier: ${this.activeTier}: "${thisDBinfo.url.substring(0, 23)}..."`);
			resolve(thisDBinfo.url);
			
			logger.removeContext('funcName');
		});
	});
	/*
	var url;
	//Check if db has been configured
	if(this.dbConfig) {
		
		//Grab process tier 
		var thisProcessTier = process.env.TIER;
				
		//If a process tier is specified, then attempt to read db URL from that tier.
		if(thisProcessTier){
			
			var thisDBinfo = this.dbConfig[thisProcessTier];
			
			//If there is an object inside databases for process tier, proceed with connecting to db.
			if(thisDBinfo){
				//Connect to db with specified url.
				logger.info(`Connecting to tier: ${thisProcessTier}: "${thisDBinfo.url.substring(0, 23)}..."`);
				url = thisDBinfo.url;
			}
			//If there is no object in databases for process tier, throw an error.
			else{
				throw new Error(`No database specified for process tier ${thisProcessTier} in databases`);
			}
		}
		//If there is no process tier, then connect to specified default db
		else{
			
			var thisDBinfo = this.dbConfig["default"];
			
			//If default db exists, proceed with connecting to db.
			if(thisDBinfo){
				//Connect to db with specified url.
				logger.info(`Connecting to tier: ${thisProcessTier}: "${thisDBinfo.url.substring(0, 23)}..."`);
				url = thisDBinfo.url;
			}
			//If there is no object in databases for default, throw an error.
			else{
				throw new Error(`No default database URL specified in databases`);
			}
		}
	}
	//If there is no databases file, then connect to localhost
	else {
		logger.warn("utilities: No databases file found; Defaulting to localhost:27017/app");
		url = "mongodb://localhost:27017/app";
	}
	
	return url;
	*/
};

/**
 * Internal function to execute whenever ready
 * @param {function} cb Callback
 */
utilities.whenReady = function(cb) {
	logger.addContext('funcName', 'whenReady');
	logger.trace('ENTER');
	
	//if state is already ready, then execute immediately
	if (this.ready == true) {
		logger.trace('ready=true; executing cb');
		cb();
	}
	//if not ready, then add request to queue
	else {
		logger.trace('ready=false; adding cb to queue');
		this.whenReadyQueue.push(cb);
	}
	
	logger.removeContext('funcName');
};

/**
 * Express middleware function to refresh the active tier of utilities.js.
 */
utilities.refreshTier = function(req, res, next) {
//	logger.addContext('funcName', 'refreshTier');
//	logger.trace('ENTER')
	
	//set this.ready to true
	utilities.ready = true;
	utilities.activeTier = process.env.TIER;
	
	//	logger.trace(`queue.length=${utilities.whenReadyQueue.length}`);
	
	while (utilities.whenReadyQueue.length > 0) {
		var cb = utilities.whenReadyQueue.splice(0, 1)[0];
		cb();
	}
	
	//	logger.removeContext('funcName');
	if (typeof next == 'function') next();
};

/**
 * Asynchronous "find" function to a collection specified in first parameter.
 * @param {string} collection Collection to find in.
 * @param {object} [query={}] Filter for query.
 * @param {object} [options={}] Query options, such as sort.
 * @param {object} [cacheOptions=undefined] Caching options.
 * @param {boolean} [cacheOptions.allowCache=false] Whether this request can be cached. If true, then identical requests will be returned from the cache.
 * @param {number} [cacheOptions.maxCacheAge=30] Max age for this cached request.
 */
utilities.find = async function(collection, query, options, cacheOptions){
	logger.addContext('funcName', 'find');
	
	//Collection type filter
	if (typeof collection != 'string') throw new TypeError('Collection must be specified.');
	//Query type filter
	if (!query) query = {};
	if (typeof query != 'object') throw new TypeError('query must be of type object');
	//Options type filter
	if (!options) options = {};
	if (typeof options != 'object') throw new TypeError('Options must be of type object');
	//Cache options
	if (!cacheOptions) cacheOptions = {};
	if (typeof cacheOptions != 'object') throw new TypeError('cacheOptions must be of type object');
	if (cacheOptions.allowCache != undefined && typeof cacheOptions.allowCache != 'boolean') throw new TypeError('cacheOptions.allowCache must be of type boolean');
	if (cacheOptions.maxCacheAge != undefined && typeof cacheOptions.maxCacheAge != 'number') throw new TypeError('cacheOptions.maxCacheAge must be of type number');
	if (!cacheOptions.allowCache) cacheOptions.allowCache = false;
	if (!cacheOptions.maxCacheAge) cacheOptions.maxCacheAge = this.options.cache.maxAge;
	
	logger.trace(`${collection}, ${JSON.stringify(query)}, ${JSON.stringify(options)}, maxCacheAge: ${cacheOptions.maxCacheAge}`);
	var timeLogName = `find: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable} ${Math.floor(1000*Math.random())}`;
	consoleTime(timeLogName);
	
	var returnData, cachedRequest;
	
	//If cache is enabled
	if (cacheOptions.allowCache == true && this.options.cache.enable == true) {
		
		logger.trace('Caching enabled');
		var hashedQuery = await this.hashQuery('find', collection, query, options);
		logger.trace(`(find) Request Hash: ${hashedQuery}`);
		
		//Look in cache for the query
		if (this.cache.get(hashedQuery)) {
			cachedRequest = this.cache.get(hashedQuery);
			
			logger.trace(`Serving request from cache (find:${collection})`);
			logger.trace(`${hashedQuery}: ${JSON.stringify(cachedRequest).substring(0, 1000)}...`);
			consoleTimeEnd(timeLogName);
			
			returnData = cachedRequest;
		}
		//If query has not yet been cached
		else {
			logger.trace(`Caching request (find:${collection})`);
			
			//Request db
			let {db} = await this.getDB();
			cachedRequest = await db.get(collection).find(query, options);
			//Cache response (Including maxAge before automatic deletion)
			this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);
			
			logger.trace(`${hashedQuery}: ${JSON.stringify(cachedRequest).substring(0, 1000)}...`);
			consoleTimeEnd(timeLogName);
			
			returnData = cachedRequest;
		}
	}
	//If cache is not enabled
	else {
		
		//Must use object destructuring because returning monk from an async function hangs the process
		let {db} = await this.getDB();
		//Request db
		var data = await db.get(collection).find(query, options);
		logger.trace(`non-cached: result: ${JSON.stringify(data)}`);
		consoleTimeEnd(timeLogName);
		
		returnData = data;
	}
	
	logger.removeContext('funcName');
	return returnData;
};

/**
 * Asynchronous "findOne" function to a collection specified in first parameter.
 * @param {string} collection Collection to findOne in.
 * @param {object} [query={}] Filter for query.
 * @param {object} [options={}] Query options, such as sort.
 * @param {object} [cacheOptions=undefined] Caching options.
 * @param {boolean} [cacheOptions.allowCache=false] Whether this request can be cached. If true, then identical requests will be returned from the cache.
 * @param {number} [cacheOptions.maxCacheAge=30] Max age for this cached request.
 */
utilities.findOne = async function(collection, query, options, cacheOptions){
	logger.addContext('funcName', 'findOne');
	
	//Collection type filter
	if (typeof collection != 'string') throw new TypeError('utilities.findOne: Collection must be specified.');
	//Query type filter
	if (!query) query = {};
	if (typeof query != 'object') throw new TypeError('utilities.findOne: query must be of type object');
	//Options type filter
	if (!options) options = {};
	if (typeof options != 'object') throw new TypeError('utilities.findOne: Options must be of type object');
	//Cache options
	if (!cacheOptions) cacheOptions = {};
	if (typeof cacheOptions != 'object') throw new TypeError('utilities.findOne: cacheOptions must be of type object');
	if (cacheOptions.allowCache != undefined && typeof cacheOptions.allowCache != 'boolean') throw new TypeError('cacheOptions.allowCache must be of type boolean');
	if (cacheOptions.maxCacheAge != undefined && typeof cacheOptions.maxCacheAge != 'number') throw new TypeError('cacheOptions.maxCacheAge must be of type number');
	if (!cacheOptions.allowCache) cacheOptions.allowCache = false;
	if (!cacheOptions.maxCacheAge) cacheOptions.maxCacheAge = this.options.cache.maxAge;
	
	logger.trace(`${collection}, ${JSON.stringify(query)}, ${JSON.stringify(options)}`);
	var timeLogName = `findOne: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable} ${Math.floor(1000*Math.random())}`;
	consoleTime(timeLogName);
	
	var returnData, data, cachedRequest;
	
	//If cache is enabled
	if (cacheOptions.allowCache == true && this.options.cache.enable == true) {
		
		logger.trace('Caching enabled');
		var hashedQuery = await this.hashQuery('findOne', collection, query, options);
		logger.trace(`(findOne) Request Hash: ${hashedQuery}`);
		
		//Look in cache for the query
		if (this.cache.get(hashedQuery)) {
			cachedRequest = this.cache.get(hashedQuery);
			
			logger.trace(`Serving request from cache (findOne:${collection})`);
			logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
			consoleTimeEnd(timeLogName);
			
			returnData = cachedRequest;
		}
		//If query has not yet been cached
		else {
			logger.trace(`Caching request (findOne:${collection})`);
			
			//Request db
			let {db} = await this.getDB();
			cachedRequest = await db.get(collection).findOne(query, options);
			//Cache response (Including maxAge before automatic deletion)
			this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);
			
			logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
			consoleTimeEnd(timeLogName);
			
			returnData = cachedRequest;
		}
	}
	//If cache is not enabled
	else {
		
		//Request db
		let {db} = await this.getDB();
		data = await db.get(collection).findOne(query, options);
		logger.trace(`Not cached (findOne:${collection})`);
		logger.trace(`non-cached: result: ${JSON.stringify(data)}`);
		consoleTimeEnd(timeLogName);
		
		returnData = data;
	}
	
	logger.removeContext('funcName');
	return returnData;
};

/**
 * Asynchronous "update" function to a collection specified in first parameter.
 * @param {string} collection Collection to find in.
 * @param {object} query Filter query.
 * @param {object} update Update query.
 * @param {object} options Query options, such as sort.
 * @returns {WriteResult} writeResult
 */
utilities.update = async function(collection, query, update, options){
	logger.addContext('funcName', 'update');
	
	//Collection filter
	if (typeof collection != 'string') throw new TypeError('Utilities.update: Collection must be specified.');
	//Query type filter
	if (!query) query = {};
	if (typeof query != 'object') throw new TypeError('Utilities.update: query must be of type object');
	//Update filter
	if (typeof update != 'object') throw new TypeError('Utilities.update: update must be specified and of type object');
	//Query options filter
	if (!options) options = {};
	if (typeof options != 'object') throw new TypeError('Utilities.update: Options must be of type object');
	
	logger.trace(`utilities.update: ${collection}, param: ${JSON.stringify(query)}, update: ${JSON.stringify(update)}, options: ${JSON.stringify(options)}`);
	var timeLogName = `update: ${collection} ${Math.floor(1000*Math.random())}`;
	consoleTime(timeLogName);
	
	var queryHashFind = await this.hashQuery('find', collection, query, options);
	var queryHashFindOne = await this.hashQuery('findOne', collection, query, options);
	logger.trace(`find hash: ${queryHashFind}, findOne hash: ${queryHashFindOne}`);
	
	//If cached responses for either hashed query exist, then delete them
	this.cache.del(queryHashFind);
	this.cache.del(queryHashFindOne);
	
	//Remove in collection with query
	var writeResult = new WriteResult();
	let {db} = await this.getDB();
	writeResult = await db.get(collection).update(query, update, options);
	
	logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
	consoleTimeEnd(timeLogName);
	
	logger.removeContext('funcName');
	//return writeResult
	return writeResult;
};

/**
 * Asynchronous "aggregate" function to a collection specified in first parameter.
 * @param {string} collection Collection to find in.
 * @param {object} pipeline Array containing all the aggregation framework commands for the execution.
 * @param {object} [cacheOptions=undefined] Caching options.
 * @param {boolean} [cacheOptions.allowCache=false] Whether this request can be cached. If true, then identical requests will be returned from the cache.
 * @param {number} [cacheOptions.maxCacheAge=30] Max age for this cached request.
 * @returns {object} Aggregated data.
 */
utilities.aggregate = async function(collection, pipeline, cacheOptions) {
	logger.addContext('funcName', 'aggregate');
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != 'string') throw new TypeError('Utilities.aggregate: Collection must be specified.');
	//If query does not exist or is not an object, throw an error. 
	if(typeof(pipeline) != 'object') throw new TypeError('Utilities.aggregate: pipieline must be of type object');
	//Cache options
	if (!cacheOptions) cacheOptions = {};
	if (typeof cacheOptions != 'object') throw new TypeError('Utilities.aggregate: cacheOptions must be of type object');
	if (cacheOptions.allowCache != undefined && typeof cacheOptions.allowCache != 'boolean') throw new TypeError('cacheOptions.allowCache must be of type boolean');
	if (cacheOptions.maxCacheAge != undefined && typeof cacheOptions.maxCacheAge != 'number') throw new TypeError('cacheOptions.maxCacheAge must be of type number');
	if (!cacheOptions.allowCache) cacheOptions.allowCache = false;
	if (!cacheOptions.maxCacheAge) cacheOptions.maxCacheAge = this.options.cache.maxAge;
	
	var timeLogName = `agg: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable} ${Math.floor(1000*Math.random())}`;
	consoleTime(timeLogName);
	logger.trace(`${collection}, ${JSON.stringify(pipeline)}`);
	
	var returnData, cachedRequest, data; 
	//If cache is enabled
	if (cacheOptions.allowCache == true && this.options.cache.enable == true) {
		
		logger.trace('Caching enabled');
		var hashedQuery = await this.hashQuery('aggregate', collection, pipeline, {});
		logger.trace(`(aggregate) Request Hash: ${hashedQuery}`);
		
		//Look in cache for the query
		if (this.cache.get(hashedQuery)) {
			cachedRequest = this.cache.get(hashedQuery);
			
			logger.trace(`Serving request from cache (aggregate:${collection})`);
			logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
			consoleTimeEnd(timeLogName);
			
			returnData = cachedRequest;
		}
		//If query has not yet been cached
		else {
			logger.trace(`Caching request (aggregate:${collection})`);
			
			//Request db
			let {db} = await this.getDB();
			cachedRequest = await db.get(collection).aggregate(pipeline);
			//Cache response (Including maxAge before automatic deletion)
			this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);
			
			logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
			consoleTimeEnd(timeLogName);
			
			returnData = cachedRequest;
		}
	}
	//If cache is not enabled
	else {
	
		//Aggregate
		let {db} = await this.getDB();
		data = await db.get(collection).aggregate(pipeline);
		
		logger.trace(`Not cached (aggregate:${collection})`);
		logger.trace(`result: ${JSON.stringify(data)}`);
		consoleTimeEnd(timeLogName);
		
		//Return (Promise to get) data
		returnData = data;
	}
	
	logger.removeContext('funcName');
	return returnData;
};

utilities.dumpCache = function(){
	logger.addContext('funcName', 'dumpCache');
	
	//console.log(JSON.stringify(this.cache));
	const used = process.memoryUsage().heapUsed / 1024 / 1024;
	console.log(`The process uses approximately ${Math.round(used * 100) / 100} MB`);
	
	logger.removeContext('funcName');
};

/**
 * @param {string} type Type of function
 * @param {string} collection Collection
 * @param {object} param1 First param (oft. query)
 * @param {object} param2 Second param (oft. options)
 */
utilities.hashQuery = async function(type, collection, param1, param2) {
	//logger.addContext('funcName', 'hashQuery');
	
	type = type.toString();
	collection = collection.toString();
	param1 = JSON.stringify(param1);
	param2 = JSON.stringify(param2);
	
	const hash = crypto.Hash('sha1');
	//2020-03-23 JL: added tier to hash
	hash.update(process.env.TIER + type + collection + param1 + param2);
	
	//logger.removeContext('funcName');
	return hash.digest('hex');
};

/**
 * Asynchronous "distinct" function to a collection specified in first parameter.
 * @param {string} collection Collection to find in.
 * @param {string} field Which field to distinct.
 * @param {object} query The query for filtering the set of documents to which we apply the distinct filter.
 * @returns {array} Distinct values for the specified field
 */
utilities.distinct = async function(collection, field, query){
	logger.addContext('funcName', 'distinct');
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != 'string'){
		throw new TypeError('Utilities.distinct: Collection must be specified.');
	}
	if(typeof(field) != 'string'){
		throw new TypeError('Utilities.distinct: Field string must be specified.');
	}
	//If query filter are not set, create an empty object for the DB call.
	if(!query) query = {};
	//If query exists and is not an object, throw an error. 
	if(typeof(query) != 'object'){
		throw new TypeError('Utilities.distinct: query must be of type object');
	}
	
	logger.trace(`${collection}, ${JSON.stringify(query)}`);
	
	//Find in collection with query and options
	let {db} = await this.getDB();
	var data = await db.get(collection).distinct(field, query);
	
	logger.trace(`result: ${JSON.stringify(data)}`);
	
	logger.removeContext('funcName');
	//Return (Promise to get) data
	return data;
};

/**
 * Asynchronous "bulkWrite" function to a collection specified in first parameter.
 * @param {string} collection Collection to find in.
 * @param {array} operations Array of Bulk operations to perform.
 * @param {object} options Optional settings.
 * @returns {WriteResult} writeResult
 */
utilities.bulkWrite = async function(collection, operations, options){
	logger.addContext('funcName', 'bulkWrite');
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != 'string'){
		throw new TypeError('Utilities.bulkWrite: Collection must be specified.');
	}
	
	//If operations does not exist or is not an array, throw an error. 
	if(!Array.isArray(operations)){
		throw new TypeError('Utilities.bulkWrite: Operations must be specified and is an array of operations');
	}
	
	//If query options are not set, create an empty object for the DB call.
	if(!options) options = {};
	//If options exists and is not an object, throw an error. 
	if(typeof(options) != 'object'){
		throw new TypeError('Utilities.bulkWrite: options must be of type object');
	}
	
	logger.trace(`${collection}, operations: ${JSON.stringify(operations)}, param: ${JSON.stringify(options)}`);

	//Update in collection with options
	var writeResult = new WriteResult();
	let {db} = await this.getDB();
	writeResult = await db.get(collection).bulkWrite(operations, options);
	
	logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
	
	logger.removeContext('funcName');
	//return result
	return writeResult;
};

/**
 * Asynchronous "remove" function to a collection specified in first parameter.
 * @param {string} collection Collection to remove from.
 * @param {object} query Filter for element/s to remove.
 * @return {WriteResult} writeResult
 */
utilities.remove = async function(collection, query){
	logger.addContext('funcName', 'remove');
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof collection != 'string') throw new TypeError('utilities.remove: Collection must be specified.');
	//If query query are not set, create an empty object for the DB call.
	if(!query) query = {};
	//If query exists and is not an object, throw an error. 
	if(typeof query != 'object') throw new TypeError('utilities.remove: query must be of type object');
	
	logger.trace(`${collection}, param: ${JSON.stringify(query)}`);
	
	//Remove in collection with query
	var writeResult = new WriteResult();
	var {db} = await this.getDB();
	writeResult = await db.get(collection).remove(query);
	
	logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
	
	logger.removeContext('funcName');
	//return writeResult
	return writeResult;
};

/**
 * Asynchronous "insert" function to a collection specified in first parameter.
 * @param {string} collection Collection to insert into.
 * @param {object} elements [Any] Element or array of elements to insert
 * @returns {WriteResult} writeResult
 */
utilities.insert = async function(collection, elements){
	logger.addContext('funcName', 'insert');
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof collection != 'string') throw new TypeError('Utilities.insert: Collection must be specified.');
	//If elements are not set, throw an error
	if(!elements) throw new TypeError('Utilities.insert: Must contain an element or array of elements to insert.');
	
	logger.trace(`${collection}, elements: ${JSON.stringify(elements)}`);
	
	//Insert in collection
	var writeResult = new WriteResult();
	let {db} = await this.getDB();
	writeResult = await db.get(collection).insert(elements);
	
	logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
	
	logger.removeContext('funcName');
	//return writeResult
	return writeResult;
};

/**
 * Asynchronous request to TheBlueAlliance. Requires a URL ending to execute correctly.
 * @param {string} url ENDING of URL, after "https://.../api/v3/" DO NOT INCLUDE A / AT THE START
 * @return {object} JSON-formatted response from TBA
 */
utilities.requestTheBlueAlliance = async function(url){
	logger.addContext('funcName', 'requestTheBlueAlliance');
	
	//Setup our request URL, including specified URL ending parameter
	var requestURL = 'https://www.thebluealliance.com/api/v3/' + url + `?t=${Date.now()}`;
	
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
			let str = tbaData.toString().replace(/\n/g, '');
			
			logger.debug(`TBA response: ${str.substring(0, 1000)}...`);
			logger.trace(`Full TBA response: ${str}`);
			
			logger.removeContext('funcName');
			//Inside client callback, resolve promise
			resolve(tbaData);
		});
	});
	
	//Resolve promise
	return thisPromise;
};

/**
 * Asynchronous function to get our TheBlueAlliance API key from the DB.
 * @return {object} - TBA header arguments
 */
utilities.getTBAKey = async function(){
	logger.addContext('funcName', 'getTBAKey');
	
	var tbaArgs = await utilities.findOne('passwords', {name: 'tba-api-headers'});
	
	if(tbaArgs){
		var headers = tbaArgs.headers;
		var key = {'headers': headers};
		
		logger.removeContext('funcName');
		return key;
	}
	else{
		//**********CONSIDER ANOTHER OPTION FOR HANDLING "CAN'T FIND REQUEST ARGS"
		logger.fatal('utilities.getTBAKey: Could not find tba-api-headers in database');
		
		logger.removeContext('funcName');
		throw 'Could not find api-headers in database';
	}
};



class WriteResult{
	/**
	 * A wrapper that contains the result status of the mongo shell write methods.
	 * @param {number} nInserted The number of documents inserted, excluding upserted documents.
	 * @param {number} nMatched The number of documents selected for update.
	 * @param {number} nModified The number of existing documents updated.
	 * @param {number} nUpserted The number of documents inserted by an upsert.
	 * @param {ObjectId} _id The _id of the document inserted by an upsert. Returned only if an upsert results in an insert.
	 * @param {number} nRemoved The number of documents removed.
	 * @param {object} writeError A document that contains information regarding any error, excluding write concern errors, encountered during the write operation.
	 * @param {number} writeError.code An integer value identifying the error.
	 * @param {string} writeError.errmsg A description of the error.
	 * @param {object} writeConcernError A document that contains information regarding any write concern errors encountered during the write operation.
	 * @param {number} writeConcernError.code An integer value identifying the write concern error.
	 * @param {any} writeConcernError.errInfo A document identifying the write concern setting related to the error.
	 * @param {string} writeConcernError.errmsg A description of the error.
	 */
	constructor(nInserted, nMatched, nModified, nUpserted, _id, nRemoved, writeError, writeConcernError){
		this.nInserted = nInserted;
		this.nMatched = nMatched;
		this.nModified = nModified;
		this.nUpserted = nUpserted;
		this._id = _id;
		this.nRemoved = nRemoved;
		this.writeError = writeError;
		this.writeConcernError = writeConcernError;
	}
}