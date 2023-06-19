import lucia, { LuciaError, type Adapter, type SessionSchema, type UserSchema, type KeySchema, type AdapterFunction } from "lucia-auth";
import { sveltekit } from "lucia-auth/middleware";
import { dev } from "$app/environment";
import utilities, { type str } from "./utilities";
import type { LuciaSession as LuciaSessionDb, User, LuciaUserKey } from 'scoutradioz-types'
import { ObjectId } from "mongodb";
import { getLogger } from "log4js";

const logger = getLogger('lucia');

const customAdapter = (): AdapterFunction<Adapter> => {
	return (luciaError) => {
		console.log('Custom adapter func')
		
		async function _getSession(sessionID: string) {
			const session = await utilities.findOne('sveltesessions', {
				_id: sessionID
			}, {}, {
				castID: false,
			});
			// if (!session) throw new luciaError('AUTH_INVALID_SESSION_ID', 'Could not find session in database');
			// console.log('_session', session);
			if (!session) return null;
			return transformSessionToLucia(session);
		}
		
		function transformSessionToLucia(session: LuciaSessionDb) {
			const luciaSession: SessionSchema = {
				id: String(session._id),
				active_expires: session.active_expires,
				idle_expires: session.idle_expires,
				user_id: String(session.user_id),
			}
			return luciaSession;
		}
		
		async function _getUser(userID: ObjectId|string) {
			const user = await utilities.findOne('users', {
				_id: userID
			});
			// if (!user) throw new luciaError('AUTH_INVALID_USER_ID', 'Could not find user in database');
			if (!user) return null;
			return transformUserToLucia(user);
		}
		
		function transformUserToLucia(user: User) {
			// logger.info('transformUserToLucia', user)
			
			const userId = String(user._id);
			delete user._id;
			
			const luciaUser: UserSchema = {
				id: userId,
				...user
			}
			return luciaUser;
		}
		
		function transformKeyToLucia(key: LuciaUserKey) {
			// logger.info('transformKeyToLucia', key)
			
			const dbKey: KeySchema = {
				id: key.id,
				hashed_password: key.hashed_password,
				primary_key: key.primary_key,
				expires: key.expires,
				user_id: String(key.user_id),
			}
			return dbKey;
		}
		
		const adapter: Adapter = {
			getUser: async (userId) => {
				// logger.info('getUser', userId);
				
				return _getUser(userId);
			},
			getSessionAndUserBySessionId: async (sessionId) => {
				// logger.info('getSessionAndUserBySessionId', sessionId);
				
				const session = await _getSession(sessionId);
				if (!session) return null;
				const user = await _getUser(session.user_id);
				if (!user) return null;
				
				return {
					session,
					user
				};
			},
			getSession: async (sessionId) => {
				// logger.info('getSession', sessionId);
				
				return await _getSession(sessionId);
			},
			getSessionsByUserId: async (userId) => {
				// logger.info('getSessionsByUserId', userId);
				
				const sessions = await utilities.find('sveltesessions', {
					user_id: new ObjectId(userId)
				});
				logger.debug(`Got ${sessions.length} sessions`);
				return sessions.map(transformSessionToLucia);
			},
			setUser: async (userId, userAttributes, key) => {
				// logger.info('setUser', userId, userAttributes, key);
				
				if (key) {
					const existingKey = await utilities.find('svelteuserkeys', {
						id: key.id,
					});
					if (existingKey) throw new LuciaError('AUTH_DUPLICATE_KEY_ID');
				}
				const user = {
					_id: new ObjectId(userId),
					...userAttributes
				} as User;
				await utilities.insert('users', user);
				
				if (key) {
					
					const dbKey: LuciaUserKey = {
						id: key.id,
						hashed_password: key.hashed_password,
						primary_key: key.primary_key,
						expires: key.expires,
						user_id: new ObjectId(key.user_id),
					}
					
					await utilities.insert('svelteuserkeys', dbKey);
				}
				return transformUserToLucia(user);
			},
			deleteUser: async (userId) => {
				// logger.info('deleteUser', userId);
				
				await utilities.remove('users', {
					_id: new ObjectId(userId)
				});
			},
			setSession: async (session) => {
				// logger.info('setSession', session);
				
				const existingUser = await utilities.findOne('users', {
					_id: session.user_id
				});
				if (!existingUser) throw new luciaError('AUTH_INVALID_USER_ID');
				
				const dbSession: LuciaSessionDb = {
					_id: session.id,
					active_expires: Number(session.active_expires),
					idle_expires: Number(session.idle_expires),
					user_id: new ObjectId(session.user_id),
				}
				await utilities.insert('sveltesessions', dbSession);
			},
			deleteSession: async (sessionId) => {
				// logger.info('deleteSession', sessionId);
				
				await utilities.remove('sveltesessions', {
					_id: sessionId,
				}, {castID: false});
			},
			deleteSessionsByUserId: async (userId) => {
				// logger.info('deleteSessionsByUserId', userId);
				
				await utilities.remove('sveltesessions', {
					user_id: new ObjectId(userId)
				});
			},
			updateUserAttributes: async (userId, userAttributes) => {
				// logger.info('updateUserAttributes', userId, userAttributes);
				
				await utilities.update('users', {
					_id: new ObjectId(userId)
				}, {
					$set: userAttributes
				});
			},
			getKey: async (keyId) => {
				// logger.info('getKey', keyId);
				
				const key = await utilities.findOne('svelteuserkeys', {
					id: keyId
				});
				if (!key) return null;
				return {
					id: key.id,
					hashed_password: key.hashed_password,
					primary_key: key.primary_key,
					expires: key.expires,
					user_id: String(key.user_id),
				}
			},
			setKey: async (key) => {
				// logger.info('setKey', key);
				
				const existingKey = await utilities.findOne('svelteuserkeys', {
					id: key.id,
				});
				if (existingKey) throw new LuciaError('AUTH_DUPLICATE_KEY_ID');
				
				const dbKey: LuciaUserKey = {
					id: key.id,
					hashed_password: key.hashed_password,
					primary_key: key.primary_key,
					expires: key.expires,
					user_id: new ObjectId(key.user_id),
				}
				
				await utilities.insert('svelteuserkeys', dbKey);
			},
			getKeysByUserId: async (userId) => {
				// logger.info('getKeysByUserId', userId)
				
				const keys = await utilities.find('svelteuserkeys', {
					user_id: new ObjectId(userId)
				});
				return keys.map(transformKeyToLucia);
			},
			updateKeyPassword: async (keyId, hashedPassword) => {
				// logger.info('updateKeyPassword', keyId, hashedPassword);
				
				await utilities.update('svelteuserkeys', {
					id: keyId
				}, {
					$set: {
						hashed_password: hashedPassword
					}
				});
			},
			deleteKeysByUserId: async (userId) => {
				// logger.info('deleteKeysByUserId', userId);
				
				await utilities.remove('svelteuserkeys', {
					user_id: new ObjectId(userId)
				});
			},
			deleteNonPrimaryKey: async (userId) => {
				// logger.info('deleteNonPrimaryKey', userId);
				
				await utilities.remove('svelteuserkeys', {
					user_id: new ObjectId(userId),
					primary_key: false
				});
			}
		}
		return adapter;
	};
};

export const auth = lucia({
	adapter: customAdapter(),
	env: dev ? "DEV" : "PROD",
	middleware: sveltekit(),
	experimental: {
		debugMode: true,
	},
	/** Move `id` back to `_id` */
	transformDatabaseUser: (luciaUser): str<User> => {
		const userId = luciaUser.id; // JL note: Svelte can't serialize ObjectID so we have to keep it as a string
		const user = {
			_id: userId,
			...luciaUser
		} as str<User> & { id?: string };
		
		delete user.id;
		return user;
	}
});

export type Auth = typeof auth;