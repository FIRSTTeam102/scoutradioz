#!/usr/bin/env ts-node

/* eslint-disable global-require */
import fs from 'fs';
import path from 'path';
import { I18n } from '../src/helpers/i18n';

const fromKey = process.argv[2];
const toKey = process.argv[3];

if (!fromKey || !toKey) {
	console.log('Usage: ts-node scripts/changeLocaleKeys.ts <from> <to>');
	console.log('e.g. ts-node scripts/changeLocaleKeys.ts layout.nav.manage.scouters.pitassignments manage.assignments.pitAssignments');
	process.exit();
}

let fromTree = fromKey.split('.');
let toTree = toKey.split('.');

let localesDir = path.join(__dirname, '..', 'locales');

const i18n = new I18n({
	directory: localesDir
});

let locales = fs.readdirSync(localesDir);

for (let localeFile of locales) {
	console.log(`\n${localeFile}:`);
	let json = require(path.join(localesDir, localeFile));
	
	let translatedString = i18n._findInObject(fromKey, json);
	if (translatedString) {
		console.log(`Found translated string: ${translatedString}`);
		// Jankily delete the original key from the JSON (eval is unsafe but this is just a simple script)
		eval(`delete json["${fromTree.join('"]["')}"]`);
		
		// Jankily insert the translated string into the new desired place
		let thisObj = json;
		for (let i = 0; i < toTree.length - 1; i++) {
			let key = toTree[i];
			if (!thisObj[key]) {
				console.log(`Creating new key ${key}`);
				thisObj[key] = {};
			}
			thisObj = thisObj[key];
		}
		thisObj[toTree[toTree.length - 1]] = translatedString;
		
		console.log('Writing updated file...');
		fs.writeFileSync(path.join(localesDir, localeFile), JSON.stringify(json, null, '\t'), 'utf-8');
	}
	else {
		console.log('String not found.');
	}
	
}