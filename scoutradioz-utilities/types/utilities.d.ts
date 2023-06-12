import NodeCache from 'node-cache';
import type { Db, Document as MongoDocument, Filter, UpdateFilter, FindOptions, UpdateOptions, AnyBulkWriteOperation, BulkWriteOptions, InsertManyResult, InsertOneResult, BulkWriteResult, UpdateResult, DeleteResult, FilterOperators, RootFilterOperators, BSONType, BitwiseFilter, BSONRegExp, BSONTypeAlias } from 'mongodb';
import { ObjectId, MongoClient, type MongoClientOptions } from 'mongodb';
import type { CollectionName, CollectionSchema, CollectionSchemaWithId } from 'scoutradioz-types';
/**
 * Valid primitives for use in mongodb queries
 */
type ValidQueryPrimitive = string | number | undefined | null | boolean | ObjectId;
/**
 * Valid type for the `_id` field in a mongodb query
 */
type ValidID = ObjectId | string | FilterOps<ObjectId>;
/**
 * `Omit<FilterOperators<T>, '_id'>` breaks code completion, so this is just copied from MongoDB's FilterOperators code
 */
interface FilterOps<TValue> {
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
        $geometry: MongoDocument;
    };
    $geoWithin?: MongoDocument;
    $near?: MongoDocument;
    $nearSphere?: MongoDocument;
    $maxDistance?: number;
    $all?: ReadonlyArray<any>;
    $elemMatch?: MongoDocument;
    $size?: TValue extends ReadonlyArray<any> ? number : never;
    $bitsAllClear?: BitwiseFilter;
    $bitsAllSet?: BitwiseFilter;
    $bitsAnyClear?: BitwiseFilter;
    $bitsAnySet?: BitwiseFilter;
    $rand?: Record<string, never>;
}
interface QueryItem<T = any> extends Omit<FilterOps<T>, '_id'>, RootFilterOperators<T> {
    [key: string]: any;
}
interface FindOptionsWithProjection extends FindOptions {
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
    $or?: FilterQueryTyped<T>[];
    $and?: FilterQueryTyped<T>[];
    $expr?: FilterQueryTyped<T>;
} & {
    [key in Exclude<keyof T, '_id'>]?: QueryItem<T[key]> | T[key];
} & {
    [key: `${string}.${string}`]: QueryItem | ValidQueryPrimitive;
};
/**
 * Update filter for the specified schema, but which allows `'foo.bar'` notation
 */
export type UpdateFilterTyped<T> = UpdateFilter<T & {
    [key: `${string}.${string}`]: any;
}>;
/**
 * Optional settings for configurating SR-Utilities.
 * @param cache
 * @param debug
 */
export declare class UtilitiesOptions {
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
     * @param str ID-like string
     * @returns MongoDB Object ID
     */
    id(str?: string): ObjectId;
    /**
     * Flush DB cache, but after a few milliseconds to avoid stalling requests.
     */
    flushCache(): void;
    /**
     * (Required) Configure utilities with database config file.
     * @param databaseConfig JSON object for database config (use require('databases.json') for security)
     * @param options Optional settings
     * @param options.cache Cache settings
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
     * @returns Database connection uri.
     */
    getDBurl(): Promise<string>;
    /**
     * Internal function to execute whenever ready
     * @param {function} cb Callback
     */
    whenReady(cb: () => void): void;
    /**
     * Express middleware function to refresh the active tier of utilities.ts.
     * @example
     * 	const app = express();
     * 	app.use(utilities.refreshTier);
     * @param manuallySpecifiedTier Svelte doesn't use process.env, so in this case, we manually specify the tier from the calling code
     * @param unused
     * @param nextFunction Express middleware next function
     */
    refreshTier(...args: unknown[]): void;
    /**
     * Asynchronous "find" function to a collection specified in first parameter.
     * @param collection Collection to find in.
     * @param castQuery Filter for query.
     * @param opts Query options, such as sort.
     * @param cacheOption Caching options.
     * @returns If the query options includes `projection`, then the type returned is `any`. Otherwise, the type annotation is automatically detected based on the specified collection.
     */
    find<colName extends CollectionName, Opts extends FindOptions = FindOptions>(collection: colName, query: FilterQueryTyped<CollectionSchema<colName>>, options?: Opts, extraOptions?: UtilitiesExtraOptions): Promise<Opts extends FindOptionsWithProjection ? any : CollectionSchemaWithId<colName>[]>;
    /**
     * Asynchronous "findOne" function to a collection specified in first parameter.
     * @param collection Collection to findOne in.
     * @param query Filter for query.
     * @param opts Query options, such as sort.
     * @param extraOptions Caching options.
     * @returns If the query options includes `projection`, then the type returned is `any`. Otherwise, the type annotation is automatically detected based on the specified collection.
     */
    findOne<colName extends CollectionName, Opts extends FindOptions = FindOptions>(collection: colName, query: FilterQueryTyped<CollectionSchema<colName>>, options?: Opts, extraOptions?: UtilitiesExtraOptions): Promise<CollectionSchemaWithId<colName>>;
    /**
     * Asynchronous "update" function to a collection specified in first parameter.
     * @param collection Collection to find in.
     * @param query Filter query.
     * @param update Update query.
     * @param options Query options, such as sort.
     * @returns {WriteResult} writeResult
     */
    update<colName extends CollectionName>(collection: colName, query: FilterQueryTyped<CollectionSchema<colName>>, update: UpdateFilterTyped<CollectionSchema<colName>>, options?: UpdateOptions, extraOptions?: UtilitiesExtraOptions): Promise<UpdateResult | MongoDocument>;
    /**
     * Asynchronous "aggregate" function to a collection specified in first parameter.
     * @param collection Collection to find in.
     * @param pipeline Array containing all the aggregation framework commands for the execution.
     * @param extraOptions Caching options.
     * @returns Aggregated data.
     */
    aggregate<colName extends CollectionName>(collection: colName, pipeline: MongoDocument[], extraOptions?: UtilitiesExtraOptions): Promise<any[]>;
    dumpCache(): void;
    /**
     * @param type Type of function
     * @param collection Collection
     * @param param1 First param (oft. query)
     * @param param2 Second param (oft. options)
     */
    hashQuery(type: string, collection: string, param1: Filter<MongoDocument>, param2: UpdateOptions): Promise<string>;
    /**
     * Asynchronous "distinct" function to a collection specified in first parameter.
     * @param collection Collection to find in.
     * @param field Which field to distinct.
     * @param query The query for filtering the set of documents to which we apply the distinct filter.
     * @returns Distinct values for the specified field
     */
    distinct<colName extends CollectionName, Field extends (keyof CollectionSchema<colName> | `${string}.${string}`)>(collection: colName, field: Field, query: FilterQueryTyped<CollectionSchema<colName>>, extraOptions?: UtilitiesExtraOptions): Promise<CollectionSchemaWithId<colName>[Field][]>;
    /**
     * Asynchronous "bulkWrite" function to a collection specified in first parameter.
     * @param collection Collection to find in.
     * @param operations Array of Bulk operations to perform.
     * @param options Optional settings.
     * @returns writeResult
     */
    bulkWrite<colName extends CollectionName>(collection: colName, operations: AnyBulkWriteOperation<CollectionSchema<colName>>[], options?: BulkWriteOptions): Promise<BulkWriteResult>;
    /**
     * Asynchronous "remove" function to a collection specified in first parameter.
     * @param collection Collection to remove from.
     * @param query Filter for element/s to remove.
     * @return {Promise<DeleteResult>} writeResult
     */
    remove<colName extends CollectionName>(collection: colName, query?: FilterQueryTyped<CollectionSchema<colName>>, extraOptions?: UtilitiesExtraOptions): Promise<DeleteResult>;
    /**
     * Asynchronous "insert" function to a collection specified in first parameter.
     * @param collection Collection to insert into.
     * @param {MongoDocument[] | MongoDocument} elements [Any] Element or array of elements to insert
     * @returns {Promise<InsertManyResult | InsertOneResult | undefined>} writeResult
     */
    insert<colName extends CollectionName>(collection: colName, elements: CollectionSchema<colName>[]): Promise<InsertManyResult | undefined>;
    insert<colName extends CollectionName>(collection: colName, elements: CollectionSchema<colName>): Promise<InsertOneResult>;
    /**
     * Asynchronous request to TheBlueAlliance. Requires a URL ending to execute correctly.
     * @param url ENDING of URL, after "https://.../api/v3/" DO NOT INCLUDE A / AT THE START
     * @return JSON-formatted response from TBA
     * @throws Network error
     */
    requestTheBlueAlliance(url: string): Promise<any>;
    /**
     * Asynchronous request to FIRST's API. Requires a URL ending to execute correctly.
     * @param url ENDING of URL, after "https://.../v2.0/" DO NOT INCLUDE A / AT THE START
     * @return JSON-formatted response from FIRST
     */
    requestFIRST(url: string): Promise<any>;
    /**
     * Asynchronous function to get our TheBlueAlliance API key from the DB.
     * @return - TBA header arguments
     */
    getTBAKey(): Promise<TBAKey['headers']>;
    /**
     * Asynchronous function to get our FIRST API key from the DB.
     * https://frc-api-docs.firstinspires.org/#authorization
     * @returns {FIRSTKey} - FIRST header arguments
     */
    getFIRSTKey(): Promise<FIRSTKey['headers']>;
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
     * @param query Query with or without _id
     * @returns Query with _id replaced with an ObjectId
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
/**
 * Caching options.
 * @param {boolean} [allowCache=false]
 * @param {number} [maxCacheAge=30]
 */
export declare class UtilitiesExtraOptions {
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
    /**
     * Whether to cast _id fields automatically to ObjectID.
     * @default true
     */
    castID?: boolean;
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
declare const _default: Utilities;
export default _default;
