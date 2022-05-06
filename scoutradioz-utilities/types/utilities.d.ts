import NodeCache from 'node-cache';
import { ObjectId, MongoClient, Db, Document as MongoDocument, Filter, UpdateFilter, FindOptions, UpdateOptions, AnyBulkWriteOperation, BulkWriteOptions, InsertManyResult, InsertOneResult, BulkWriteResult, UpdateResult, DeleteResult } from 'mongodb';
import { Request, Response, NextFunction } from 'express';
export declare class UtilitiesOptions {
    cache: {
        enable: boolean;
        maxAge: number;
    };
    debug: boolean;
    constructor(options?: any);
}
export declare class Utilities {
    activeTier: any;
    dbConfig: any;
    ready: boolean;
    whenReadyQueue: any[];
    cache: NodeCache;
    options: UtilitiesOptions;
    static instance: Utilities;
    private _cacheFlushTimeout?;
    constructor();
    /**
     * Create a MongoDB ObjectID, either from a string or a random new one
     * @param {string} [str] ID-like string
     * @returns {ObjectId} MongoDB Object ID
     */
    id(str?: string): ObjectId;
    /**
     * Flush DB cache, but after a few milliseconds to avoid stalling requests.
     */
    flushCache(): void;
    /**
     * (Required) Configure utilities with database config file.
     * @param {object} databaseConfig JSON object for database config (use require('databases.json') for security)
     * @param {object} [options] Optional settings
     * @param {object} [options.cache] Cache settings
     * @param {boolean} [options.cache.enable=false] Whether to enable or disable caching in find requests
     * @param {number} [options.cache.maxAge=30] Default maximum age of cached requests, in seconds
     * @param {debug} [options.debug=false] Whether to enable extra debug logging (Performance, timing, etc.)
     */
    config(databaseConfig: UtilitiesConfig, options: UtilitiesOptions): void;
    /**
     * Function that first caches, then returns the cached database for the server process.
     * @returns {Promise<Db>} Database ref
     */
    getDB(): Promise<Db>;
    /**
     * Function that retrieves the database connection string from databases, and returns that connection string URL.
     * If databases does not exist, it defaults to localhost.
     * @returns {string} Database connection uri.
     */
    getDBurl(): Promise<string>;
    /**
     * Internal function to execute whenever ready
     * @param {function} cb Callback
     */
    whenReady(cb: () => void): void;
    /**
     * Express middleware function to refresh the active tier of utilities.js.
     * Usage:
     * 	const app = express();
     * 	app.use(utilities.refreshTier);
     */
    refreshTier(req: Request, res: Response, next: NextFunction): void;
    /**
     * Asynchronous "find" function to a collection specified in first parameter.
     * @param {string} collection Collection to find in.
     * @param {object} [query={}] Filter for query.
     * @param {object} [options={}] Query options, such as sort.
     * @param {object} [cacheOptions=undefined] Caching options.
     * @param {boolean} [cacheOptions.allowCache=false] Whether this request can be cached. If true, then identical requests will be returned from the cache.
     * @param {number} [cacheOptions.maxCacheAge=30] Max age for this cached request.
     */
    find(collection: string, query: Filter<MongoDocument>, options?: FindOptions, cacheOptions?: UtilitiesCacheOptions): Promise<any>;
    /**
     * Asynchronous "findOne" function to a collection specified in first parameter.
     * @param {string} collection Collection to findOne in.
     * @param {object} [query={}] Filter for query.
     * @param {object} [options={}] Query options, such as sort.
     * @param {object} [cacheOptions=undefined] Caching options.
     * @param {boolean} [cacheOptions.allowCache=false] Whether this request can be cached. If true, then identical requests will be returned from the cache.
     * @param {number} [cacheOptions.maxCacheAge=30] Max age for this cached request.
     */
    findOne(collection: string, query: Filter<MongoDocument>, options?: FindOptions, cacheOptions?: UtilitiesCacheOptions): Promise<any>;
    /**
     * Asynchronous "update" function to a collection specified in first parameter.
     * @param {string} collection Collection to find in.
     * @param {object} query Filter query.
     * @param {object} update Update query.
     * @param {object} options Query options, such as sort.
     * @returns {WriteResult} writeResult
     */
    update(collection: string, query: Filter<MongoDocument>, update: UpdateFilter<MongoDocument>, options?: UpdateOptions): Promise<UpdateResult | MongoDocument>;
    /**
     * Asynchronous "aggregate" function to a collection specified in first parameter.
     * @param {string} collection Collection to find in.
     * @param {object} pipeline Array containing all the aggregation framework commands for the execution.
     * @param {object} [cacheOptions=undefined] Caching options.
     * @param {boolean} [cacheOptions.allowCache=false] Whether this request can be cached. If true, then identical requests will be returned from the cache.
     * @param {number} [cacheOptions.maxCacheAge=30] Max age for this cached request.
     * @returns {object} Aggregated data.
     */
    aggregate(collection: string, pipeline: MongoDocument[], cacheOptions?: UtilitiesCacheOptions): Promise<any>;
    dumpCache(): void;
    /**
     * @param {string} type Type of function
     * @param {string} collection Collection
     * @param {object} param1 First param (oft. query)
     * @param {object} param2 Second param (oft. options)
     */
    hashQuery(type: string, collection: string, param1: Filter<MongoDocument>, param2: UpdateOptions): Promise<string>;
    /**
     * Asynchronous "distinct" function to a collection specified in first parameter.
     * @param {string} collection Collection to find in.
     * @param {string} field Which field to distinct.
     * @param {object} query The query for filtering the set of documents to which we apply the distinct filter.
     * @returns {array} Distinct values for the specified field
     */
    distinct(collection: string, field: string, query: Filter<MongoDocument>): Promise<any[]>;
    /**
     * Asynchronous "bulkWrite" function to a collection specified in first parameter.
     * @param {string} collection Collection to find in.
     * @param {array} operations Array of Bulk operations to perform.
     * @param {object} options Optional settings.
     * @returns {WriteResult} writeResult
     */
    bulkWrite(collection: string, operations: AnyBulkWriteOperation, options?: BulkWriteOptions): Promise<BulkWriteResult>;
    /**
     * Asynchronous "remove" function to a collection specified in first parameter.
     * @param {string} collection Collection to remove from.
     * @param {object} query Filter for element/s to remove.
     * @return {WriteResult} writeResult
     */
    remove(collection: string, query: Filter<MongoDocument>): Promise<DeleteResult>;
    /**
     * Asynchronous "insert" function to a collection specified in first parameter.
     * @param {string} collection Collection to insert into.
     * @param {object} elements [Any] Element or array of elements to insert
     * @returns {WriteResult} writeResult
     */
    insert(collection: string, elements: MongoDocument[]): Promise<InsertManyResult | InsertOneResult | undefined>;
    /**
     * Asynchronous request to TheBlueAlliance. Requires a URL ending to execute correctly.
     * @param {string} url ENDING of URL, after "https://.../api/v3/" DO NOT INCLUDE A / AT THE START
     * @return {object} JSON-formatted response from TBA
     */
    requestTheBlueAlliance(url: string): Promise<unknown>;
    /**
     * Asynchronous request to FIRST's API. Requires a URL ending to execute correctly.
     * @param {string} url ENDING of URL, after "https://.../v2.0/" DO NOT INCLUDE A / AT THE START
     * @return {object} JSON-formatted response from FIRST
     */
    requestFIRST(url: string): Promise<unknown>;
    /**
     * Asynchronous function to get our TheBlueAlliance API key from the DB.
     * @return {object} - TBA header arguments
     */
    getTBAKey(): Promise<TBAKey>;
    /**
     * Asynchronous function to get our FIRST API key from the DB.
     * https://frc-api-docs.firstinspires.org/#authorization
     * @returns {FIRSTKey} - FIRST header arguments
     */
    getFIRSTKey(): Promise<FIRSTKey>;
    consoleTime(name: string): void;
    consoleTimeEnd(name: string): void;
    dbRefs: {
        [tier: string]: Db;
    };
    urls: {
        [tier: string]: string;
    };
    clients: {
        [tier: string]: MongoClient;
    };
    lastRequestTime: {
        [tier: string]: number;
    };
    refMaxAge: number;
    debugTimes: {
        [name: string]: number;
    };
    isDBlocked: boolean;
    dbLockPromiseResolves: Array<() => void>;
    private enterDbLock;
    private leaveDbLock;
    private dbLock;
    private open;
    /**
     * Fix filter queries by replacing String IDs with the proper ObjectID
     * @param {object} query Query with or without _id
     * @returns {object} Query with _id replaced with an ObjectId
     */
    private castID;
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
    };
}
export declare class UtilitiesCacheOptions {
    allowCache?: boolean;
    maxCacheAge?: number;
}
/**
 * Config JSON for utilities.js. Provide a connection URL for each possible value of process.env.TIER.
 */
export interface UtilitiesConfig {
    [tier: string]: {
        url: string;
    };
}
export { Document as MongoDocument } from 'mongodb';
