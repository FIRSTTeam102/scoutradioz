'use strict';

import NodeCache from 'node-cache';
import type {
	Db, Document as MongoDocument,
	Filter, UpdateFilter, FindOptions, UpdateOptions, AnyBulkWriteOperation, BulkWriteOptions,
	InsertManyResult, InsertOneResult, BulkWriteResult, UpdateResult, DeleteResult, FilterOperators, RootFilterOperators, BSONType, BitwiseFilter, BSONRegExp, BSONTypeAlias
} from 'mongodb';
import { ObjectId, MongoClient, type MongoClientOptions } from 'mongodb';
import crypto from 'crypto';
import log4js from '@log4js-node/log4js-api';
import type { CollectionName, CollectionSchema, CollectionSchemaWithId } from 'scoutradioz-types';

const logger = log4js.getLogger('utilities');
logger.level = process.env.LOG_LEVEL || 'info';

/**
 * Valid primitives for use in mongodb queries
 */
export type ValidQueryPrimitive = string | number | undefined | null | boolean | ObjectId;
/**
 * Valid type for the `_id` field in a mongodb query
 */
export type ValidID = ObjectId | string | FilterOps<ObjectId>;

/**
 * `Omit<FilterOperators<T>, '_id'>` breaks code completion, so this is just copied from MongoDB's FilterOperators code
 */
export interface FilterOps<TValue> {
	$eq?: TValue;
	$gt?: TValue;
	$gte?: TValue;
	$in?: ReadonlyArray<TValue>;
	$lt?: TValue;
	$lte?: TValue;
	$ne?: TValue;
	$nin?: ReadonlyArray<TValue>;
	$not?: TValue extends string ? FilterOperators<TValue> | RegExp : FilterOperators<TValue>;
	/**
	 * When `true`, `$exists` matches the documents that contain the field,
	 * including documents where the field value is null.
	 */
	$exists?: boolean;
	$type?: BSONType | BSONTypeAlias;
	$expr?: Record<string, any>;
	$jsonSchema?: Record<string, any>;
	$mod?: TValue extends number ? [number, number] : never;
	$regex?: TValue extends string ? RegExp | BSONRegExp | string : never;
	$options?: TValue extends string ? string : never;
	$geoIntersects?: {
		$geometry: MongoDocument
	};
	$geoWithin?: MongoDocument
	$near?: MongoDocument
	$nearSphere?: MongoDocument
	$maxDistance?: number;
	$all?: ReadonlyArray<any>;
	$elemMatch?: MongoDocument
	$size?: TValue extends ReadonlyArray<any> ? number : never;
	$bitsAllClear?: BitwiseFilter;
	$bitsAllSet?: BitwiseFilter;
	$bitsAnyClear?: BitwiseFilter;
	$bitsAnySet?: BitwiseFilter;
	$rand?: Record<string, never>;
}

export interface QueryItem<T = any> extends Omit<FilterOps<T>, '_id'>, RootFilterOperators<T> {
	[key: string]: any;
}

export interface FindOptionsWithProjection extends FindOptions {
	projection: MongoDocument;
}

/**
 * Filter query for {@link Utilities.find} and {@link Utilities.findOne} operations
 */
export interface FilterQuery {
	_id?: ValidID;
	[key: string]: QueryItem | ValidQueryPrimitive;
}
/**
 * Filter query for {@link Utilities.find} and {@link Utilities.findOne} operations with a specified (generic) type
 */
export type FilterQueryTyped<T> = {
	_id?: ValidID;
	// Top level dollar operators
	$or?: FilterQueryTyped<T>[];
	$and?: FilterQueryTyped<T>[];
	$expr?: FilterQueryTyped<T>;
} & {
	[key in Exclude<keyof T, '_id'>]?: QueryItem<T[key]>|T[key];
} & {
	// JL: TypeScript lets us do limited string validation by using template literals. Can't yet use regexes,
	// 	but this serves our purpose. Essentially, any string with a . in it is allowed past the schema filter,
	// 	e.g. 'alliances.blue.team_keys': {$in: ['frc102']}
	[key: `${string}.${string}`]: QueryItem|ValidQueryPrimitive;
};

/**
 * Update filter for the specified schema, but which allows `'foo.bar'` notation
 */
export type UpdateFilterTyped<T> = UpdateFilter<
	T & {
		[key: `${string}.${string}`]: any;
	}
>

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
	 * Options for the MongoClient that we are wrapping.
	 */
	mongoClientOptions?: MongoClientOptions;
	/**
	 * 2022-06-12 JL: Whether to convert ObjectIDs into strings before returning DB results. Used in cases like Svelte, where ObjectIDs cannot be stringified properly.
	 */
	stringifyObjectIDs?: boolean;
	/**
	 * Whether to add extensive logger.trace statements
	 */
	debug: boolean;
	constructor(options?: any) {
		if (typeof options === 'object' && typeof options.debug === 'boolean') this.debug = options.debug;
		else this.debug = false;

		this.stringifyObjectIDs = options?.stringifyObjectIDs || false;
		this.mongoClientOptions = options?.mongoClientOptions || {};

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
	// Utilities is a singleton class. The refreshTier function is passed as a middleware, so the "this" argument gets messed up. 
	//  To avoid having to change code, we can instead use Utilities.instance.x
	static instance: Utilities = new Utilities();

	private _cacheFlushTimeout?: NodeJS.Timeout;

	constructor() {
		this.activeTier = null;
		this.dbConfig = null;
		this.ready = false;
		this.whenReadyQueue = [];
		this.cache = new NodeCache({ stdTTL: 30 });
		this.options = new UtilitiesOptions();
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
	config(databaseConfig: UtilitiesConfig, options: UtilitiesOptions): void {
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

				if (this.options.debug) logger.trace(`(getDB) Got url, url=${url}, tier=${tier} this.activeTier=${this.activeTier}`);

				this.open(url)
					.then(([client, db]) => {
						logger.info('(getDB) Connected!');

						// Resolve client & db, then unlock db
						this.clients[tier] = client;
						this.dbRefs[tier] = db;
						this.leaveDbLock();
					})
					.catch(err => {
						logger.error('(getDB)', JSON.stringify(err));
						reject(err);
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

						this.leaveDbLock();
						reject(err);
					});
			}
			else {

				await this.dbLock();

				// Reload the db ref in case it has been reconnected
				db = this.dbRefs[tier];

				//renew lastRequestTime
				this.lastRequestTime[tier] = Date.now();

				if (this.options.debug) logger.trace('(getDB) returning db');

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
		if (this.options.debug) logger.trace('Returning promise');

		return new Promise((resolve, reject) => {
			//only execute when utilities.js is ready
			this.whenReady(() => {
				logger.addContext('funcName', 'getDBurl(whenReady cb)');
				if (this.options.debug) logger.trace('BEGIN');
				//if no config is provided
				if (!this.dbConfig) {
					logger.warn('No database config provided; Defaulting to localhost:27017/app');
					return resolve('mongodb://127.0.0.1:27017/app');
				}
				//if no tier exists, something went wrong
				if (!this.activeTier) {
					logger.error('Something went wrong; activeTier is not defined');
					return reject(new Error('Something went wrong; activeTier is not defined'));
				}
				let thisDBinfo = this.dbConfig[this.activeTier];

				if (!thisDBinfo || !thisDBinfo.url) {
					logger.info(`No database URL specified for tier ${this.activeTier}. Checking if database URL exists for "default"...`);
					thisDBinfo = this.dbConfig['default'];
				}

				if (!thisDBinfo || !thisDBinfo.url) {
					logger.error('No database URL found.');
					return reject('No database URL found.');
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
		if (this.options.debug) logger.trace('ENTER');

		//if state is already ready, then execute immediately
		if (this.ready == true) {
			if (this.options.debug) logger.trace('ready=true; executing cb');
			cb();
		}
		//if not ready, then add request to queue
		else {
			if (this.options.debug) logger.trace('ready=false; adding cb to queue');
			this.whenReadyQueue.push(cb);
		}

		logger.removeContext('funcName');
	}

	/**
	 * Express middleware function to refresh the active tier of utilities.ts.
	 * @example 
	 * 	const app = express();
	 * 	app.use(utilities.refreshTier);
	 * @param manuallySpecifiedTier Svelte doesn't use process.env, so in this case, we manually specify the tier from the calling code
	 * @param unused
	 * @param nextFunction Express middleware next function
	 */
	refreshTier(...args: unknown[]) {

		let manuallySpecifiedTier = args[0];
		// Grab the tier -- either the first parameter or process.env.TIER
		if (typeof manuallySpecifiedTier === 'string') Utilities.instance.activeTier = manuallySpecifiedTier;
		else Utilities.instance.activeTier = process.env.TIER;
		//set ready to true
		Utilities.instance.ready = true;

		while (Utilities.instance.whenReadyQueue.length > 0) {
			let cb = Utilities.instance.whenReadyQueue.splice(0, 1)[0];
			cb();
		}

		let nextFunction = args[2]; // optional next() callback is the third parameter
		if (typeof nextFunction === 'function') nextFunction();
		else logger.warn('next() callback is not a function!');
	}

	/**
	 * Asynchronous "find" function to a collection specified in first parameter.
	 * @param collection Collection to find in.
	 * @param castQuery Filter for query.
	 * @param opts Query options, such as sort.
	 * @param cacheOption Caching options.
	 * @returns If the query options includes `projection`, then the type returned is `any`. Otherwise, the type annotation is automatically detected based on the specified collection.
	 */
	async find<colName extends CollectionName, Opts extends FindOptions = FindOptions>(
		collection: colName,
		query: FilterQueryTyped<CollectionSchema<colName>>,
		options?: Opts,
		cacheOptions?: UtilitiesCacheOptions
	): Promise<Opts extends FindOptionsWithProjection ? any : CollectionSchemaWithId<colName>[]> {
		logger.addContext('funcName', 'find');

		//Collection type filter
		if (typeof collection != 'string') throw new TypeError('Collection must be specified.');
		//Query type filter
		if (query && typeof query != 'object') throw new TypeError('query must be of type object');
		//Options type filter
		let opts = options || {};
		if (typeof opts != 'object') throw new TypeError('Options must be of type object');
		//Cache options
		if (!cacheOptions) cacheOptions = {};
		if (typeof cacheOptions != 'object') throw new TypeError('cacheOptions must be of type object');
		if (cacheOptions.allowCache != undefined && typeof cacheOptions.allowCache != 'boolean') throw new TypeError('cacheOptions.allowCache must be of type boolean');
		if (cacheOptions.maxCacheAge != undefined && typeof cacheOptions.maxCacheAge != 'number') throw new TypeError('cacheOptions.maxCacheAge must be of type number');
		if (!cacheOptions.allowCache) cacheOptions.allowCache = false;
		if (!cacheOptions.maxCacheAge) cacheOptions.maxCacheAge = this.options.cache.maxAge;
		let castQuery = this.castID(query);

		if (this.options.debug) logger.trace(`${collection}, ${JSON.stringify(castQuery)}, ${JSON.stringify(opts)}, maxCacheAge: ${cacheOptions.maxCacheAge}`);
		let timeLogName = `find: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable}`;
		this.consoleTime(timeLogName);

		let returnData: any[]; // JL note: Schema type is declared in types.d.ts and guaranteed by the database structure rather than TS

		//If cache is enabled
		if (cacheOptions.allowCache === true && this.options.cache.enable === true) {

			if (this.options.debug) logger.trace('Caching enabled');
			let hashedQuery = await this.hashQuery('find', collection, castQuery, opts);
			if (this.options.debug) logger.trace(`(find) Request Hash: ${hashedQuery}`);

			let cachedRequest: MongoDocument[] | undefined = this.cache.get(hashedQuery);

			//Look in cache for the query
			if (cachedRequest) {

				if (this.options.debug) logger.trace(`Serving request from cache (find:${collection})`);
				if (this.options.debug) logger.trace(`${hashedQuery}: ${JSON.stringify(cachedRequest).substring(0, 1000)}...`);
				this.consoleTimeEnd(timeLogName);

				returnData = cachedRequest;
			}
			//If query has not yet been cached
			else {
				if (this.options.debug) logger.trace(`Caching request (find:${collection})`);

				//Request db
				let db = await this.getDB();
				cachedRequest = await db.collection(collection).find(castQuery, opts).toArray();
				//Cache response (Including maxAge before automatic deletion)
				this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);

				if (this.options.debug) logger.trace(`${hashedQuery}: ${JSON.stringify(cachedRequest).substring(0, 1000)}...`);
				this.consoleTimeEnd(timeLogName);

				returnData = cachedRequest;
			}
		}
		//If cache is not enabled
		else {

			let db = await this.getDB();
			//Request db
			let data = await db.collection(collection).find(castQuery, opts).toArray();
			// if (this.options.debug) logger.trace(`non-cached: result: ${JSON.stringify(data)}`);
			this.consoleTimeEnd(timeLogName);

			returnData = data;
		}

		// 2022-06-12 JL: Optionally stringify IDs
		// 	Since some DB structures contain ObjectIDs (e.g. ScouterRecord), we can't just loop through
		// 	and do a shallow cast. JSON.stringify() automatically casts ObjectID to string & is fast enough.
		if (this.options.stringifyObjectIDs) returnData = JSON.parse(JSON.stringify(returnData));

		logger.removeContext('funcName');
		return returnData;
	}

	/**
	 * Asynchronous "findOne" function to a collection specified in first parameter.
	 * @param collection Collection to findOne in.
	 * @param query Filter for query.
	 * @param opts Query options, such as sort.
	 * @param cacheOptions Caching options.
	 * @returns If the query options includes `projection`, then the type returned is `any`. Otherwise, the type annotation is automatically detected based on the specified collection.
	 */
	async findOne<colName extends CollectionName, Opts extends FindOptions = FindOptions>(
		collection: colName,
		query: FilterQueryTyped<CollectionSchema<colName>>,
		options?: Opts,
		cacheOptions?: UtilitiesCacheOptions
	): Promise<CollectionSchemaWithId<colName>> {
		logger.addContext('funcName', 'findOne');

		//Collection type filter
		if (typeof collection != 'string') throw new TypeError('utilities.findOne: Collection must be specified.');
		//Query type filter
		if (!query) query = {};
		if (typeof query != 'object') throw new TypeError('utilities.findOne: query must be of type object');
		//Options type filter
		let opts = options || {};
		if (typeof opts != 'object') throw new TypeError('utilities.findOne: Options must be of type object');
		//Cache options
		if (!cacheOptions) cacheOptions = {};
		if (typeof cacheOptions != 'object') throw new TypeError('utilities.findOne: cacheOptions must be of type object');
		if (cacheOptions.allowCache != undefined && typeof cacheOptions.allowCache != 'boolean') throw new TypeError('cacheOptions.allowCache must be of type boolean');
		if (cacheOptions.maxCacheAge != undefined && typeof cacheOptions.maxCacheAge != 'number') throw new TypeError('cacheOptions.maxCacheAge must be of type number');
		if (!cacheOptions.allowCache) cacheOptions.allowCache = false;
		if (!cacheOptions.maxCacheAge) cacheOptions.maxCacheAge = this.options.cache.maxAge;
		query = this.castID(query);

		if (this.options.debug) logger.trace(`${collection}, ${JSON.stringify(query)}, ${JSON.stringify(opts)}`);
		let timeLogName = `findOne: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable}`;
		this.consoleTime(timeLogName);

		let returnData: any;

		//If cache is enabled
		if (cacheOptions.allowCache == true && this.options.cache.enable == true) {

			if (this.options.debug) logger.trace('Caching enabled');
			let hashedQuery = await this.hashQuery('findOne', collection, query, opts);
			if (this.options.debug) logger.trace(`(findOne) Request Hash: ${hashedQuery}`);

			let cachedRequest: MongoDocument | undefined | null = this.cache.get(hashedQuery);

			//Look in cache for the query
			if (cachedRequest) {

				if (this.options.debug) logger.trace(`Serving request from cache (findOne:${collection})`);
				if (this.options.debug) logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);

				returnData = cachedRequest;
			}
			//If query has not yet been cached
			else {
				if (this.options.debug) logger.trace(`Caching request (findOne:${collection})`);

				//Request db
				let db = await this.getDB();
				cachedRequest = await db.collection(collection).findOne(query, opts);
				//Cache response (Including maxAge before automatic deletion)
				this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);

				if (this.options.debug) logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);

				returnData = cachedRequest;
			}
		}
		//If cache is not enabled
		else {
			//Request db
			let db = await this.getDB();
			returnData = await db.collection(collection).findOne(query, opts);
			if (this.options.debug) logger.trace(`Not cached (findOne:${collection})`);
			this.consoleTimeEnd(timeLogName);
		}
		// 2022-06-12 JL: Optionally stringify IDs
		if (returnData && this.options.stringifyObjectIDs) returnData = JSON.parse(JSON.stringify(returnData));

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
	async update<colName extends CollectionName>(
		collection: colName,
		query: FilterQueryTyped<CollectionSchema<colName>>,
		update: UpdateFilterTyped<CollectionSchema<colName>>,
		options?: UpdateOptions
	): Promise<UpdateResult | MongoDocument>;
	// JL: Can't remove the separate declaration/implementation function headers cuz TS has this weird bug where it thinks UpdateFilter<MongoDocument> and UpdateFilter<CollectionSchema<colName>> are incompatible though they're the same
	async update(collection: string, query: FilterQuery, update: UpdateFilter<MongoDocument>, options?: UpdateOptions): Promise<UpdateResult | MongoDocument> {
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

		if (this.options.debug) logger.trace(`utilities.update: ${collection}, param: ${JSON.stringify(query)}, update: ${JSON.stringify(update)}, options: ${JSON.stringify(options)}`);
		let timeLogName = `update: ${collection}`;
		this.consoleTime(timeLogName);

		let queryHashFind = await this.hashQuery('find', collection, query, options);
		let queryHashFindOne = await this.hashQuery('findOne', collection, query, options);
		if (this.options.debug) logger.trace(`find hash: ${queryHashFind}, findOne hash: ${queryHashFindOne}`);

		//If cached responses for either hashed query exist, then delete them
		this.cache.del(queryHashFind);
		this.cache.del(queryHashFindOne);

		//Remove in collection with query
		let db = await this.getDB();
		let writeResult = await db.collection(collection).updateMany(query, update, options);

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
	async aggregate<colName extends CollectionName>(
		collection: colName,
		pipeline: MongoDocument[],
		cacheOptions?: UtilitiesCacheOptions
	): Promise<any[]> {
		logger.addContext('funcName', 'aggregate');

		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if (typeof (collection) != 'string') throw new TypeError('Utilities.aggregate: Collection must be specified.');
		//If query does not exist or is not an object, throw an error. 
		if (typeof (pipeline) != 'object') throw new TypeError('Utilities.aggregate: pipieline must be of type object');
		//Cache options
		if (!cacheOptions) cacheOptions = {};
		if (typeof cacheOptions != 'object') throw new TypeError('Utilities.aggregate: cacheOptions must be of type object');
		if (cacheOptions.allowCache != undefined && typeof cacheOptions.allowCache != 'boolean') throw new TypeError('cacheOptions.allowCache must be of type boolean');
		if (cacheOptions.maxCacheAge != undefined && typeof cacheOptions.maxCacheAge != 'number') throw new TypeError('cacheOptions.maxCacheAge must be of type number');
		if (!cacheOptions.allowCache) cacheOptions.allowCache = false;
		if (!cacheOptions.maxCacheAge) cacheOptions.maxCacheAge = this.options.cache.maxAge;

		let timeLogName = `agg: ${collection} cache=${cacheOptions.allowCache && this.options.cache.enable}`;
		this.consoleTime(timeLogName);
		if (this.options.debug) logger.trace(`${collection}, ${JSON.stringify(pipeline)}`);

		let returnData: MongoDocument[], data;
		//If cache is enabled
		if (cacheOptions.allowCache == true && this.options.cache.enable == true) {

			if (this.options.debug) logger.trace('Caching enabled');
			let hashedQuery = await this.hashQuery('aggregate', collection, pipeline, {});
			if (this.options.debug) logger.trace(`(aggregate) Request Hash: ${hashedQuery}`);

			let cachedRequest: MongoDocument[] | undefined = this.cache.get(hashedQuery);

			//Look in cache for the query
			if (cachedRequest) {

				if (this.options.debug) logger.trace(`Serving request from cache (aggregate:${collection})`);
				if (this.options.debug) logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);

				returnData = cachedRequest;
			}
			//If query has not yet been cached
			else {
				if (this.options.debug) logger.trace(`Caching request (aggregate:${collection})`);

				//Request db
				let db = await this.getDB();
				cachedRequest = await db.collection(collection).aggregate(pipeline).toArray();
				//Cache response (Including maxAge before automatic deletion)
				this.cache.set(hashedQuery, cachedRequest, cacheOptions.maxCacheAge);

				if (this.options.debug) logger.trace(JSON.stringify(cachedRequest).substring(0, 1000));
				this.consoleTimeEnd(timeLogName);

				returnData = cachedRequest;
			}
		}
		//If cache is not enabled
		else {

			//Aggregate
			let db = await this.getDB();
			data = await db.collection(collection).aggregate(pipeline).toArray();

			if (this.options.debug) logger.trace(`Not cached (aggregate:${collection})`);
			this.consoleTimeEnd(timeLogName);

			//Return (Promise to get) data
			returnData = data;
		}

		// 2022-12-06 JL: Optionally stringify IDs
		if (this.options.stringifyObjectIDs) returnData = JSON.parse(JSON.stringify(returnData));

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
	async distinct<colName extends CollectionName, Field extends (keyof CollectionSchema<colName> | `${string}.${string}`)>(
		collection: colName,
		field: Field,
		query: FilterQueryTyped<CollectionSchema<colName>>
	): Promise<CollectionSchemaWithId<colName>[Field][]> {
		logger.addContext('funcName', 'distinct');

		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if (typeof (collection) != 'string') throw new TypeError('Utilities.distinct: Collection must be specified.');
		if (typeof (field) != 'string') throw new TypeError('Utilities.distinct: Field string must be specified.');
		//If query filter are not set, create an empty object for the DB call.
		if (!query) query = {};
		//If query exists and is not an object, throw an error. 
		if (typeof (query) != 'object') throw new TypeError('Utilities.distinct: query must be of type object');
		query = this.castID(query);

		let timeLogName = `distinct: ${collection}`;
		this.consoleTime(timeLogName);

		if (this.options.debug) logger.trace(`${collection}, ${JSON.stringify(query)}`);

		//Find in collection with query and options
		let db = await this.getDB();
		let data = await db.collection(collection).distinct(field, query);

		// if (this.options.debug) logger.trace(`result: ${JSON.stringify(data)}`);
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
	async bulkWrite<colName extends CollectionName>(
		collection: colName,
		operations: AnyBulkWriteOperation<CollectionSchema<colName>>[],
		options?: BulkWriteOptions
	): Promise<BulkWriteResult>;
	async bulkWrite(collection: string, operations: AnyBulkWriteOperation[], options?: BulkWriteOptions): Promise<BulkWriteResult> {
		logger.addContext('funcName', 'bulkWrite');

		// JL TODO: Automatic _id casting for BulkWrite operations

		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if (typeof (collection) != 'string') {
			throw new TypeError('Utilities.bulkWrite: Collection must be specified.');
		}

		//If operations does not exist or is not an array, throw an error. 
		if (!Array.isArray(operations)) {
			throw new TypeError('Utilities.bulkWrite: Operations must be specified and is an array of operations');
		}

		//If query options are not set, create an empty object for the DB call.
		if (!options) options = {};
		//If options exists and is not an object, throw an error. 
		if (typeof (options) != 'object') {
			throw new TypeError('Utilities.bulkWrite: options must be of type object');
		}

		if (this.options.debug) logger.trace(`${collection}, operations: ${JSON.stringify(operations)}, param: ${JSON.stringify(options)}`);

		//Update in collection with options
		let db = await this.getDB();
		let writeResult = await db.collection(collection).bulkWrite(operations, options);

		if (this.options.debug) logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);

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
	async remove<colName extends CollectionName>(
		collection: colName,
		query?: FilterQueryTyped<CollectionSchema<colName>>
	): Promise<DeleteResult> {
		logger.addContext('funcName', 'remove');

		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if (typeof collection != 'string') throw new TypeError('utilities.remove: Collection must be specified.');
		//If query query are not set, create an empty object for the DB call.
		if (!query) query = {};
		//If query exists and is not an object, throw an error. 
		if (typeof query != 'object') throw new TypeError('utilities.remove: query must be of type object');
		query = this.castID(query);

		if (this.options.debug) logger.trace(`${collection}, param: ${JSON.stringify(query)}`);

		//Remove in collection with query
		let db = await this.getDB();
		let writeResult = await db.collection(collection).deleteMany(query);

		if (this.options.debug) logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);

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
	async insert<colName extends CollectionName>(
		collection: colName,
		elements: CollectionSchema<colName>[]
	): Promise<InsertManyResult | undefined>;
	async insert<colName extends CollectionName>(
		collection: colName,
		elements: CollectionSchema<colName>
	): Promise<InsertOneResult>;

	async insert(collection: string, elements: MongoDocument[] | MongoDocument): Promise<InsertManyResult | InsertOneResult | undefined> {
		logger.addContext('funcName', 'insert');

		//If the collection is not specified and is not a String, throw an error.
		//This would obly be caused by a programming error.
		if (typeof collection != 'string') throw new TypeError('Utilities.insert: Collection must be specified.');
		//If elements are not set, throw an error
		if (!elements) throw new TypeError('Utilities.insert: Must contain an element or array of elements to insert.');

		if (this.options.debug) logger.trace(`${collection}, elements: ${JSON.stringify(elements)}`);

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

		if (this.options.debug) logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);

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

		// Fetch from TBA (requires at least Node v18)
		let response = await fetch(requestURL, { headers });

		let json = await response.json();

		if (this.options.debug) logger.trace(`Full TBA response: ${JSON.stringify(json)}`);

		return json;
	}

	/**
	 * Asynchronous request to FIRST's API. Requires a URL ending to execute correctly. 
	 * @param url ENDING of URL, after "https://.../v2.0/" DO NOT INCLUDE A / AT THE START
	 * @return JSON-formatted response from FIRST
	 */
	async requestFIRST(url: string): Promise<any> {

		let requestURL = 'https://frc-api.firstinspires.org/v2.0/' + url;
		if (this.options.debug) logger.trace(`requestURL=${requestURL}`);

		let headers = await this.getFIRSTKey();

		// Fetch from FIRST (requires at least Node v18)
		let response = await fetch(requestURL, { headers });

		let json = await response.json();

		if (json && response.ok) {

			if (this.options.debug) logger.trace(`Full FIRST response: ${JSON.stringify(json)}`);

			return json;
		}
		else {
			logger.error(`Error when requesting ${url}: Status=${response.status}, ${response.statusText}`);
			throw response;
		}
	}

	/**
	 * Asynchronous function to get our TheBlueAlliance API key from the DB.
	 * @return - TBA header arguments
	 */
	async getTBAKey(): Promise<TBAKey['headers']> {
		logger.addContext('funcName', 'getTBAKey');

		let tbaArgs: TBAKey = await this.findOne('passwords', { name: 'tba-api-headers' }, {}, { allowCache: true });

		if (tbaArgs) {
			let headers = tbaArgs.headers;

			logger.removeContext('funcName');
			return headers;
		}
		else {
			//**********CONSIDER ANOTHER OPTION FOR HANDLING "CAN'T FIND REQUEST ARGS"
			logger.fatal('utilities.getTBAKey: Could not find tba-api-headers in database');

			logger.removeContext('funcName');
			throw new Error('Could not find api-headers in database');
		}
	}

	/**
	 * Asynchronous function to get our FIRST API key from the DB.
	 * https://frc-api-docs.firstinspires.org/#authorization
	 * @returns {FIRSTKey} - FIRST header arguments
	 */
	async getFIRSTKey(): Promise<FIRSTKey['headers']> {
		logger.addContext('funcName', 'getFIRSTKey');


		let firstKey: FIRSTKey = await this.findOne('passwords', { name: 'first-api-headers' }, {}, { allowCache: true });

		if (firstKey) {
			let headers = firstKey.headers;

			logger.removeContext('funcName');
			return headers;
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
		if (this.options.debug) logger.trace('Entering DB lock');
		this.isDBlocked = true;
	}

	private leaveDbLock() {
		if (this.options.debug) logger.trace('Leaving DB lock');
		this.isDBlocked = false;
		if (this.options.debug) logger.trace(`Resolving ${this.dbLockPromiseResolves.length} lock promises`);
		for (let i in this.dbLockPromiseResolves) {
			let resolve = this.dbLockPromiseResolves[i];
			resolve();
		}
		// Clear the promise resolves list
		this.dbLockPromiseResolves = [];
		if (this.options.debug) logger.trace('Done resolving db locks');
	}

	private dbLock() {
		return new Promise<void>((resolve) => {
			if (!this.isDBlocked) {
				if (this.options.debug) logger.trace('DB not locked; Resolving instantly');
				resolve();
			}
			else {
				if (this.options.debug) logger.trace('Awaiting DB lock...');
				this.dbLockPromiseResolves.push(resolve);
			}
		});
	}

	private async open(url: string): Promise<[MongoClient, Db]> {
		let options = this.options.mongoClientOptions || {};
		let client = await MongoClient.connect(url, options);
		let db = client.db();
		return [client, db];

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
