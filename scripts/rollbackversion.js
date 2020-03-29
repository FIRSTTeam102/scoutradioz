'use strict';
const aws = require('aws-sdk');
const lambda = new aws.Lambda({
	region: 'us-east-1'
});

var aliasProd = 'PROD';
var aliasPrevious = 'PREVIOUS';
var functionName;

//eslint-disable-next-line
for (var i in process.argv) {
	let thisArg = process.argv[i];
	let nextArg = process.argv[i - -1];
	
	switch (thisArg) {
		case '--function-name':
			if (nextArg) functionName = nextArg;
			break;
	}
}

console.log(`${functionName}: Rolling back PROD to PREVIOUS version`);

rollbackProd((err, data) => {
	if (err) throw err;
	else {
		console.log(data);
	}
});

function rollbackProd(cb) {
	
	const time = new Date().toISOString().replace('T','_').replace(/\:|\-/g,'').split('.')[0];
	
	var params = {
		FunctionName: functionName, 
		Name: aliasProd,
	};
	console.log(`Getting data for alias=${aliasProd}`);
	
	//Get data for prod alias.
	lambda.getAlias(params, (err, data) => {
		if (err) cb('Could not find alias: ' + aliasProd, err);
		else {
			//Version to promote.
			var versionToDemote = data.FunctionVersion;
			
			console.log(`${aliasProd}: Version to demote (roll back): ${versionToDemote}`);
					
			var params = {
				FunctionName: functionName, 
				Name: aliasPrevious,
			};
			console.log(`Getting data for alias=${aliasPrevious}`);
			
			//Get data for alias that we will promote to.
			lambda.getAlias(params, (err, data) => {
				if (err) cb('Could not find alias: ' + aliasPrevious, err);
				else {
					//Version that already exists for this alias.
					var versionToPromote = data.FunctionVersion;
					console.log(`${aliasPrevious}: Version to re-promote (roll forward): ${versionToPromote}`);
					
					var params = {
						FunctionName: functionName,
						Name: aliasPrevious,
						FunctionVersion: versionToDemote,
					};
					console.log(`Setting ${aliasPrevious} to version ${versionToDemote}`);
					
					//Demote version from PROD into PREVIOUS.
					lambda.updateAlias(params, (err, data) => {
						if (err) cb(err);
						else {
							
							var params = {
								FunctionName: functionName,
								Name: aliasProd,
								FunctionVersion: versionToPromote,
							};
							console.log(`Setting ${aliasProd} alias to old version: ${versionToPromote}`);
							
							//Promote version from PREVIOUS into PROD.
							lambda.updateAlias(params, (err, data) => {
								if (err) cb(err);
								else {
									cb(null, data);
								}
							});
						}
					});
				}
			});
		}
	});
}