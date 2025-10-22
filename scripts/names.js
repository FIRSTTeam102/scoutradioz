// Colored names common across multiple helper scripts.

require('colors');

const mongodName =  'MONGOD   '.brightYellow;
const lessName =    'LESS     '.brightYellow;
const primaryName = 'PRIMARY  '.gray;
const uploadName =  'UPLOAD   '.blue;
const svelteName =  'SVELTE   '.red;

const indivName = 'TS-INDIV '.brightYellow;
const bundledName = 'TS-BUNDLE'.brightYellow;

const errorName = 'Error'.brightRed;

module.exports = {
	mongodName,
	lessName,
	primaryName,
	svelteName,
	indivName,
	uploadName,
	bundledName,
	errorName,
};