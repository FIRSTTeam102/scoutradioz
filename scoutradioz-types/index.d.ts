// 2024-03-18 JL: Split up this package into 2 files so we can use ts-interface-builder
// 	(ts-interface-builder does not support generics, so generics are put into index.d.ts)
import { AggRange, DbDocument, DbDocumentWithNumberId, DerivedLayout, Layout, LuciaSession, Match, MatchScouting, Org, OrgTeamValue, PitScouting, Ranking, RankingPoints, Role, ScoutingPair, Session, Team, Upload, User } from './types';
export { AggRange, DbDocument, DbDocumentWithNumberId, DerivedLayout, Layout, LuciaSession, Match, MatchScouting, Org, OrgTeamValue, PitScouting, Ranking, RankingPoints, Role, ScoutingPair, Session, Team, Upload, User };

/**
 * Optionally explicitly declare that a given object retrieved from the database has `_id` set.
 * @example
 * 
 * 	let users: WithDbId<User>[] = await utilities.find('users', {});
 */
export declare type WithDbId<T extends DbDocument|DbDocumentWithNumberId> = T & Required<Pick<T, '_id'>>

/**
 * Possible collection names in the SR database.
 */
export declare type CollectionName = 'aggranges'|'events'|'i18n'|'layout'|'matches'|'matchscouting'|'orgs'|'orgteamvalues'|'passwords'|'pitscouting'|'rankingpoints'|'rankings'|'roles'|'scoutingpairs'|'sessions'|'sveltesessions'|'teams'|'uploads'|'users';
/**
 * Gets the correct schema for the given collection name.
 */
export declare type CollectionSchema<colName extends CollectionName> =
	colName extends 'aggranges' ? AggRange :
	colName extends 'events' ? Event :
	// colName extends 'i18n' ?  :
	colName extends 'layout' ? (DerivedLayout|Layout) :
	colName extends 'matches' ? Match :
	colName extends 'matchscouting' ? MatchScouting :
	colName extends 'orgs' ? Org :
	colName extends 'orgteamvalues' ? OrgTeamValue :
	colName extends 'passwords' ? any : // JL: With the way we type-annotate stuff, it's easier to declare items in passwords as 'any' and then just type annotate it because we manually guarantee these guys
	colName extends 'pitscouting' ? PitScouting :
	colName extends 'rankingpoints' ? RankingPoints :
	colName extends 'rankings' ? Ranking :
	colName extends 'roles' ? Role :
	colName extends 'scoutingpairs' ? ScoutingPair :
	colName extends 'sessions' ? Session :
	colName extends 'sveltesessions' ? LuciaSession :
	colName extends 'teams' ? Team :
	colName extends 'uploads' ? Upload :
	colName extends 'users' ? User : 
	any;
/**
 * Gets the correct schema for the given collection name, with a guaranteed `_id` ObjectId.
 */
export declare type CollectionSchemaWithId<colName extends CollectionName> = WithDbId<CollectionSchema<colName>>;

declare let x: CollectionSchema<'layout'>;