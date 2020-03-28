const router = require('express').Router();
const logger = require('log4js').getLogger();
const Jimp = require('jimp');
const path = require('path');

var imageTemplate, pointerTemplate, headerFont, teamFont;

router.get('/upcomingmatch', async (req, res, next) => {
	
	//all parameters from query
	var matchNum = verifyNumber(req.query.match_number);
	var setNum = verifyNumber(req.query.set_number || 1);
	var compLevel = req.query.comp_level || '';
	var blue = [
		verifyNumber(req.query.blue1),
		verifyNumber(req.query.blue2),
		verifyNumber(req.query.blue3),
	];
	var red = [
		verifyNumber(req.query.red1),
		verifyNumber(req.query.red2),
		verifyNumber(req.query.red3),
	];
	var assigned = req.query.assigned || 'blue1';
	
	var headerText;
	switch (compLevel) {
		case 'qm': 
			headerText = `Qualifying Match ${matchNum}`;
			break;
		case 'qf':
			headerText = `Quarterfinal ${setNum} Match ${matchNum}`;
			break;
		case 'sf':
			headerText = `Semifinal ${setNum} Match ${matchNum}`;
			break;
		case 'f':
			headerText = `Final Match ${matchNum}`;
			break;
		default:
			headerText = `Undefined Match ${matchNum}`;
	}
	
	//Selected-team x and y coordinates for pointer triangle
	var x1, y1, x2, y2;
	switch (assigned) {
		case 'blue1':
			x1 = 115, y1 = 123, x2 = 274, y2 = 123;
			break;
		case 'blue2':
			x1 = 115, y1 = 177, x2 = 274, y2 = 177;
			break;
		case 'blue3':
			x1 = 115, y1 = 231, x2 = 274, y2 = 231;
			break;
		case 'red1':
			x1 = 525, y1 = 123, x2 = 684, y2 = 123;
			break;
		case 'red2':
			x1 = 525, y1 = 177, x2 = 684, y2 = 177;
			break;
		case 'red3':
			x1 = 525, y1 = 231, x2 = 684, y2 = 231;
			break;
		default:
			x1 = 0, y1 = 0, x2 = 0, y2 = 0;
	}
	
	const startTime = Date.now();
	
	await getJimpResources();
	
	var image = await imageTemplate.clone();
	var pointer = await pointerTemplate.clone();
	
	//Await all text-printing
	await Promise.all([
		//Header
		image.print(headerFont, 0, 0, {
			text: headerText,
			alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
		}, 820, 80),
		//Blue teams
		image.print(teamFont, 0, 0, {
			text: blue[0],
			alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
		}, 410, 160),
		image.print(teamFont, 0, 0, {
			text: blue[1],
			alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
		}, 410, 214),
		image.print(teamFont, 0, 0, {
			text: blue[2],
			alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
		}, 410, 268),
		//Red teams
		image.print(teamFont, 410, 0, {
			text: red[0],
			alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
		}, 410, 160),
		image.print(teamFont, 410, 0, {
			text: red[1],
			alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
		}, 410, 214),
		image.print(teamFont, 410, 0, {
			text: red[2],
			alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
		}, 410, 268),
	]);
	
	//pointer for selected team
	await image.composite(pointer, x1, y1);
	await pointer.flip(true, false);
	await image.composite(pointer, x2, y2);
	
	await image.quality(90);
	
	var buffer = await image.getBufferAsync('image/jpeg');
	
	res.setHeader('Content-Type', 'image/jpeg');
	res.send(buffer);
	
	logger.info(`Completed image in ${Date.now() - startTime} ms`);
});

function verifyNumber(input) {
	
	if ( isNaN (parseInt(input)) ) {
		input = '0';
	}
	return parseInt(input).toString();
}

async function getJimpResources(){
	
	if (!imageTemplate) imageTemplate = await Jimp.read('./assets/upcomingmatch-template.png');
	if (!pointerTemplate) pointerTemplate = await Jimp.read('./assets/upcomingmatch-pointer.png');
	if (!headerFont) headerFont = await Jimp.loadFont('./assets/Bahnschrift.fnt');
	if (!teamFont) teamFont = await Jimp.loadFont('./assets/Consolas.fnt');
	
	return;
}

module.exports = router;