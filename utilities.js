const monk = require("monk");
const fs = require("fs");

var utilities = module.exports =  {};

/**
 * One-time function that returns Monk DB, with specified DB string name.
 * @param {string} dbName name of DB
 * @return {*} Monk db
 */
utilities.getDB = function(uri){
	
	//check if we have a db user file
	var hasDBUserFile = fs.existsSync(".dbuser");
	var db;
	
	if(hasDBUserFile){
		var dbUser = JSON.parse(fs.readFileSync(".dbuser", {"encoding": "utf8"}));
		console.log(dbUser);
		console.log(`${dbUser.username}:${dbUser.password}@localhost:27017/${dbName}`);	
		db = monk(`${dbUser.username}:${dbUser.password}@localhost:27017/${dbName}`);	
	}
	else{
		db = monk(uri);			//Local db on localhost without authentication
	}
	
	return db;
}

//
var db = utilities.getDB("mongodb+srv://TestUser:uZnk9zqfXwGyfjym@cluster0-obbqu.mongodb.net/test?retryWrites=true");

/**
 * Asynchronous "find" function to a collection specified in first parameter.
 * @param collection [String] Collection to find in.
 * @param parameters [Object] Query parameters.
 * @param options [Object] Query options, such as sort.
 */
utilities.find = async function(collection, parameters, options){
	
	//If the collection is not specified and is not a String, throw an error.
	//This would obly be caused by a programming error.
	if(typeof(collection) != "string"){
		throw new Error("Collection must be specified.");
	}
	//If query parameters are not set, create an empty object for the DB call.
	if(!parameters){
		var parameters = {};
	}
	//If parameters exists and is not an object, throw an error. 
	if(typeof(parameters) != "object"){
		throw new Error("Utilities.find Error: Parameters must be of type object");
	}
	//If query options are not set, create an empty object for the DB call.
	if(!options){
		var options = {};
	}
	//If options exists and is not an object, throw an error.
	if(typeof(options) != "object"){
		throw new Error("Utilities.find Error: Options must be of type object");
	}
	
	//Get collection
	var Col = db.get(collection);
	//Find in collection with parameters and options
	var data = [];
	data = await Col.find(parameters, options);
	
	//Return (Promise to get) data
	return data;
}

/**
 * Asynchronous request to TheBlueAlliance. Requires a URL ending to execute correctly.
 * @param {string} url ENDING of URL, after "https://.../api/v3/"
 * @return {Promise} Promise; Resolves when client receives a request from TBA
 */
utilities.requestTheBlueAliance = async function(url){
	
	//Setup our request URL, including specified URL ending parameter
	var requestURL = "https://www.thebluealliance.com/api/v3/" + url;
	
	//Get TBA key
	var tbaKey = await getTBAKey();
	
	//Create promise first
	var thisPromise = new Promise(function(resolve, reject){
		
		//Inside promise function, perform client request
		client.get(requestURL, tbaKey, function(tbaData, response){
			
			tbaData = JSON.parse(tbaData);
			//Inside client callback, resolve promise
			resolve(tbaData);
		});
	});
	
	//Resolve promise
	return thisPromise;
}

/**
 * Asynchronous function to get our TheBlueAlliance API key from the DB.
 * @return {Promise} - [Object] TBA arguments
 */
utilities.getTBAKey = async function(){
	
	var passwordsCol = db.get("passwords");
	
	var tbaArgsArray = await passwordsCol.find({name: "thebluealliance-args"});
	
	if(tbaArgsArray && tbaArgsArray[0]){
		var headers = tbaArgsArray[0].headers;
		var tbaArgs = {"headers": headers};
		return tbaArgs;
	}
	else{
		//**********CONSIDER ANOTHER OPTION FOR HANDLING "CAN'T FIND REQUEST ARGS"
		return null;
	}
}

/**
 * Asynchronous function to get current event from database.
 * @return {Promise}-[Object] Event key and name for current event
 */
utilities.getCurrent = async function(){
	
	var currentCol = db.get("current");
	var current = {
		key: "undefined",
		name: "undefined"
	};
	
	var currentKey = await currentCol.find({});
	
	if(currentKey && currentKey[0]){
		current.key = currentKey[0].event;
		
		var currentData = await find("events", {key: current.key});
		
		if(currentData && currentData[0]){
			current.name = currentData[0].name;
		}
	}
	
	return current;
}