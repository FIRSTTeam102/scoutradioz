#!/usr/bin/env ts-node

// This is a bit thrown together but should pick up the majority of any missing/bad keys

const { exec } = require('child_process');
const path = require('path');
const { I18n } = require('../src/helpers/i18n');

const quoteRe = /(["'`])(.*?[^\\])\1/;

const i18n = new I18n({
	directory: path.join(__dirname, '../locales'),
});

// make sure patterns are properly escaped for grep/shell use
const searches = {
	'msg(|Url|Js|Marked)\\(.*?[,)]': '*',
	"'\\!.+?'": 'src/helpers/nav.ts',
};

const falsePositives = [': ', 'allianceselection.']; // these are rare enough that it's easier to just list them

for (const [pattern, glob] of Object.entries(searches)) {
	exec(`grep -E "${pattern}" ../${glob} -R -oh`, (err, stdout) => {
		if (err) return console.error(err);

		let items = stdout.split('\n');
		for (let item of items) {
			if (!item || !quoteRe.test(item)) continue;

			let key = item.match(quoteRe)[2];
			if (key.indexOf('${') > -1) continue;

			if (key.indexOf('!') == 0) {
				key = key.substring(1);
				if (key.indexOf('.') == -1) continue;
			}

			if (falsePositives.includes(key)) continue;

			let value = i18n._findInObject(key, i18n.locales.en);
			if (value === '') console.log(`missing '${key}'`);
		}
	});
}
