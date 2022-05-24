'use strict';

import NodeCache from 'node-cache';
import { ObjectId, MongoClient, Db, Document as MongoDocument, 
	Filter, UpdateFilter, FindOptions, UpdateOptions, AnyBulkWriteOperation, BulkWriteOptions,
	InsertManyResult, InsertOneResult, BulkWriteResult, UpdateResult, DeleteResult } from 'mongodb';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import log4js from '@log4js-node/log4js-api';

const Client = require('node-rest-client').Client;

const logger = log4js.getLogger('utilities');
logger.level = process.env.LOG_LEVEL || 'info';

/**
 * Optional settings for configurating SR-Utilities.
 * @param cache
 * @param debug
 */
export class UtilitiesOptions {
	/**
	 * Default caching options for database requests.
	 * @param {boolean} enable
	 * @param {number} maxAge
	 */
	cache: {
		/**
		 * Whether to allow cache on database requests. If disabled, no caching will be used.
		 */
		enable: boolean;
		/**
		 * Default cache maximum age, in seconds.
		 */
		maxAge: number;
	};
	/**
	 * Whether to add extensive logger.trace statements
	 */
	debug: boolean;
	constructor(options?: any) {
		if (typeof options === 'object' && typeof options.debug === 'boolean') this.debug = options.debug;
		else this.debug = false;
		
		let defaultCacheOpts = {
			enable: false,
			maxAge: 30
		};
		
		if (typeof options === 'object' && typeof options.cache === 'object') {
			let cache = defaultCacheOpts;
			if (typeof options.cache.enable === 'boolean') cache.enable = options.cache.enable;
			if (typeof options.cache.maxAge === 'number') cache.maxAge = options.cache.maxAge;
			this.cache = cache;
		}
		else {
			this.cache = defaultCacheOpts;
		}
		
		this.debug = false;
	}
}

export class Utilities {
	activeTier: any;
	dbConfig: any;
	ready: boolean;
	whenReadyQueue: any[];
	cache: NodeCache;
	options: UtilitiesOptions;
	client: typeof Client;
	// Utilities is a singleton class. The refreshTier function is passed as a middleware, so the "this" argument gets messed up. 
	//  To avoid having to change code, we can instead use Utilities.instance.x
	static instance: Utilities = new Utilities(); 
	
	private _cacheFlushTimeout?: NodeJS.Timeout;
	
	constructor() {
		this.activeTier = null;
		this.dbConfig = null;
		this.ready = false;
		this.whenReadyQueue = [];
		this.cache = new NodeCache({stdTTL: 30});
		this.options = new UtilitiesOptions();
		this.client = new Client();
	}
	
	/**
	 * Create a MongoDB ObjectID, either from a string or a random new one
	 * @param str ID-like string
	 * @returns MongoDB Object ID
	 */
	id(str?: string): ObjectId {
		if (!str) return new ObjectId();
		return typeof str === 'string' ? ObjectId.createFromHexString(str) : str;
	}
	
	/**
	 * Flush DB cache, but after a few milliseconds to avoid stalling requests.
	 */
	flushCache(): void {
		if (!this._cacheFlushTimeout) {
			this._cacheFlushTimeout = setTimeout(() => {
				this.cache.flushAll();
				this._cacheFlushTimeout = undefined;
			}, 5);
		}
	}
	
	/**
	 * (Required) Configure utilities with database config file.
	 * @param databaseConfig JSON object for database config (use require('databases.json') for security)
	 * @param options Optional settings
	 * @param options.cache Cache settings
	 * @param {boolean} [options.cache.enable=false] Whether to enable or disable caching in find requests
	 * @param {number} [options.cache.maxAge=30] Default maximum age of cached requests, in seconds
	 * @param {debug} [options.debug=false] Whether to enable extra debug logging (Performance, timing, etc.)
	 */
	config(databaseConfig: UtilitiesConfig, options: UtilitiesOptions): void{
		if (typeof databaseConfig != 'object') throw new TypeError('opts.databaseConfig must be provided. Use require("databases.json").');
		
		if (!options) options = new UtilitiesOptions(options);
		if (typeof options != 'object') throw new TypeError('opts must be an object');
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
	}
	
	

	/**
	 * Function that first caches, then returns the cached database for the server process.
	 * @returns {Promise<Db>} Database ref
	 */
	getDB(): Promise<Db> {
		
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve, reject) => {
			
			//create db return variable
			let db;
			
			let tier = this.activeTier;
			let dbRef = this.dbRefs[tier];
			let client = this.clients[tier];
			let url = this.urls[tier];
			// logger.trace(`(getDB) tier=${tier} dbRef=${dbRef} url=${url}`);
			
			//2020-03-23 JL: one db ref for every tier
			if (!dbRef || !client || !url) {
				this.enterDbLock();
				
				logger.info(`(getDB) Creating db ref for ${tier}`);
				url = await this.getDBurl();
				this.urls[tier] = url;
				
				logger.trace(`(getDB) Got url, url=${url}, tier=${tier} this.activeTier=${this.activeTier}`);
				
				this.open(url)
					.then(([client, db]) => {
						logger.info('(getDB) Connected!');
						
						// Resolve client & db, then unlock db
						this.clients[tier] = client;
						this.dbRefs[tier] = db;
						this.leaveDbLock(); 
					})
					.catch(err => {
						logger.error(JSON.stringify(err));
					});
			}
			
			//if ref has aged past its prime, then close and reopen it
			if (this.lastRequestTime[tier] && this.lastRequestTime[tier] + this.refMaxAge < Date.now()) {
				
				this.enterDbLock(); // Lock the database until a new connection has been achieved
				
				logger.info('(getDB) Ref has aged too much; Reconnecting');
				
				// lastRequestTime must be refreshed immediately (not after connection) 
				//	to avoid multiple reconnect attempts
				this.lastRequestTime[tier] = Date.now();
				
				client.close();
				this.open(url)
					.then(([client, db]) => {
						this.clients[tier] = client;
						this.dbRefs[tier] = db;
						logger.info('(getDB) Connected!');
						
						this.leaveDbLock(); // Unlock the database
						resolve(db);
					})
					.catch(err => {
						logger.error(JSON.stringify(err));
						// Resolve with old db (even if it's closed) (this shouldn't occur)
						logger.error('(getDB) Error connecting');
						
						reject(err);
						this.leaveDbLock();
					});
			}
			else {
				
				await this.dbLock();
				
				// Reload the db ref in case it has been reconnected
				db = this.dbRefs[tier];
			
				//renew lastRequestTime
				this.lastRequestTime[tier] = Date.now();
				
				logger.trace('(getDB) returning db');
				
				resolve(db);
			}
		});
	}

	/**
	 * Function that retrieves the database connection string from databases, and returns that connection string URL.
	 * If databases does not exist, it defaults to localhost.
	 * @returns Database connection uri.
	 */
	getDBurl(): Promise<string> {
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
				let thisDBinfo = this.dbConfig[this.activeTier];
				
				if (!thisDBinfo || !thisDBinfo.url) {
					return reject('No database URL specified for tier '+ this.activeTier);
				}
				
				logger.info(`Connecting to tier: ${this.activeTier}: "${thisDBinfo.url.substring(0, 23)}..."`);
				resolve(thisDBinfo.url);
				
				logger.removeContext('funcName');
			});
		});
	}

	/**
	 * Internal function to execute whenever ready
	 * @param {function} cb Callback
	 */
	whenReady(cb: () => void) {
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
	}

	/**
	 * Express middleware function to refresh the active tier of utilities.ts.
	 * @example 
	 * 	const app = express();
	 * 	app.use(utilities.refreshTier);
	 */
	refreshTier(req: Request, res: Response, next: NextFunction) {
		
		//set ready to true
		Utilities.instance.ready = true;
		Utilities.instance.activeTier = process.env.TIER;
		
		while (Utilities.instance.whenReadyQueue.length > 0) {
			let cb = Utilities.instance.whenReadyQueue.splice(0, 1)[0];
			cb();
		}
		
		if (typeof next === 'function') next();
	}

	/**
	 * Asynchronous "find" function to a collection specified in first parameter.
	 * @param collection Collection to find in.
	 * @param query Filter for query.
	 * @param options Query options, such as sort.
	 * @param cacheOption Caching options.
	 */
	async find(collection: string, query: Filter<MongoDocument>, options?: FindOptions, cacheOptions?: UtilitiesCacheOptions): Promise<any> {
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
		query = this.castID(query);
		
		logger.trace(`${collection}, ${JSON.stringify(query)}, ${JSON.stringify(options)}, maxCacheAge: ${cacheOptions.maxCacheAge}`);
		let timeLogName = `find: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable}`;
		this.consoleTime(timeLogName);
		
		let returnData: MongoDocument[];
		
		//If cache is enabled
		if (cacheOptions.allowCache === true && this.options.cache.enable === true) {
			
			logger.trace('Caching enabled');
			let hashedQuery = await this.hashQuery('find', collection, query, options);
			logger.trace(`(find) Request Hash: ${hashedQuery}`);
			
			let cachedRequest: MongoDocument[] | undefined = this.cache.get(hashedQuery);
			
			//Look in cache for the query
			if (cachedRequest) {
				
				logger.trace(`Serving request from cache (find:${collection})`);
				logger.trace(`${hashedQuery}: ${JSON.stringify(cachedRequest).substring(0, 1000)}...`);
				this.consoleTimeEnd(timeLogName);
				
				returnData = cachedRequest;
			}
			//If query has not yet been cached
			else {
				logger.trace(`Caching request (find:${collection})`);
				
				//Request db
				let db = await this.getDB();
				cachedRequest = await db.collection(collection).find(query, options).toArray();
				//Cache response (Including maxAge before automatic deletion)
				this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);
				
				logger.trace(`${hashedQuery}: ${JSON.stringify(cachedRequest).substring(0, 1000)}...`);
				this.consoleTimeEnd(timeLogName);
				
				returnData = cachedRequest;
			}
		}
		//If cache is not enabled
		else {
			
			let db = await this.getDB();
			//Request db
			let data = await db.collection(collection).find(query, options).toArray();
			// logger.trace(`non-cached: result: ${JSON.stringify(data)}`);
			this.consoleTimeEnd(timeLogName);
			
			returnData = data;
		}
		
		logger.removeContext('funcName');
		return returnData;
	}

	/**
	 * Asynchronous "findOne" function to a collection specified in first parameter.
	 * @param collection Collection to findOne in.
	 * @param query Filter for query.
	 * @param options Query options, such as sort.
	 * @param cacheOptions Caching options.
	 */
	async findOne(collection: string, query: Filter<MongoDocument>, options?: FindOptions, cacheOptions?: UtilitiesCacheOptions): Promise<any>{
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
		query = this.castID(query);
		
		logger.trace(`${collection}, ${JSON.stringify(query)}, ${JSON.stringify(options)}`);
		let timeLogName = `findOne: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable}`;
		this.consoleTime(timeLogName);
		
		let returnData, data;
		
		//If cache is enabled
		if (cacheOptions.allowCache == true && this.options.cache.enable == true) {
			
			logger.trace('Caching enabled');
			let hashedQuery = await this.hashQuery('findOne', collection, query, options);
			logger.trace(`(findOne) Request Hash: ${hashedQuery}`);
			
			let cachedRequest: MongoDocument | undefined | null = this.cache.get(hashedQuery);
			
			//Look in cache for the query
			if (cachedRequest) {
				
				logger.trace(`Serving request from cache (findOne:${collection})`);
				logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);
				
				returnData = cachedRequest;
			}
			//If query has not yet been cached
			else {
				logger.trace(`Caching request (findOne:${collection})`);
				
				//Request db
				let db = await this.getDB();
				cachedRequest = await db.collection(collection).findOne(query, options);
				//Cache response (Including maxAge before automatic deletion)
				this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);
				
				logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);
				
				returnData = cachedRequest;
			}
		}
		//If cache is not enabled
		else {
			//Request db
			let db = await this.getDB();
			data = await db.collection(collection).findOne(query, options);
			logger.trace(`Not cached (findOne:${collection})`);
			// logger.trace(`non-cached: result: ${JSON.stringify(data)}`);
			this.consoleTimeEnd(timeLogName);
			
			returnData = data;
		}
		
		logger.removeContext('funcName');
		return returnData;
	}

	/**
	 * Asynchronous "update" function to a collection specified in first parameter.
	 * @param collection Collection to find in.
	 * @param query Filter query.
	 * @param update Update query.
	 * @param options Query options, such as sort.
	 * @returns {WriteResult} writeResult
	 */
	async update(collection: string, query: Filter<MongoDocument>, update: UpdateFilter<MongoDocument>, options?: UpdateOptions): Promise<UpdateResult | MongoDocument>{
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
		query = this.castID(query);
		
		logger.trace(`utilities.update: ${collection}, param: ${JSON.stringify(query)}, update: ${JSON.stringify(update)}, options: ${JSON.stringify(options)}`);
		let timeLogName = `update: ${collection}`;
		this.consoleTime(timeLogName);
		
		let queryHashFind = await this.hashQuery('find', collection, query, options);
		let queryHashFindOne = await this.hashQuery('findOne', collection, query, options);
		logger.trace(`find hash: ${queryHashFind}, findOne hash: ${queryHashFindOne}`);
		
		//If cached responses for either hashed query exist, then delete them
		this.cache.del(queryHashFind);
		this.cache.del(queryHashFindOne);
		
		//Remove in collection with query
		let db = await this.getDB();
		let writeResult = await db.collection(collection).updateMany(query, update, options);
		
		// logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
		this.consoleTimeEnd(timeLogName);
		
		logger.removeContext('funcName');
		//return writeResult
		return writeResult;
	}

	/**
	 * Asynchronous "aggregate" function to a collection specified in first parameter.
	 * @param collection Collection to find in.
	 * @param pipeline Array containing all the aggregation framework commands for the execution.
	 * @param cacheOptions Caching options.
	 * @returns Aggregated data.
	 */
	async aggregate(collection: string, pipeline: MongoDocument[], cacheOptions?: UtilitiesCacheOptions): Promise<any> {
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
		
		let timeLogName = `agg: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable}`;
		this.consoleTime(timeLogName);
		logger.trace(`${collection}, ${JSON.stringify(pipeline)}`);
		
		let returnData: MongoDocument[], data; 
		//If cache is enabled
		if (cacheOptions.allowCache == true && this.options.cache.enable == true) {
			
			logger.trace('Caching enabled');
			let hashedQuery = await this.hashQuery('aggregate', collection, pipeline, {});
			logger.trace(`(aggregate) Request Hash: ${hashedQuery}`);
			
			let cachedRequest: MongoDocument[] | undefined = this.cache.get(hashedQuery);
			
			//Look in cache for the query
			if (cachedRequest) {
				
				logger.trace(`Serving request from cache (aggregate:${collection})`);
				logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);
				
				returnData = cachedRequest;
			}
			//If query has not yet been cached
			else {
				logger.trace(`Caching request (aggregate:${collection})`);
				
				//Request db
				let db = await this.getDB();
				cachedRequest = await db.collection(collection).aggregate(pipeline).toArray();
				//Cache response (Including maxAge before automatic deletion)
				this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);
				
				logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);
				
				returnData = cachedRequest;
			}
		}
		//If cache is not enabled
		else {
		
			//Aggregate
			let db = await this.getDB();
			data = await db.collection(collection).aggregate(pipeline).toArray();
			
			logger.trace(`Not cached (aggregate:${collection})`);
			// logger.trace(`result: ${JSON.stringify(data)}`);
			this.consoleTimeEnd(timeLogName);
			
			//Return (Promise to get) data
			returnData = data;
		}
		
		logger.removeContext('funcName');
		return returnData;
	}

	dumpCache(): void {
		logger.addContext('funcName', 'dumpCache');
		
		//console.log(JSON.stringify(this.cache));
		const used = process.memoryUsage().heapUsed / 1024 / 1024;
		console.log(`The process uses approximately ${Math.round(used * 100) / 100} MB`);
		
		logger.removeContext('funcName');
	}

	/**
	 * @param type Type of function
	 * @param collection Collection
	 * @param param1 First param (oft. query)
	 * @param param2 Second param (oft. options)
	 */
	async hashQuery(type: string, collection: string, param1: Filter<MongoDocument>, param2: UpdateOptions) {
		
		collection = collection.toString();
		let param1String = JSON.stringify(param1);
		let param2String = JSON.stringify(param2);
		
		const hash = crypto.createHash('sha1');
		//2020-03-23 JL: added tier to hash
		hash.update(process.env.TIER + type + collection + param1String + param2String);
		
		//logger.removeContext('funcName');
		return hash.digest('hex');
	}

	/**
	 * Asynchronous "distinct" function to a collection specified in first parameter.
	 * @param collection Collection to find in.
	 * @param field Which field to distinct.
	 * @param query The query for filtering the set of documents to which we apply the distinct filter.
	 * @returns Distinct values for the specified field
	 */
	async distinct(collection: string, field: string, query: Filter<MongoDocument>){
		logger.addContext('funcName', 'distinct');
		
		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if(typeof(collection) != 'string') throw new TypeError('Utilities.distinct: Collection must be specified.');
		if(typeof(field) != 'string') throw new TypeError('Utilities.distinct: Field string must be specified.');
		//If query filter are not set, create an empty object for the DB call.
		if(!query) query = {};
		//If query exists and is not an object, throw an error. 
		if(typeof(query) != 'object') throw new TypeError('Utilities.distinct: query must be of type object'); 
		query = this.castID(query);
		
		let timeLogName = `distinct: ${collection}`;
		this.consoleTime(timeLogName);
		
		logger.trace(`${collection}, ${JSON.stringify(query)}`);
		
		//Find in collection with query and options
		let db = await this.getDB();
		let data = await db.collection(collection).distinct(field, query);
		
		// logger.trace(`result: ${JSON.stringify(data)}`);
		this.consoleTimeEnd(timeLogName);
		
		logger.removeContext('funcName');
		//Return (Promise to get) data
		return data;
	}

	/**
	 * Asynchronous "bulkWrite" function to a collection specified in first parameter.
	 * @param collection Collection to find in.
	 * @param operations Array of Bulk operations to perform.
	 * @param options Optional settings.
	 * @returns writeResult
	 */
	async bulkWrite(collection: string, operations: AnyBulkWriteOperation[], options?: BulkWriteOptions): Promise<BulkWriteResult>{
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
		let db = await this.getDB();
		let writeResult = await db.collection(collection).bulkWrite(operations, options);
		
		logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
		
		logger.removeContext('funcName');
		//return result
		return writeResult;
	}

	/**
	 * Asynchronous "remove" function to a collection specified in first parameter.
	 * @param collection Collection to remove from.
	 * @param query Filter for element/s to remove.
	 * @return {Promise<DeleteResult>} writeResult
	 */
	async remove(collection: string, query?: Filter<MongoDocument>): Promise<DeleteResult>{
		logger.addContext('funcName', 'remove');
		
		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if(typeof collection != 'string') throw new TypeError('utilities.remove: Collection must be specified.');
		//If query query are not set, create an empty object for the DB call.
		if(!query) query = {};
		//If query exists and is not an object, throw an error. 
		if(typeof query != 'object') throw new TypeError('utilities.remove: query must be of type object');
		query = this.castID(query);
		
		logger.trace(`${collection}, param: ${JSON.stringify(query)}`);
		
		//Remove in collection with query
		let db = await this.getDB();
		let writeResult = await db.collection(collection).deleteMany(query);
		
		logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
		
		logger.removeContext('funcName');
		//return writeResult
		return writeResult;
	}
	
	/**
	 * Asynchronous "insert" function to a collection specified in first parameter.
	 * @param collection Collection to insert into.
	 * @param {MongoDocument[] | MongoDocument} elements [Any] Element or array of elements to insert
	 * @returns {Promise<InsertManyResult | InsertOneResult | undefined>} writeResult
	 */
	async insert(collection: string, elements: MongoDocument[]): Promise<InsertManyResult | undefined>;
	async insert(collection: string, elements: MongoDocument): Promise<InsertOneResult>;

	async insert(collection: string, elements: MongoDocument[] | MongoDocument): Promise<InsertManyResult | InsertOneResult | undefined>{
		logger.addContext('funcName', 'insert');
		
		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if(typeof collection != 'string') throw new TypeError('Utilities.insert: Collection must be specified.');
		//If elements are not set, throw an error
		if(!elements) throw new TypeError('Utilities.insert: Must contain an element or array of elements to insert.');
		
		logger.trace(`${collection}, elements: ${JSON.stringify(elements)}`);
		
		//Insert in collection
		let writeResult;
		let db = await this.getDB();
		// if array, insertMany
		if (elements instanceof Array) {
			if (this.options.debug) logger.debug(`Array; doing insertMany, length=${elements.length}`);
			if (elements.length == 0) {
				logger.warn('Array is empty!! Doing nothing.');
			}
			else {
				writeResult = await db.collection(collection).insertMany(elements);
			}
		}
		// otherwise, insertOne
		else {
			if (this.options.debug) logger.debug('Object; doing insertOne');
			writeResult = await db.collection(collection).insertOne(elements);
		}
		this.flushCache();
		
		logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
		
		logger.removeContext('funcName');
		//return writeResult
		return writeResult;
	}

	/**
	 * Asynchronous request to TheBlueAlliance. Requires a URL ending to execute correctly.
	 * @param url ENDING of URL, after "https://.../api/v3/" DO NOT INCLUDE A / AT THE START
	 * @return JSON-formatted response from TBA
	 * @throws Network error 
	 */
	async requestTheBlueAlliance(url: string): Promise<any> {
		logger.addContext('funcName', 'requestTheBlueAlliance');
		
		//Setup our request URL, including specified URL ending parameter
		let requestURL = 'https://www.thebluealliance.com/api/v3/' + url + `?t=${Date.now()}`;
		
		logger.info(`Sending request to TheBlueAlliance at ${url}`);
		
		//Get TBA key
		let headers = await this.getTBAKey();
		
		//Create promise first
		let thisPromise = new Promise((resolve, reject) => {
			
			//Inside promise function, perform client request
			let request = this.client.get(requestURL, headers, function(tbaData: any){
				
				//If newline characters are not deleted, then CloudWatch logs get spammed
				let str = tbaData.toString().replace(/\n/g, '');
				
				logger.debug(`TBA response: ${str.substring(0, 200)}...`);
				logger.trace(`Full TBA response: ${str}`);
				
				logger.removeContext('funcName');
				
				if (tbaData.hasOwnProperty('Errors') || tbaData.hasOwnProperty('Error')) {
					// 2022-03-06 JL: If there are errors, don't resolve the data
					logger.error(`Error when requesting ${url}: ${JSON.stringify(tbaData)}`);
					reject(tbaData);
				}
				else {
					//Inside client callback, resolve promise
					resolve(tbaData);
				}
			});
			
			request.on('error', function (err: any) {
				reject(err);
			});
		});
		
		//Resolve promise
		return thisPromise;
	}
	
	/**
	 * Asynchronous request to FIRST's API. Requires a URL ending to execute correctly. 
	 * @param url ENDING of URL, after "https://.../v2.0/" DO NOT INCLUDE A / AT THE START
	 * @return JSON-formatted response from FIRST
	 */
	async requestFIRST(url: string): Promise<any> {
		
		let requestURL = 'https://frc-api.firstinspires.org/v2.0/' + url;
		logger.trace(`requestURL=${requestURL}`);
		
		let headers = await this.getFIRSTKey();
		
		let thisPromise = new Promise((resolve, reject) => {
						
			let request = this.client.get(requestURL, headers, function (firstData: any, response: any) {
				
				if (response.statusCode === 200) {
					
					let str = JSON.stringify(firstData);
					logger.debug(`FIRST response: ${str.substring(0, 200)}...`);
					
					resolve(firstData);
				}
				else {
					logger.error(`Error when requesting ${url}: Status=${response.statusCode}, ${response.statusMessage}`);
					reject(firstData);
				}
			});
			
			request.on('error', function (err: any) {
				reject(err);
			});
		});
		
		return thisPromise;
	}

	/**
	 * Asynchronous function to get our TheBlueAlliance API key from the DB.
	 * @return - TBA header arguments
	 */
	async getTBAKey(): Promise<TBAKey>{
		logger.addContext('funcName', 'getTBAKey');
		
		let tbaArgs: TBAKey = await this.findOne('passwords', {name: 'tba-api-headers'}, {}, {allowCache: true});
		
		if(tbaArgs){
			let headers = tbaArgs.headers;
			let key = {'headers': headers};
			
			logger.removeContext('funcName');
			return key;
		}
		else{
			//**********CONSIDER ANOTHER OPTION FOR HANDLING "CAN'T FIND REQUEST ARGS"
			logger.fatal('utilities.getTBAKey: Could not find tba-api-headers in database');
			
			logger.removeContext('funcName');
			throw 'Could not find api-headers in database';
		}
	}
	
	/**
	 * Asynchronous function to get our FIRST API key from the DB.
	 * https://frc-api-docs.firstinspires.org/#authorization
	 * @returns {FIRSTKey} - FIRST header arguments
	 */
	async getFIRSTKey(): Promise<FIRSTKey> {
		logger.addContext('funcName', 'getFIRSTKey');
		
		
		let firstKey: FIRSTKey = await this.findOne('passwords', {name: 'first-api-headers'}, {}, {allowCache: true});
		
		if (firstKey) {
			let headers = firstKey.headers;
			let key = {'headers': headers};
			
			logger.removeContext('funcName');
			return key;
		}
		else {
			logger.fatal('Could not find first-api-headers in database');
			
			logger.removeContext('funcName');
			throw new Error('Could not find first-api-headers in database');
		}
	}

	//Performance debugging if enabled
	consoleTime(name: string) {
		if (this.options.debug == true) this.debugTimes[name] = Date.now();
	}
	
	consoleTimeEnd(name: string) {
		if (this.options.debug == true && this.debugTimes[name]) {
			logger.debug(`${name}\t\t: ${Date.now() - this.debugTimes[name]} ms`);
			delete this.debugTimes[name];
		}
	}
	
	
	// cached DB reference	
	dbRefs: { [tier: string]: Db } = {};
	urls: { [tier: string]: string } = {};
	clients: { [tier: string]: MongoClient } = {};
	lastRequestTime: { [tier: string]: number } = {};
	refMaxAge = 60000;
	debugTimes: { [name: string]: number } = {};
	isDBlocked = false;
	dbLockPromiseResolves: Array<() => void> = [];

	private enterDbLock() {
		logger.trace('Entering DB lock');
		this.isDBlocked = true;
	}

	private leaveDbLock() {
		logger.trace('Leaving DB lock');
		this.isDBlocked = false;
		logger.trace(`Resolving ${this.dbLockPromiseResolves.length} lock promises`);
		for (let i in this.dbLockPromiseResolves) {
			let resolve = this.dbLockPromiseResolves[i];
			resolve();
		}
		// Clear the promise resolves list
		this.dbLockPromiseResolves = [];
		logger.trace('Done resolving db locks');
	}

	private dbLock() {
		return new Promise<void>((resolve) => {
			if (!this.isDBlocked) {
				logger.trace('DB not locked; Resolving instantly');
				resolve();
			}
			else {
				logger.trace('Awaiting DB lock...');
				this.dbLockPromiseResolves.push(resolve);
			}
		});
	}

	private open(url: string): Promise<[MongoClient, Db]> {
		return new Promise((resolve, reject) => {
			MongoClient.connect(url, (err, client) => {
				if (err || !client) return reject(err);
				let db = client.db();
				resolve([client, db]);
			});
		});
	}

	/**
	 * Fix filter queries by replacing String IDs with the proper ObjectID
	 * @param query Query with or without _id
	 * @returns Query with _id replaced with an ObjectId
	 */
	private castID(query: Filter<MongoDocument>) {
		if (typeof query !== 'object') return query;
		
		if (typeof query._id === 'string') {
			query._id = new ObjectId(query._id);
		}
		return query;
	}

}

declare interface TBAKey extends MongoDocument {
	headers: {
		accept: string; 
		'X-TBA-Auth-Key': string;
	};
}

declare interface FIRSTKey extends MongoDocument {
	headers: {
		Authorization: string;
		'If-Modified-Since': string;
	}
}

/**
 * Caching options.
 * @param {boolean} [allowCache=false]
 * @param {number} [maxCacheAge=30]
 */
export declare class UtilitiesCacheOptions {
	/**
	 * Whether this request can be cached. If true, then identical requests will be returned from the cache.
	 * @default false
	 */
	allowCache?: boolean;
	/**
	 * Max age for this cached request, in seconds.
	 * @default 30
	 */
	maxCacheAge?: number;
}


/**
 * Config JSON for utilities.js. Provide a connection URL for each possible value of process.env.TIER.
 */
export interface UtilitiesConfig {
	[tier: string]: {
		url: string;
	}
}

// For types
export { Document as MongoDocument } from 'mongodb';

// Note: module.exports provides the CommonJS export, which in Utilities' case is a singleton class.
// Other "export" statements export types for utilities.d.ts.

module.exports = Utilities.instance;
export default Utilities.instance;