'use strict';
const logger = require('@log4js-node/log4js-api').getLogger('helpers');
/*const logger = {
	debug: console.log,
	info: console.log,
	warn: console.log
}*/
var utilities = null;
var uploadHelper = module.exports = {};

uploadHelper.config = function(utilitiesModule){
	utilities = utilitiesModule;
}

/**
 * Find upload links for a given team.
 * @param {string} orgKey org_key
 * @param {number} year year
 * @param {string} teamKey team_key
 * @returns {ImageLinks} Links to images
 */
uploadHelper.findTeamImages = async (orgKey, year, teamKey) => {
	const thisFuncName = "uploadhelper.findTeamImages: ";
	
	if (!(typeof orgKey == 'string')) throw new TypeError('orgKey must be string');
	if (!(typeof year == 'number')) throw new TypeError('year must be number');
	if (!(typeof teamKey == 'string')) throw new TypeError('teamKey must be string');
	
	logger.debug(`${thisFuncName} Finding list of images`)
	//Sorted by inverse of upload time
	var uploads = await utilities.find("uploads", 
		{org_key: orgKey, year: year, team_key: teamKey, removed: false}, 
		{sort: {"index": 1, "uploader.upload_time": -1}},
		{allowCache: true}
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
 * Return ImageLinks from an upload object.
 * @param {object} upload Upload object from database.
 * @returns {ImageLinks} Links to images
 */
uploadHelper.getLinks = (upload) => {
	const thisFuncName = "uploadhelper.getLinks: ";
	
	var imageLinks = new ImageLinks();
	
	const key = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${upload.s3_key}`;
	
	imageLinks.sm = key + '_sm.jpg';
	imageLinks.md = key + '_md.jpg';
	imageLinks.lg = key + '_lg.jpg';
	
	logger.trace(`${thisFuncName} upload=${JSON.stringify(upload)}, imageLinks=${JSON.stringify(imageLinks)}`);
	
	return imageLinks;
}

/**
 * Find upload links for a given team.
 * @param {string} orgKey org_key
 * @param {number} year year
 * @param {array} teamKeys Array of team_keys
 * @returns {ImageLinks[]} Links to images
 */
uploadHelper.findTeamImagesMultiple = async (orgKey, year, teamKeys) => {
	const thisFuncName = "uploadhelper.findTeamImagesMultiple: ";
	
	if (!(typeof orgKey == 'string')) throw new TypeError('orgKey must be string');
	if (!(typeof year == 'number')) throw new TypeError('year must be number');
	if (!(typeof teamKeys == 'object')) throw new TypeError('teamKey must be array');
	
	logger.debug(`${thisFuncName} Finding list of images`);
	
	//Sorted by inverse of upload time
	var uploads = await utilities.find("uploads",
		{org_key: orgKey, year: year, team_key: {$in: teamKeys}, removed: false}, 
		{sort: {"index": 1, "uploader.upload_time": -1}},
		{allowCache: true}
	);
	
	var imageKeys = {};
	var imageLinks = new ImageLinks();
	
	//console.log(uploads);
	//logger.debug(`${thisFuncName} uploads=${JSON.stringify(uploads)}`);
	
	//Sort results by team number
	uploads.sort((a, b) => {
		if (a.hasOwnProperty('team_key') && b.hasOwnProperty('team_key')) {
			var aNum = parseInt(a.team_key.substring(3));
			var bNum = parseInt(b.team_key.substring(3));
			return aNum - bNum;
		}
	});
	
	//Array of ImageLinks, ordered by team
	var imageLinksArr = [];
	
	for (var i in teamKeys) {
		var thisTeamKey = teamKeys[i];
		var thisTeamNum = parseInt(thisTeamKey.substring(3));
		
		//Splice out the uploads for each teamKey
		var numToSplice = 0;
		for (var j in uploads) {
			var upload = uploads[j];
			var uploadTeamNum = parseInt(upload.team_key.substring(3));
			
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
				console.error("WARNING uploadTeamNum < teamNum");
				break;
			}
		}
		
		var imageKeys = {};
		var imageLinks = new ImageLinks();
		
		var thisTeamUploads = uploads.splice(0, numToSplice);
		
		//Now, go through each upload for this team and get its corresponding link
		if (thisTeamUploads[0]) {
			for (var upload of thisTeamUploads) {
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
		
		//For main, a, b, and c, set links to _sm, _md, and _lg respectively
		for (var prop in imageKeys) {
			imageLinks[prop] = {
				sm: imageKeys[prop] + "_sm.jpg",
				md: imageKeys[prop] + "_md.jpg",
				lg: imageKeys[prop] + "_lg.jpg",
			}
		}
		
		imageLinksArr.push(imageLinks);
	}
	
	//logger.debug(`${thisFuncName} imageLinksArr=${JSON.stringify(imageLinksArr)}`);
	
	return imageLinksArr;
}

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