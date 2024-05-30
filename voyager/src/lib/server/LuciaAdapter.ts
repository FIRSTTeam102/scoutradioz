import { dev } from '$app/environment';
import utilities from './utilities';
import type { LuciaSession, User, } from 'scoutradioz-types';
import { ObjectId } from 'mongodb';
import type { Adapter, DatabaseSession, RegisteredDatabaseSessionAttributes, DatabaseUser } from 'lucia';

export default class LuciaAdapter implements Adapter {
	/**
	 * Deletes all sessions where expires_at is equal to or less than current timestamp (machine time)
	 */
	async deleteExpiredSessions() {
		let currentTimestamp = new Date();

		let deleteResult = await utilities.bulkWrite('sveltesessions', [
			{
				deleteMany: {
					filter: {
						expiresAt: {
							$lte: currentTimestamp
						}
					}
				}
			}
		]);
		console.log('deleteExpiredSessions:', deleteResult);
	}
	/**
	 * Deletes the specified session
	 */
	async deleteSession(sessionId: string) {
		let deleteResult = await utilities.remove('sveltesessions', {
			_id: sessionId
		});
		console.log('deleteSession:', deleteResult);
	}
	/**
	 * Deletes all sessions linked to the user
	 */
	async deleteUserSessions(userId: string) {
		let objectId = Number(userId);
		let deleteResult = await utilities.bulkWrite('sveltesessions', [
			{
				deleteMany: {
					filter: {
						user_id: objectId
					}
				}
			}
		]);
		console.log('deleteUSerSessions', deleteResult);
	}

	transformSessionFromDb(dbSession: LuciaSession) {
		return {
			userId: String(dbSession.user_id),
			expiresAt: dbSession.expiresAt,
			id: String(dbSession._id),
			attributes: (dbSession.attributes as RegisteredDatabaseSessionAttributes)
		} as DatabaseSession;
	}
	
	transformSessionToDb(session: DatabaseSession) {
		const sessionDb = {
			_id: new ObjectId(session.id),
			expiresAt: session.expiresAt,
			attributes: session.attributes,
		} as LuciaSession;
		if (session.userId) sessionDb.user_id = Number(session.userId);
		return sessionDb;
	}

	transformUserFromDb(dbUser: User) {
		return {
			id: String(dbUser._id),
			attributes: dbUser,
		} as DatabaseUser;
	}

	/**
	 * Returns the session and user linked to the session
	 */
	async getSessionAndUser(sessionId: string): Promise<[session: DatabaseSession|null, user: DatabaseUser|null]> {
		const dbSession = await utilities.findOne('sveltesessions', {
			_id: sessionId
		});
		if (!dbSession) return [ null, null ];
		const session = this.transformSessionFromDb(dbSession);
		// oauth-token-only sessions don't have a user_id
		if (!dbSession.user_id) return [ session, null ];

		const dbUser = await utilities.findOne('users', {
			_id: dbSession.user_id,
		});
		if (!dbUser) return [ session, null ];

		const user = this.transformUserFromDb(dbUser);
		return [ session, user ];
	}
	/**
	 * Returns all sessions linked to a user
	 */
	async getUserSessions(userId: string) {
		const dbSessions = await utilities.find('sveltesessions', {
			user_id: new ObjectId(userId),
		});
		return dbSessions.map(dbSession => this.transformSessionFromDb(dbSession));
	}
	/**
	 * Inserts the session
	 */
	async setSession(session: DatabaseSession) {
		try {
			await utilities.insert('sveltesessions', this.transformSessionToDb(session));
		}
		catch (err) {
			console.error('Failed in setSession:', err);
			throw err;
		}
	}
	/**
	 * Updates expired_at of the specified session
	 */
	async updateSessionExpiration(sessionId: string, expiresAt: Date) {
		try {
			await utilities.update('sveltesessions', {_id: sessionId}, {$set: {expiresAt}});
		}
		catch (err) {
			console.error('Failed in updateSessionExpiration:', err);
		}
	}
}