import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import { matchData as matchDataHelper } from 'scoutradioz-helpers';
import e, { assert } from 'scoutradioz-http-errors';
import type { MongoDocument } from 'scoutradioz-utilities';
import type {  Ranking, AggRange, OrgTeamValue } from 'scoutradioz-types';

const router = express.Router();
const logger = getLogger('allianceselection');

router.get('/', wrap(async (req, res) => {
	//Check authentication for team admin level
	if( !await req.authenticate( Permissions.ACCESS_TEAM_ADMIN ) ) return;
	
	let thisFuncName = 'allianceselection{root}[get]: ';
	logger.info(thisFuncName + 'ENTER');
	
	// for later querying by event_key
	let event_key = req.event.key;
	let event_year = req.event.year;
	let org_key = req._user.org_key;
	logger.debug(thisFuncName + 'event_key=' + event_key);
	
	// 2024-04-04 JL: Added multiple picklists
	// Check which team_key has been specified, if any, being one of the team_keys of the org
	//- JL note: (maybe TODO between seasons): when picklist_key is undefined and team_keys.length > 1, it still loads orgteamvalues with picklist_key undefined, and loads data even though it wont' be displayed
	let picklist_key: string|undefined = undefined;
	if (typeof req.query.picklist_key === 'string') picklist_key = req.query.picklist_key;
	if (picklist_key && !(req._user.org.team_keys?.includes(picklist_key))) throw new e.UserError(`Team key ${picklist_key} specified but it is not in your org's list of team_keys!`);
	
	// get the current rankings
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	let rankings: Ranking[] = await utilities.find('rankings', {event_key}, {});

	let rankMap: Dict<Ranking> = {};
	for (let rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
		//logger.debug(thisFuncName + 'rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
	}

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	let cookie_key = org_key + '_' + event_year + '_cols';
	let colCookie = req.cookies[cookie_key];
	let scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);

	let aggQuery = [];
	aggQuery.push({ $match : { org_key, event_key } });
	let groupClause: MongoDocument = {};
	// group teams for 1 row per team
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter')
		if (matchDataHelper.isQuantifiableType(thisLayout.type))
			groupClause[thisLayout.id] = {$avg: '$data.' + thisLayout.id};
	}
	aggQuery.push({ $group: groupClause });
	
	// 2022-03-03 JL: Looking up team values in the aggregate query
	aggQuery.push({ $lookup: {
		from: 'orgteamvalues',
		let: {team_key: '$_id'},
		pipeline: [
			{$match: {$expr: {$and: [
				{$eq: ['$team_key', '$$team_key']},
				{$eq: ['$org_key', org_key]},
				{$eq: ['$event_key', event_key]},
				{$eq: ['$picklist_key', picklist_key]}, // 2024-04-04 JL: added picklist_key
			]}}},
			{$project: {_id: 0, team_key: 0, event_key: 0, org_key: 0}}
		],
		as: 'value'
	}});
	// The lookup returns an array of elements, so turn value: [{value: 1}] into value: 1
	aggQuery.push({ $set: {'value': {$first: '$value'}} });
	aggQuery.push({ $set: {'value': '$value.value'} });
	
	aggQuery.push({ $sort: { _id: 1 } });
	// logger.debug(thisFuncName + 'aggQuery=' + JSON.stringify(aggQuery, 0, 2));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggArray = await utilities.aggregate('matchscouting', aggQuery);
			
	logger.trace(`${thisFuncName} rankMap=${JSON.stringify(rankMap)}`);
	
	// Rewrite data into display-friendly values
	for (let aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
		let thisAgg = aggArray[aggIdx];
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			let thisLayout = scorelayout[scoreIdx];
			if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
				let roundedVal = (Math.round(thisAgg[thisLayout.id] * 10)/10).toFixed(1);
				thisAgg[thisLayout.id] = roundedVal;
			}
		}
		if(rankMap[thisAgg._id]){
			thisAgg['rank'] = rankMap[thisAgg._id].rank;
			// thisAgg['value'] = rankMap[thisAgg._id].value; 2022-03-03 JL: Value now saved in other document
			aggArray[aggIdx] = thisAgg;
		}
	}
	//logger.debug(thisFuncName + 'aggArray=' + JSON.stringify(aggArray));

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	// var currentAggRanges = await utilities.find("currentaggranges", {}, {});
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': org_key, 'event_key': event_key});

	res.render('./manage/allianceselection', {
		title: 'Alliance Selection',
		aggdata: aggArray,
		currentAggRanges,
		layout: scorelayout,
		matchDataHelper,
		picklist_key,
		orgTeamKeys: req._user.org.team_keys,
	});
}));

/*
{
	org_key: string,
	team_key: string,
	event_key: string,
	value: non-zero number
}
*/
router.post('/updateteamvalue', wrap(async (req, res) => {
	//Check authentication for team admin level
	if( !await req.authenticate( Permissions.ACCESS_TEAM_ADMIN ) ) return;
	
	let thisFuncName = 'allianceselection.updateteamvalue[post]: ';
	logger.info(thisFuncName + 'ENTER');
	
	const team_key = req.body.key;
	const valueToAdd = parseInt(req.body.value);
	const org_key = req._user.org_key;
	const event_key = req.event.key;
	// 2024-04-04 JL: Added picklist key
	// 	Note: Behavior gets a little wonky if the list of team_keys changes at the same event *after* the picklist has been edited
	let picklist_key = req.body.picklist_key;
	if (picklist_key === 'undefined') picklist_key = undefined;
	
	if (!team_key || !valueToAdd) throw new e.UserError('Provide a team_key and a value.');
	
	let currentTeamValue: OrgTeamValue = await utilities.findOne('orgteamvalues', {org_key, team_key, event_key, picklist_key});
	
	let newValue;
	
	if (currentTeamValue) {
		newValue = currentTeamValue.value + valueToAdd;
		
		logger.debug(`Setting ${team_key}'s value to ${newValue} for org ${org_key} and picklist ${picklist_key} and event ${event_key}`);
		// If the value to set is 0, then just delete the record
		if (newValue === 0) {
			logger.debug('Deleting record');
			await utilities.remove('orgteamvalues', {_id: currentTeamValue._id});
		}
		else {
			await utilities.update('orgteamvalues', {_id: currentTeamValue._id}, {$set: {value: newValue}});
		}
	}
	// If there's no team in the values collection, create it
	else {
		newValue = valueToAdd;
		logger.debug(`Creating entry for ${team_key} for org ${org_key}, value=${newValue}, picklist=${picklist_key}`);
		
		let newEntry = {
			org_key, 
			team_key,
			event_key,
			picklist_key,
			value: newValue
		};
		
		let writeResult = await utilities.insert('orgteamvalues', newEntry);
		
		logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
	}
	res.send({
		team_key: team_key,
		value: newValue
	});
}));

export default router;