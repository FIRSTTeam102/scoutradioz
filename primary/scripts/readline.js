// Simple readline interface for db update scripts
// usage: 
//	var response = await readline.ask('question'); -> string
// 	var confirmation = await readline.confirm('question'); -> boolean, yes or no response

const _readline = require('readline');

const readline = module.exports = {};

readline.rl = _readline.createInterface({
	input: process.stdin,
	output: process.stdout
});


readline.ask = function(question) {
	return new Promise((resolve, reject) => {
		readline.rl.question(question, answer => {
			resolve(answer);
		});
	});
};

readline.confirm = function(question) {
	return new Promise((resolve, reject) => {
		readline.rl.question(question + ' [y/N]: ', answer => {
			if (answer.toLowerCase().startsWith('y')) resolve(true);
			else resolve(false);
		});
	});
};