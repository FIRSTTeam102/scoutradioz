import type { AbsoluteValueOperation, CompareOperation, DerivedLayout, DerivedLayoutLegacy, DivideOperation, LayoutEdit, LogOperation, MinMaxOperation, MultiplyOperation, MultiselectItem, MultiselectOperation, operand, SumOperation } from 'scoutradioz-types';

import type { MonacoEditor } from 'monaco-types';

declare const monaco: MonacoEditor;
declare const loadedJSONLayout: string; // from pug
declare const year: string;
declare const form_type: string;

const jsonfield = document.getElementById('jsonfield') as HTMLDivElement;
let editor = monaco.editor.create(jsonfield, {
	value: loadedJSONLayout,
	language: 'json',
	theme: 'vs-dark',
	automaticLayout: true,
});

async function validate() {
	const jsonString = editor.getValue();
	try {
		// validate it's valid json
		let parsed = JSON.parse(jsonString);
		// return version of json without spaces and newlines
		return JSON.stringify(parsed);
	}
	catch (err) {
		throw onError('Invalid JSON');
	}
}

function onError(err: string | Error) {
	NotificationCard.error(String(err), { ttl: 0, exitable: true });
}

async function test() {
	let jsonString = await validate();
	// Submit for server-side validation (temporary, until [if] we can get client side validation for this)
	$.post('/manage/config/submitform', {
		jsonString,
		year,
		form_type,
		save: 'false',
	}).done((response) => {
		console.log('success');

		// Success; update editor content with processed layout and display warnings
		let { warnings, layout, } = response;

		if (Array.isArray(warnings) && Array.isArray(layout)) {
			if (warnings.length > 0) {
				NotificationCard.warn(`Passed validation with warnings:\n${warnings.join('\n')}`, { ttl: 0, exitable: true });
			}
			// Set editor to modified json layout
			editor.setValue(JSON.stringify(layout, null, 2));

			// Finally, submit to testform
			fetch('/scouting/testform', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'in-modal-dialog': 'true',
				},
				body: JSON.stringify({
					testData: JSON.stringify(layout),
					form_type,
					year,
				})
			})
				.then(response => response.text())
				.then(data => {
					Dialog.show(data);
				});
		}

	}).fail((xhr, status, message) => {
		let errorHeader = xhr.getResponseHeader('Error-Message');
		if (errorHeader) {
			onError(errorHeader);
		}
		else {
			onError(message);
		}
	});

}

async function submit() {
	let jsonString = await validate();

	$.post('/manage/config/submitform', {
		jsonString,
		year,
		form_type,
		save: 'true',
	}).done((response) => {
		console.log('success');

		// Success; update editor content with processed layout and display warnings
		let { warnings, layout, saved } = response;
		// sanity check
		if (!saved) {
			throw NotificationCard.error('Server failed to save layout!');
		}
		if (Array.isArray(warnings) && Array.isArray(layout)) {
			if (warnings.length > 0) {
				NotificationCard.warn(`Submitted successfully with warnings:\n${warnings.join('\n')}`, { ttl: 0, exitable: true });
			}
			else {
				NotificationCard.good('Validated and submitted successfully');
			}
			editor.setValue(JSON.stringify(layout, null, 2));
		}
	}).fail((xhr, status, message) => {
		let errorHeader = xhr.getResponseHeader('Error-Message');
		if (errorHeader) {
			onError(errorHeader);
		}
		else {
			onError(message);
		}
	});
}

$(() => {
	$('#testBtn').on('click', test);
	$('#submitBtn').on('click', submit);
});
