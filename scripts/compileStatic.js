const less = require('less');
const fs = require('fs');
const path = require('path');

if (!process.argv[2]) {
	console.error('Path to LESS source must be specified');
}
// const lessPath = path.join(__dirname, 'primary', 'public', 'less', 'base.less');
const lessPath = path.join(__dirname, '..', process.argv[2]);

renderLess();

async function renderLess() {
	console.log(`Reading LESS From ${lessPath}`);
	
	const lessSource = fs.readFileSync(lessPath, {encoding: 'utf-8'});
	
	console.log('Rendering...');
	
	var result = await less.render('@import url("' + lessPath + '");');
	console.log(result);
}