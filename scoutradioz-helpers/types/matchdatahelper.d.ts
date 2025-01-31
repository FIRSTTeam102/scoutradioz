import type { Utilities, MongoDocument } from 'scoutradioz-utilities';
import type { Match, TeamKey, AggRange, MatchFormData, PitScouting, formDataOutput, OrgKey, EventKey, Schema, SchemaItem, CheckBoxItem, CounterItem, DerivedItem, DerivedItemLegacy, SliderItem, HeaderItem, SubheaderItem, SpacerItem } from 'scoutradioz-types';
export declare class MatchDataHelper {
    /**
     * MDH must be provided an already-configured scoutradioz-utilities DB module in order to function.
     * @param {Utilities} utilitiesModule
     */
    static config(utilitiesModule: Utilities): void;
    /**
     * Returns whether a layout element type is quantifiable.
     * @param {string} type Type of layout element
     * @return {boolean} isQuantifiable
     */
    static isQuantifiableType(type: string): boolean;
    /**
     * Wrapper of {@link isQuantifiableType} for better TypeScript hinting
     * Reason: after calling isQuantifiable(), you can access item.id without being yelled at
     */
    static isQuantifiable(item: SchemaItem): item is CheckBoxItem | CounterItem | DerivedItem | DerivedItemLegacy | SliderItem;
    /**
     * Adjusts the data type of a given datum based on its layout type. Numerical elements are transformed into numbers, checkboxes are transformed into 0/1, and others are kept as strings.
     * Use to "sanitize" the input from HTML forms into the database.
     * @param {string|number} value The metric/datum to fix
     * @param {string} type The type of the element, e.g. checkbox/counter/slider.
     * @return {string|number}
     */
    static fixDatumType(value: formDataOutput, type: string): formDataOutput;
    /**
     * Returns whether a layout element type is a metric.
     * 2025-01-23 JL: Changed function param from type to schemaitem to make TS happy
     * @param item layout element
     */
    static isMetric(item: SchemaItem): item is Exclude<SchemaItem, HeaderItem | SubheaderItem | SpacerItem>;
    static calculateDerivedLegacy(thisItem: DerivedItemLegacy, matchData: MatchFormData): number | null;
    /**
     * Calculate derived metrics for a provided array of match data items.
     * @param {string} org_key Org key
     * @param {number} event_year Year of event
     * @param {Object} matchData Scouting data ("data" field in the db)
     * @returns {Object} matchData - Same object, not cloned, with the derived metrics added
     */
    static calculateDerivedMetrics(org_key: string, event_year: number, matchData: MatchFormData): Promise<{
        matchData: MatchFormData;
        db: number;
        constructor: number;
        derived: number;
        ttokenize: number;
        tparse: number;
        tresolve: number;
    }>;
    /**
     * @param {string} org_key Org key
     * @param {number} event_year Year of event
     * @param {string} colCookie Comma-separated list of metric IDs
     * @return {array} Modified (reduce) match scouting layout, from the list in colCookie
     */
    static getModifiedMatchScoutingLayout(org_key: string, event_year: number, colCookie: string): Promise<MongoDocument[]>;
    /**
     * Recalculates aggregated data ranges for org & event and stores in DB
     * @param {string} org_key Org key
     * @param {number} event_year Year of event
     * @param {string} event_key Event key
     */
    static calculateAndStoreAggRanges(org_key: string, event_year: number, event_key: string): Promise<void>;
    /**
     * Gets upcoming match data for a specified event (and team).
     * @param {string} event_key Event key.
     * @param {string} [team_key] Team key (can be 'all' or null)
     * @returns {MatchData} Data blob containing matches, teamRanks, team, and teamList
     */
    static getUpcomingMatchData(event_key: string, team_key: string, org_key: string): Promise<UpcomingMatchData>;
    /**
     * Gets alliance stats
     * @param {number} event_year Event year
     * @param {string} event_key Event key
     * @param {string} org_key Org key
     * @param {string} teams_list Comma-separated list of teams, red alliance first, use ",0" between red list and blue list
     * @param {object} cookies req.cookies
     * @return {AllianceStatsData} Data blob containing teams, teamList, currentAggRanges, avgdata, maxdata
     */
    static getAllianceStatsData(event_year: number, event_key: string, org_key: string, teams_list: string, cookies: any): Promise<AllianceStatsData>;
    /**
     * Get the form layout / schema for a given event and org.
     * TODO: this function doesn't exactly belong in this function cuz it's not directly related to matchdata
     * @param org_key
     * @param event_key
     */
    static getSchemaForOrgAndEvent(org_key: OrgKey, event_key: EventKey, form_type: Schema['form_type']): Promise<Schema>;
}
export default MatchDataHelper;
export declare interface AllianceStatsData {
    /**
     * Return of getAllianceStatsData
     * @param {string} teams Comma-separated list
     * @param {array} teamList Split version of teams
     * @param {array} currentAggRanges currentAggRanges
     * @param {array} avgTable avgTable
     * @param {array} maxTable maxTable
     * @param {array} avgNorms
     * @param {array} maxNorms
     */
    teams: string;
    teamList: string[];
    currentAggRanges: AggRange[];
    avgTable: MetricRow[];
    maxTable: MetricRow[];
    avgNorms: MetricRow[];
    maxNorms: MetricRow[];
    pitData: PitScouting[];
}
export declare interface MetricRow {
    key: string;
    [team_key: TeamKey]: string;
}
export declare interface UpcomingMatchData {
    matches: UpcomingMatch[];
    teamRanks: {
        [team_key: string]: number;
    };
    team?: TeamKey;
    teamNumbers: number[];
    hasPredictive?: boolean;
}
/**
 * FRC Match with optional predictive stuff added
 */
export declare interface UpcomingMatch extends Match {
    hasPredictive?: boolean;
    predictive?: PredictiveBlock;
}
export declare interface PredictiveBlock {
    blueAVG?: number;
    blueSTD?: number;
    redAVG?: number;
    redSTD?: number;
    totalCNT?: number;
    chanceOfRed?: number;
}
