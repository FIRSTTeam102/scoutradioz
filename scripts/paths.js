// Paths common across multiple helper scripts.

const path = require('path');

const pathToRoot = path.join(__dirname, '..');
const pathToPrimary = path.join(pathToRoot, 'primary');
const pathToUpload = path.join(pathToRoot, 'upload');

const pathToPublicSrc = path.join(pathToPrimary, 'public-src');
const pathToLess = path.join(pathToPublicSrc, 'less');

const pathToPublicCss = path.join(pathToPrimary, 'public', 'css');

const pathToTs = path.join(pathToPublicSrc, 'ts');
const pathToTsBundled = path.join(pathToPublicSrc, 'ts-bundled');
const pathToPublicJs = path.join(pathToPrimary, 'public', 'js');

module.exports = {
	pathToRoot,
	pathToPrimary,
	pathToUpload,
	pathToPublicSrc,
	pathToLess,
	pathToPublicCss,
	pathToTs,
	pathToTsBundled,
	pathToPublicJs,
};