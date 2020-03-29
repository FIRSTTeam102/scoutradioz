'use strict';
const aws = require('aws-sdk');
const lambda = new aws.Lambda({
	region: 'us-east-1'
});

var aliasPromoteTo;
var aliasPromoteFrom;
var functionName;

//eslint-disable-next-line
for (var i in process.argv) {
	let thisArg = process.argv[i];
	let nextArg = process.argv[i - -1];
	
	switch (thisArg) {
		case '--promote-from':
			if (nextArg) aliasPromoteFrom = nextArg.toUpperCase();
			break;
		case '--promote-to':
			if (nextArg) aliasPromoteTo = nextArg.toUpperCase();
			break;
		case '--function-name':
			if (nextArg) functionName = nextArg;
			break;
	}
}

//
if (!(aliasPromoteFrom && aliasPromoteTo)) {
	throw 'Aliases not specified. Use arguments --promote-from and --promote-to.';
}

console.log(`${functionName}: Promoting from ${aliasPromoteFrom} to ${aliasPromoteTo}`);

promoteCode((err, data) => {
	if (err) throw err;
	else {
		console.log(data);
	}
});

function promoteCode(cb) {
	
	const time = new Date().toISOString().replace('T','_').replace(/\:|\-/g,'').split('.')[0];
	
	var params = {
		FunctionName: functionName, 
		Name: aliasPromoteFrom,
	};
	console.log(`Getting data for alias=${aliasPromoteFrom}`);
	
	//Get data for alias that we will promote from.
	lambda.getAlias(params, (err, data) => {
		if (err) cb('Could not find alias: ' + aliasPromoteFrom, err);
		else {
			//Version to promote.
			var versionToPromote = data.FunctionVersion;
			
			console.log(`${aliasPromoteFrom}: Version to promote: ${versionToPromote}`);
					
			var params = {
				FunctionName: functionName, 
				Name: aliasPromoteTo,
			};
			console.log(`Getting data for alias=${aliasPromoteTo}`);
			
			//Get data for alias that we will promote to.
			lambda.getAlias(params, (err, data) => {
				if (err) cb('Could not find alias: ' + aliasPromoteTo, err);
				else {
					//Version that already exists for this alias.
					var oldVersion = data.FunctionVersion;
					console.log(`${aliasPromoteTo}: Old version: ${oldVersion}`);
					
					var params = {
						FunctionName: functionName,
						Name: aliasPromoteTo,
						FunctionVersion: versionToPromote,
					};
					console.log(`Setting ${aliasPromoteTo} to version ${versionToPromote}`);
					
					//Promote version to new alias.
					lambda.updateAlias(params, (err, data) => {
						if (err) cb(err);
						else {
							//SPECIFIC CASE: If we are promoting to PROD, we need to set oldVersion to PREVIOUS
							if (aliasPromoteTo == 'PROD') {
								
								var params = {
									FunctionName: functionName,
									Name: 'PREVIOUS',
									FunctionVersion: oldVersion,
								};
								console.log(`Setting PREVIOUS alias to old version: ${oldVersion}`);
								
								//Demote oldVersion to PREVIOUS alias
								lambda.updateAlias(params, (err, data) => {
									if (err) cb(err);
									else {
										cb(null, data);
									}
								});
							}
							else {
								cb(null, data);
							}
						}
					});
				}
			});
		}
	});
}