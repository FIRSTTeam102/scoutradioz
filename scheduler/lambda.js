'use strict';

const log4js = require('log4js');
const AWS = require("aws-sdk");

//logger config
log4js.configure({
	appenders: { out: { type: 'stdout', layout: { type: 'basic' } } },
	categories: { default: { appenders: ['out'], level: 'info' } }
});
const logger = log4js.getLogger();
logger.level = 'debug';

//ARN for lambda function
const functionArn = "arn:aws:lambda:us-east-1:243452333432:function:SchedulerStack-SchedulerFunction-1IHZKOKYOFQZ6";

exports.handler = async (event, context, cb) => {
	logger.info("Function is executing!!!");
	
	console.log(event);
	console.log(context);
	
	/* Sample event.request
	event.request = {
		url: 'https://scoutradioz.com/foo/bar'
		type: 'GET',
		args: {
			key1: "value1",
			key2: "value2"
		}
	};
	*/
	if (event.request) {
		var request = event.request;
		//Filter/validate request object
		if (typeof request.url != "string") throw "request.url must be a string";
		if (typeof request.type != "string") throw "request.type must be a string";
		request.type = request.type.toLowerCase();
		if (request.type != 'get' && request.type != 'post') throw "request.type must be either GET or POST"
		if (!request.args) request.args = {};
		if (typeof request.args != "object") throw "request.args must be of type object";
		
		var response;
		
		if (request.type == 'get') {
			response = await sendGetRequest(request.url, request.args);
		}
		else if (request.type == 'post') {
			response = await sendPostRequest(request.url, request.args);
		}
		
		console.log(response);
	}
	
	if (event.nextTask) {
		var input;
		if (event.nextInput) {
			input = event.nextInput;
		}
		else {
			input = {message: "Default message! Hello!"};
		}
		
		scheduleTask(event.nextTask, input);
	}
	
	if (typeof cb == 'function') {
		console.log("Executing callback");
		cb(null);
	}
};

/**
 * @param {Object} nextTask Object from event - Time until next task
 * @param {Object} jsonInput Input that will be passed into next event
 */
function scheduleTask(nextTask, jsonInput) {

    var cloudwatchevents = new AWS.CloudWatchEvents();
	var currentTime = new Date().getTime(); // UTC Time
	
	//validate nextTask parameters
	if (typeof nextTask.unit != "string") throw "nextTask.unit must be string";
	if (typeof nextTask.value != "number") throw "nextTask.value must be number";
	
	logger.info(`Scheduling next task in ${nextTask.value} ${nextTask.unit}.`)
	
	var nextTime = dateAdd(currentTime, nextTask.unit, nextTask.value);
	//validate that dateAdd worked properly
	if (typeof nextTime != "object") throw "nextTask.unit likely invalid";
	
	var min = nextTime.getMinutes();
	var hour = nextTime.getHours();
	var day = nextTime.getDate();
	var month = nextTime.getMonth() + 1;
	var year = nextTime.getFullYear()
	
	var scheduleExpression = `cron(${min} ${hour} ${day} ${month} ? ${year})`
	//var scheduleExpression = "cron(" + nextMinutes + " " + nextHours + " * * ? *)";
	var ruleParams = {
		Name: "SchedTest",
		ScheduleExpression: scheduleExpression
	};
	cloudwatchevents.putRule(ruleParams, function(err, data) {
		if (err) {
			logger.error(err, err.stack);  
		}
		else {
			logger.info(data);
		}
	});
	//***IMPORTANT: ARN of Scheduler func is hardcoded. If we delete and 
	//repackage it, we'll need to copy its new ARN and ID.
	var targetParams = {
		Rule: "SchedTest",
		Targets: [{
			Arn: functionArn,
			Id: "CustomScheduleTarget",
			Input: JSON.stringify(jsonInput),
		}],
	}
	cloudwatchevents.putTargets(targetParams, function(err, data) {
		if (err) {
			logger.error(err, err.stack);  
		}
		else {
			logger.info(data);
		}
	});
}

var dateAdd = function(date, interval, units) {
    var ret = new Date(date); // don't change original date
    switch(interval.toLowerCase()) {
        case 'year'    :
        case 'years'   :  ret.setFullYear(ret.getFullYear() + units);  break;
        case 'quarter' :
		case 'quarters':  ret.setMonth(ret.getMonth() + 3*units);  break;
        case 'month'   :
		case 'months'  :  ret.setMonth(ret.getMonth() + units);  break;
        case 'week'    :
		case 'weeks'   :  ret.setDate(ret.getDate() + 7*units);  break;
        case 'day'     :
		case 'days'    :  ret.setDate(ret.getDate() + units);  break;
        case 'hour'    :
		case 'hours'   :  ret.setTime(ret.getTime() + units*3600000);  break;
        case 'minute'  :
		case 'minutes' :  ret.setTime(ret.getTime() + units*60000);  break;
        case 'second'  :
		case 'seconds' :  ret.setTime(ret.getTime() + units*1000);  break;
        default        :  ret = undefined;  break;
    }
    return ret;
}

function sendGetRequest(requestURL, parameters) {
	
	//Create promise first
	var thisPromise = new Promise(function(resolve, reject){
		
		var Client = require('node-rest-client').Client;
		var client = new Client();
		
		//Inside promise function, perform client request
		client.get(requestURL, parameters, function(data, response){
			
			var str;
			if (data.toString() == "[object Object]") str = JSON.stringify(data);
			else str = data.toString();
			
			logger.debug(`Response: ${str.substring(0, 1000)}...`);
			logger.trace(`Full response: ${str}`);
			
			resolve(data);
		});
	});
	
	//Resolve promise
	return thisPromise;
}

function sendPostRequest(requestURL, parameters) {
	
	//Create promise first
	var thisPromise = new Promise(function(resolve, reject){
		
		var Client = require('node-rest-client').Client;
		var client = new Client();
		
		//Inside promise function, perform client request
		client.post(requestURL, parameters, function(data, response){
			
			var str;
			if (data.toString() == "[object Object]") str = JSON.stringify(data);
			else str = data.toString();
			
			logger.debug(`Response: ${str.toString().substring(0, 1000)}...`);
			logger.trace(`Full response: ${str}`);
			
			resolve(data);
		});
	});
	
	//Resolve promise
	return thisPromise;
}
