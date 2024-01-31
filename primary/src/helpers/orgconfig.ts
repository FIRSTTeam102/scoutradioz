import type { AnyDict, OrgClass, OrgSubteam } from 'scoutradioz-types';
import type express from 'express';
import { assert } from 'scoutradioz-http-errors';

export function getSubteamsAndClasses(reqBody: {[key: string]: any}) {
	//Aggregate config.members.subteams and config.members.classes
	// 	note: there is no data structure validation in this code, so when we create an org config
	// 	page, we can't take this code verbatim
	let rawSubteams: AnyDict[] = [];
	let rawClasses: AnyDict[] = [];
	for (let elem in reqBody) {
		let split = elem.split('_');
		let elemIdx = parseInt(split[1]);
		let elemType = split[2];
		let elemKey, elemValue;
		let origValue = reqBody[elem];
		
		switch (elemType) {
			case 'pitscout':
				elemKey = 'pit_scout';
				elemValue = (origValue == true);
				break;
			case 'youth':
				elemKey = 'youth';
				elemValue = (origValue == true);
				break;
			case 'subteamkey':
				elemKey = 'subteam_key';
				elemValue = origValue;
				break;
			case 'classkey':
				elemKey = 'class_key';
				elemValue = origValue;
				break;
			case 'seniority':
				elemKey = 'seniority';
				elemValue = parseInt(origValue);
				break;
			default:
				elemKey = elemType;
				elemValue = origValue;
		}
		
		//Go through subteams
		if (elem.includes('subteams')) {
			//if there is no subteam at this idx, create it
			if (!rawSubteams[elemIdx]) {
				rawSubteams[elemIdx] = {};
			}
			//pop in this element into the corresponding part of subteams
			rawSubteams[elemIdx][elemKey] = elemValue;
		}
		//Go through classes
		else if (elem.includes('classes')) {
			//if there is no subteam at this idx, create it
			if (!rawClasses[elemIdx]) {
				rawClasses[elemIdx] = {};
			}
			//pop in this element into the corresponding part of classes
			rawClasses[elemIdx][elemKey] = elemValue;
		}
	}
	
	// Validate classes and subteams
	const subteams: OrgSubteam[] = [];
	const classes: OrgClass[] = [];
	
	// Make sure keys are unique
	const uniqueClassKeys: string[] = [];
	const uniqueSubteamKeys: string[] = [];
	
	for (let rawSubteam of rawSubteams) {
		let label = rawSubteam.label,
			subteam_key = rawSubteam.subteam_key,
			pit_scout = rawSubteam.pit_scout;
		assert(typeof label === 'string' && label.trim() !== '', 'Each subteam needs a label.');
		assert(typeof subteam_key === 'string' && subteam_key.trim() !== '', 'Each subteam needs a *unique* and non-empty subteam_key.');
		assert(typeof pit_scout === 'boolean', 'Each subteam needs a pit_scout boolean.');
		
		// Check for uniqueness
		assert(!uniqueSubteamKeys.includes(subteam_key.toLowerCase()), 'Each subteam needs a *unique* subteam_key.');
		uniqueSubteamKeys.push(subteam_key.toLowerCase());
		
		subteams.push({
			label,
			subteam_key,
			pit_scout,
		});
	}
	for (let rawClass of rawClasses) {
		let label = rawClass.label,
			class_key = rawClass.class_key,
			seniority = rawClass.seniority,
			youth = rawClass.youth;
		assert(typeof label === 'string' && label.trim() !== '', 'Each class must have a label.');
		assert(typeof class_key === 'string' && class_key.trim() !== '', 'Each class needs a *unique* and non-empty class_key.');
		assert(typeof seniority === 'number' && !isNaN(seniority), 'Each class must have a seniority.');
		assert(typeof youth === 'boolean', 'Each class must have a youth boolean.');
		
		// Check for uniqueness
		assert(!uniqueClassKeys.includes(class_key.toLowerCase()), 'Each class needs a *unique* class_key.');
		uniqueClassKeys.push(class_key.toLowerCase());
		
		classes.push({
			label,
			class_key,
			seniority,
			youth,
		});
	}
	
	return {subteams, classes, uniqueClassKeys, uniqueSubteamKeys};
}