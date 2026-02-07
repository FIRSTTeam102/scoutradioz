import type { AbsoluteValueOperation, CompareOperation, DerivedLayout, DerivedLayoutLegacy, DivideOperation, LayoutEdit, LogOperation, MinMaxOperation, MultiplyOperation, MultiselectItem, MultiselectOperation, operand, SumOperation } from 'scoutradioz-types';

import type { editor, MonacoEditor } from 'monaco-types';

declare const monaco: MonacoEditor;
declare const loadedJSONLayout: string; // from pug
declare const loadedSprLayout: string; // from pug
declare const year: string;
declare const form_type: string;

const jsonfield = document.getElementById('jsonfield') as HTMLDivElement | undefined;
const sprfield = document.getElementById('sprfield') as HTMLDivElement | undefined;
const jsonfieldMobile = document.getElementById('jsonfield-mobile') as HTMLTextAreaElement | undefined;
// 2025-01-31, M.O'C: Adding in "mobile-only" SPR field
const sprfieldMobile = document.getElementById('sprfield-mobile') as HTMLTextAreaElement | undefined;
let monacoEditorLayout: editor.IStandaloneCodeEditor;
let monacoEditorSPR: editor.IStandaloneCodeEditor;

const pigrammerSchema = {
	'$schema': 'https://json-schema.org/draft/2020-12/schema',
	'$id': 'https://scoutradioz.com/public/form.schema.json',
	title: 'Form',
	description: 'A form for collecting scouting data',
	type: 'array',
	items: {
		oneOf: [
			{
				type: 'object',
				properties: {
					type: {
						const: 'spacer'
					}
				},
				required: ['type'],
				additionalProperties: false,
				description: 'test test'
			},
			{
				type: 'object',
				properties: {
					type: {
						enum: ['header', 'subheader']
					},
					label: {
						type: 'string'
					},
					id: {
						type: 'string'
					}
				},
				required: ['type', 'label'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'image'
					},
					image_id: {
						type: 'string'
					}
				},
				required: ['type', 'image_id'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'slider'
					},
					variant: {
						enum: ['standard', 'time']
					},
					label: {
						type: 'string'
					},
					id: {
						type: 'string'
					},
					options: {
						type: 'object',
						properties: {
							min: {
								type: 'number'
							},
							max: {
								type: 'number'
							},
							step: {
								type: 'number'
							}
						}
					}
				},
				required: ['type', 'variant', 'label', 'id', 'options'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'multiselect'
					},
					label: {
						type: 'string'
					},
					id: {
						type: 'string'
					},
					options: {
						type: 'array',
						items: {
							type: 'string'
						}
					}
				},
				required: ['type', 'label', 'id', 'options'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'derived'
					},
					id: {
						type: 'string'
					},
					display_as: {
						enum: ['number', 'percentage']
					},
					operations: {
						type: 'array',
						items: {}
					}
				},
				required: ['type', 'id', 'operations'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'derived'
					},
					id: {
						type: 'string'
					},
					display_as: {
						enum: ['number', 'percentage']
					},
					formula: {
						type: 'string'
					}
				},
				required: ['type', 'id', 'formula'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'counter'
					},
					allow_negative: {
						type: 'boolean'
					},
					label: {
						type: 'string'
					},
					id: {
						type: 'string'
					},
					variant: {
						enum: ['standard', 'bad']
					}
				},
				required: ['type', 'allow_negative', 'label', 'id', 'variant'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						enum: ['checkbox', 'textblock']
					},
					label: {
						type: 'string'
					},
					id: {
						type: 'string'
					}
				},
				required: ['type', 'label', 'id'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'import'
					},
					data_fields: {
						type: 'array',
						items: {}
					}
				}
			}
		]
	}
};

// if not on mobile, create monaco editor
if (jsonfield && 'monaco' in globalThis) {
	if (jsonfield) {
		let modelUri = monaco.Uri.parse('a://b/foo.json'); // a made up unique URI for our model
		let model = monaco.editor.createModel(loadedJSONLayout, 'json', modelUri);

		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			schemas: [
				{
					uri: 'https://scoutradioz.com/public/form.schema.json',
					fileMatch: [modelUri.toString()],
					schema: pigrammerSchema,
				}
			]
		});

		monacoEditorLayout = monaco.editor.create(jsonfield, {
		// value: loadedJSONLayout,
			model,
			language: 'json',
			theme: 'vs-dark',
			automaticLayout: true,
		});
	}
}
if (sprfield && 'monaco' in globalThis) {
	monacoEditorSPR = monaco.editor.create(sprfield, {
		value: loadedSprLayout,
		language: 'json',
		theme: 'vs-dark',
		automaticLayout: true,
	});
}
// if on mobile, fill the basic textfield with our data
if (jsonfieldMobile) {
	jsonfieldMobile.value = loadedJSONLayout;
}

// 2025-01-31, M.O'C: Adding in "mobile-only" SPR field
if (sprfieldMobile) {
	sprfieldMobile.value = loadedSprLayout;
}

// Get and set editor text, depending on whether we are on mobile or desktop
function getEditorText() {
	if (monacoEditorLayout) return monacoEditorLayout.getValue();
	if (jsonfieldMobile) return jsonfieldMobile.value;
	throw new Error('neither monacoEditor or jsonFieldMobile defined');
}

function setEditorText(text: string) {
	if (monacoEditorLayout) return monacoEditorLayout.setValue(text);
	if (jsonfieldMobile) return jsonfieldMobile.value = text;
	throw new Error('neither monacoEditor or jsonFieldMobile defined');
}

// 2025-01-31, M.O'C: Adding in "mobile-only" SPR field
function getSprText() {
	if (form_type == 'matchscouting') {
		if (monacoEditorSPR) return monacoEditorSPR.getValue();
		if (sprfieldMobile) return sprfieldMobile.value;
		throw new Error('sprfieldMobile not defined');
	}
	return '';
}
function setSprText(text: string) {
	if (monacoEditorSPR) return monacoEditorSPR.setValue(text);
	if (sprfieldMobile) return sprfieldMobile.value = text;
	// error not thrown because sprfield/monacoEditorSPR won't be defined if form type is pitscouting
}

function getJSON() {
	const jsonString = getEditorText();
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

// 2025-01-31, M.O'C: Adding in "mobile-only" SPR field
function getSprJSON() {
	if (form_type == 'matchscouting') {
		const sprString = getSprText();
		try {
			// validate it's valid json
			let parsed = JSON.parse(sprString);
			// return version of json without spaces and newlines
			return JSON.stringify(parsed);
		}
		catch (err) {
			throw onError('Invalid SPR JSON');
		}
	}
	else return {};
}

function onError(err: string | Error) {
	NotificationCard.error(String(err), { ttl: 0, exitable: true });
}

async function test() {
	let jsonString = getJSON();
	let sprString = getSprJSON();
	// Submit for server-side validation (temporary, until [if] we can get client side validation for this)
	$.post('/manage/config/submitform', {
		jsonString,
		sprString,
		year,
		form_type,
		save: 'false',
	}).done((response) => {
		console.log('success');

		// Success; update editor content with processed layout and display warnings
		let { warnings, layout, sprLayout, } = response;

		if (Array.isArray(warnings) && Array.isArray(layout)) {
			if (warnings.length > 0) {
				let warningsStr = warnings.join('\n').replace(/\*/g, '\\*'); // JL note: asterisks are in the derived metric suggestion, escaping the asterisks to avoid NotificationCard showing it as bold
				NotificationCard.warn(`Passed validation with warnings:\n${warningsStr}`, { ttl: 0, exitable: true });
			}
			// Set editor to modified json layout
			setEditorText(JSON.stringify(layout, null, 2));
			// 2025-02-01, M.O'C: Adding in SPR field
			setSprText(JSON.stringify(sprLayout, null, 2));

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
	let jsonString = getJSON();
	let sprString = getSprJSON();

	$.post('/manage/config/submitform', {
		jsonString,
		sprString,
		year,
		form_type,
		save: 'true',
	}).done((response) => {
		console.log('success');

		// Success; update editor content with processed layout and display warnings
		let { warnings, layout, sprLayout, saved } = response;
		// sanity check
		if (!saved) {
			throw NotificationCard.error('Server failed to save layout!');
		}
		if (Array.isArray(warnings) && Array.isArray(layout)) {
			if (warnings.length > 0) {
				let warningsStr = warnings.join('\n').replace(/\*/g, '\\*'); // JL note: asterisks are in the derived metric suggestion, escaping the asterisks to avoid NotificationCard showing it as bold
				NotificationCard.warn(`Submitted successfully with warnings:\n${warningsStr}`, { ttl: 0, exitable: true });
			}
			else {
				NotificationCard.good('Validated and submitted successfully');
			}
			setEditorText(JSON.stringify(layout, null, 2));
			// 2025-02-01, M.O'C: Adding in SPR field
			setSprText(JSON.stringify(sprLayout, null, 2));
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
