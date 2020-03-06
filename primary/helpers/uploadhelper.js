'use strict';
const logger = require('log4js').getLogger();
const utilities = require("@firstteam102/scoutradioz-utilities");

var functions = module.exports = {};

/**
 * Find upload links for a given team.
 * @param {String} orgKey org_key
 * @param {Number} year year
 * @param {String} teamKey team_key
 * @return {Object} Links to images
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
	var imageLinks = {};
	
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