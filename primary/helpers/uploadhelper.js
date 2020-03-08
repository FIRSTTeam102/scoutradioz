'use strict';
const logger = require('log4js').getLogger();
const utilities = require("@firstteam102/scoutradioz-utilities");

var functions = module.exports = {};

class ImageLinks{
	/**
	 * S3 links for images for a particular team.
	 * @param {string} sm Small link
	 * @param {string} md Medium link
	 * @param {string} lg Large link
	 */
	constructor(sm, md, lg) {
		this.sm = sm;
		this.md = md;
		this.lg = lg;
	}
}

/**
 * Find upload links for a given team.
 * @param {string} orgKey org_key
 * @param {number} year year
 * @param {string} teamKey team_key
 * @returns {ImageLinks} Links to images
 */
functions.findTeamImages = async (orgKey, year, teamKey) => {
	const thisFuncName = "uploadhelper.findTeamImages: ";
	
	if (!(typeof orgKey == 'string')) throw new TypeError('orgKey must be string');
	if (!(typeof year == 'number')) throw new TypeError('year must be number');
	if (!(typeof teamKey == 'string')) throw new TypeError('teamKey must be string');
	
	logger.debug(`${thisFuncName} Finding list of images`)
	//Sorted by inverse of upload time
	var uploads = await utilities.find("uploads", 
		{org_key: orgKey, year: year, team_key: teamKey}, 
		{sort: {"index": 1, "uploader.upload_time": -1}},
		{allowCache: true, maxCacheAge: 10}
	);
	var imageKeys = {};
	var imageLinks = new ImageLinks();
	
	logger.debug(`${thisFuncName} uploads=${JSON.stringify(uploads)}`)
	
	if (uploads[0]) {
		for (var upload of uploads) {
			if (upload.hasOwnProperty("index")) {
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
	
	logger.info(`${thisFuncName} imageKeys=${JSON.stringify(imageKeys)}`);
	
	//For main, a, b, and c, set links to _sm, _md, and _lg respectively
	for (var prop in imageKeys) {
		imageLinks[prop] = {
			sm: imageKeys[prop] + "_sm.jpg",
			md: imageKeys[prop] + "_md.jpg",
			lg: imageKeys[prop] + "_lg.jpg",
		}
	}
	
	logger.debug(`${thisFuncName} imageLinks=${JSON.stringify(imageLinks)}`);
	
	return imageLinks;
}

/**
 * Find upload links for a given team.
 * @param {string} orgKey org_key
 * @param {number} year year
 * @param {array} teamKeys Array of team_keys
 * @returns {ImageLinks[]} Links to images
 */
functions.findTeamImagesMultiple = async (orgKey, year, teamKeys) => {
	const thisFuncName = "uploadhelper.findTeamImagesMultiple: ";
	
	if (!(typeof orgKey == 'string')) throw new TypeError('orgKey must be string');
	if (!(typeof year == 'number')) throw new TypeError('year must be number');
	if (!(typeof teamKeys == 'object')) throw new TypeError('teamKey must be array');
	
	logger.debug(`${thisFuncName} Finding list of images`)
	//Sorted by inverse of upload time
	var uploads = await utilities.find("uploads", 
		{org_key: orgKey, year: year, team_key: {$in: teamKeys}}, 
		{sort: {"index": 1, "uploader.upload_time": -1}},
		{allowCache: true, maxCacheAge: 10}
	);
	var imageKeys = {};
	var imageLinks = new ImageLinks();
	
	logger.debug(`${thisFuncName} uploads=${JSON.stringify(uploads)}`)
	
	if (uploads[0]) {
		for (var upload of uploads) {
			if (upload.hasOwnProperty("index")) {
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
	
	logger.info(`${thisFuncName} imageKeys=${JSON.stringify(imageKeys)}`);
	
	//For main, a, b, and c, set links to _sm, _md, and _lg respectively
	for (var prop in imageKeys) {
		imageLinks[prop] = {
			sm: imageKeys[prop] + "_sm.jpg",
			md: imageKeys[prop] + "_md.jpg",
			lg: imageKeys[prop] + "_lg.jpg",
		}
	}
	
	logger.debug(`${thisFuncName} imageLinks=${JSON.stringify(imageLinks)}`);
	
	return imageLinks;
}