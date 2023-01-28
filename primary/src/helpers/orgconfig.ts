import type { AnyDict } from '@firstteam102/scoutradioz-types';
import type express from 'express';

export function getSubteamsAndClasses(reqBody: {[key: string]: any}) {
	//Aggregate config.members.subteams and config.members.classes
	// 	note: there is no data structure validation in this code, so when we create an org config
	// 	page, we can't take this code verbatim
	let subteams: AnyDict[] = [];
	let classes: AnyDict[] = [];
	for (let elem in reqBody) {
		let split = elem.split('_');
		let elemIdx = parseInt(split[1]);
		let elemType = split[2];
		let elemKey, elemValue;
		let origValue = reqBody[elem];
		
		switch (elemType) {
			case 'pitscout':
				elemKey = 'pit_scout';
				console.log(origValue);
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
				if (isNaN(elemValue)) {
					throw new Error(`${elem} -> ${origValue} is NaN!!`);
				}
				break;
			default:
				elemKey = elemType;
				elemValue = origValue;
		}
		
		//Go through subteams
		if (elem.includes('subteams')) {
			//if there is no subteam at this idx, create it
			if (!subteams[elemIdx]) {
				subteams[elemIdx] = {};
			}
			//pop in this element into the corresponding part of subteams
			subteams[elemIdx][elemKey] = elemValue;
		}
		//Go through classes
		else if (elem.includes('classes')) {
			//if there is no subteam at this idx, create it
			if (!classes[elemIdx]) {
				classes[elemIdx] = {};
			}
			//pop in this element into the corresponding part of classes
			classes[elemIdx][elemKey] = elemValue;
		}
	}
	
	return {subteams, classes};
}