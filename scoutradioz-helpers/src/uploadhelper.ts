'use strict';
import log4js from '@log4js-node/log4js-api';
import type { Utilities } from '@firstteam102/scoutradioz-utilities';
import type { Upload, TeamKey, OrgKey } from '@firstteam102/scoutradioz-types';
import { Team } from '@firstteam102/scoutradioz-types';

const logger = log4js.getLogger('helpers.matchData');
logger.level = process.env.LOG_LEVEL || 'debug';

let utilities: Utilities;

export class UploadHelper {
	
	/**
	 * MDH must be provided an already-configured scoutradioz-utilities DB module in order to function.
	 * @param {Utilities} utilitiesModule 
	 */
	static config(utilitiesModule: Utilities) {
		utilities = utilitiesModule;
	}
	

	/**
	 * Find upload links for a given team.
	 * @param {string} orgKey org_key
	 * @param {number} year year
	 * @param {string} teamKey team_key
	 * @returns {ImageLinks} Links to images
	 */
	static async findTeamImages (orgKey: OrgKey, year: number, teamKey: TeamKey) {
		logger.addContext('funcName', 'findTeamImages');
		
		if (!(typeof orgKey == 'string')) throw new TypeError('orgKey must be string');
		if (!(typeof year == 'number')) throw new TypeError('year must be number');
		if (!(typeof teamKey == 'string')) throw new TypeError('teamKey must be string');
		
		logger.debug('Finding list of images');
		//Sorted by inverse of upload time
		let uploads = await utilities.find('uploads', 
			{org_key: orgKey, year: year, team_key: teamKey, removed: false}, 
			{sort: {'index': 1, 'uploader.upload_time': -1}},
			{allowCache: true}
		);
		let imageKeys: StringDict = {};
		let teamImages: TeamImages = {};
		
		logger.debug(`uploads=${JSON.stringify(uploads)}`);
		
		if (uploads[0]) {
			for (let upload of uploads) {
				if (upload.hasOwnProperty('index')) {
					const key = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${upload.s3_key}`;
					//Assign FIRST MATCHING s3 key to corresponding image type
					switch (upload.index) {
						case 0:
							if (!imageKeys.main) imageKeys.main = key;
							break;
						case 1:
							if (!imageKeys.a) imageKeys.a = key;
							break;
						case 2:
							if (!imageKeys.b) imageKeys.b = key;
							break;
						case 3:
							if (!imageKeys.c) imageKeys.c = key;
					}
				}
			}
		}
		
		logger.info(`imageKeys=${JSON.stringify(imageKeys)}`);
		
		//For main, a, b, and c, set links to _sm, _md, and _lg respectively
		for (let prop in imageKeys) {
			teamImages[prop] = {
				sm: imageKeys[prop] + '_sm.jpg',
				md: imageKeys[prop] + '_md.jpg',
				lg: imageKeys[prop] + '_lg.jpg',
			};
		}
		
		logger.debug(`imageLinks=${JSON.stringify(teamImages)}`);
		
		logger.removeContext('funcName');
		return teamImages;
	}
	
	/**
	 * Return ImageLinks from an upload object.
	 * @param {object} upload Upload object from database.
	 * @returns {ImageLinks} Links to images
	 */
	static getLinks (upload: Upload) {
		logger.addContext('funcName', 'findTeamImages');
				
		const key = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${upload.s3_key}`;
		
		let imageLinks: ImageLinks = {
			sm: key + '_sm.jpg',
			md: key + '_md.jpg',
			lg: key + '_lg.jpg',
		};
		
		logger.trace(`upload=${JSON.stringify(upload)}, imageLinks=${JSON.stringify(imageLinks)}`);
		
		logger.removeContext('funcName');
		return imageLinks;
	}

	/**
	 * Find upload links for a given team.
	 * @param {string} orgKey org_key
	 * @param {number} year year
	 * @param {array} teamKeys Array of team_keys
	 * @returns {ImageLinks[]} Links to images
	 */
	static async findTeamImagesMultiple(orgKey: OrgKey, year: number, teamKeys: TeamKey[]) {
		logger.addContext('funcName', 'findTeamImages');
		
		if (!(typeof orgKey == 'string')) throw new TypeError('orgKey must be string');
		if (!(typeof year == 'number')) throw new TypeError('year must be number');
		if (!(typeof teamKeys == 'object')) throw new TypeError('teamKey must be array');
		
		logger.debug('Finding list of images');
		
		//Sorted by inverse of upload time
		let uploads = await utilities.find('uploads',
			{org_key: orgKey, year: year, team_key: {$in: teamKeys}, removed: false}, 
			{sort: {'index': 1, 'uploader.upload_time': -1}},
			{allowCache: true}
		);
		
		//Sort results by team number
		uploads.sort((a: Upload, b: Upload) => {
			if (a.hasOwnProperty('team_key') && b.hasOwnProperty('team_key')) {
				let aNum = parseInt(a.team_key.substring(3));
				let bNum = parseInt(b.team_key.substring(3));
				return aNum - bNum;
			}
			return 0;
		});
		
		//Array of ImageLinks, ordered by team
		let imageLinksArr = [];
		
		for (let i in teamKeys) {
			let thisTeamKey = teamKeys[i];
			let thisTeamNum = parseInt(thisTeamKey.substring(3));
			
			//Splice out the uploads for each teamKey
			let numToSplice = 0;
			for (let j in uploads) {
				let upload = uploads[j];
				let uploadTeamNum = parseInt(upload.team_key.substring(3));
				
				//If uploadTeamNum > teamNum, then we don't have any uploads for this teamKey
				if (uploadTeamNum > thisTeamNum) {
					break;
				}
				//If we've got the right team, add to numToSplice
				else if (uploadTeamNum == thisTeamNum) {
					numToSplice++;
				}
				//uploadTeamNum should never < teamNum
				else {
					console.error('WARNING uploadTeamNum < teamNum');
					break;
				}
			}
			
			let imageKeys: StringDict = {};
			let imageLinks: TeamImages = {};
			
			let thisTeamUploads = uploads.splice(0, numToSplice);
			
			//Now, go through each upload for this team and get its corresponding link
			if (thisTeamUploads[0]) {
				for (let upload of thisTeamUploads) {
					if (upload.hasOwnProperty('index')) {
						const key = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${upload.s3_key}`;
						//Assign FIRST MATCHING s3 key to corresponding image type
						switch (upload.index) {
							case 0:
								if (!imageKeys.main) imageKeys.main = key;
								break;
							case 1:
								if (!imageKeys.a) imageKeys.a = key;
								break;
							case 2:
								if (!imageKeys.b) imageKeys.b = key;
								break;
							case 3:
								if (!imageKeys.c) imageKeys.c = key;
						}
					}
				}
			}
			
			//For main, a, b, and c, set links to _sm, _md, and _lg respectively
			for (let prop in imageKeys) {
				imageLinks[prop] = {
					sm: imageKeys[prop] + '_sm.jpg',
					md: imageKeys[prop] + '_md.jpg',
					lg: imageKeys[prop] + '_lg.jpg',
				};
			}
			
			imageLinksArr.push(imageLinks);
		}
		
		//logger.debug(`imageLinksArr=${JSON.stringify(imageLinksArr)}`);
		
		logger.removeContext('funcName');
		return imageLinksArr;
	}
}

module.exports = UploadHelper;
export default UploadHelper;

export interface ImageLinks {
	sm?: string;
	md?: string;
	lg?: string;
}

export interface TeamImages {
	// main, a, b, c
	[key: string]: ImageLinks;
}


declare interface StringDict {
	[key: string]: string;
}
