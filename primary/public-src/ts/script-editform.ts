import type { AbsoluteValueOperation, CompareOperation, DerivedLayout, DerivedLayoutLegacy, DivideOperation, LayoutEdit, LogOperation, MinMaxOperation, MultiplyOperation, MultiselectItem, MultiselectOperation, operand, SumOperation } from 'scoutradioz-types';

import type { editor, MonacoEditor } from 'monaco-types';

declare const monaco: MonacoEditor;
declare const loadedJSONLayout: string; // from pug
declare const year: string;
declare const form_type: string;

const jsonfield = document.getElementById('jsonfield') as HTMLDivElement | undefined;
const jsonfieldMobile = document.getElementById('jsonfield-mobile') as HTMLTextAreaElement | undefined;
let monacoEditor: editor.IStandaloneCodeEditor;

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
				required: ['type', 'label', 'id', 'operations'],
				additionalProperties: false
			},
			{
				type: 'object',
				properties: {
					type: {
						const: 'derived'
					},
					label: {
						type: 'string'
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
				required: ['type', 'id', 'label', 'formula'],
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
			}
		]
	}
};

// if not on mobile, create monaco editor
if (jsonfield && monaco) {
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

	monacoEditor = monaco.editor.create(jsonfield, {
		// value: loadedJSONLayout,
		model,
		language: 'json',
		theme: 'vs-dark',
		automaticLayout: true,
	});
}
// if on mobile, fill the basic textfield with our data
if (jsonfieldMobile) {
	jsonfieldMobile.value = loadedJSONLayout;
}

// Get and set editor text, depending on whether we are on mobile or desktop
function getEditorText() {
	if (monacoEditor) return monacoEditor.getValue();
	if (jsonfieldMobile) return jsonfieldMobile.value;
	throw new Error('neither monacoEditor or jsonFieldMobile defined');
}

function setEditorText(text: string) {
	if (monacoEditor) return monacoEditor.setValue(text);
	if (jsonfieldMobile) return jsonfieldMobile.value = text;
	throw new Error('neither monacoEditor or jsonFieldMobile defined');
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

function onError(err: string | Error) {
	NotificationCard.error(String(err), { ttl: 0, exitable: true });
}

async function test() {
	let jsonString = getJSON();
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
				let warningsStr = warnings.join('\n').replace(/\*/g, '\\*'); // JL note: asterisks are in the derived metric suggestion, escaping the asterisks to avoid NotificationCard showing it as bold
				NotificationCard.warn(`Passed validation with warnings:\n${warningsStr}`, { ttl: 0, exitable: true });
			}
			// Set editor to modified json layout
			setEditorText(JSON.stringify(layout, null, 2));

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
				let warningsStr = warnings.join('\n').replace(/\*/g, '\\*'); // JL note: asterisks are in the derived metric suggestion, escaping the asterisks to avoid NotificationCard showing it as bold
				NotificationCard.warn(`Submitted successfully with warnings:\n${warningsStr}`, { ttl: 0, exitable: true });
			}
			else {
				NotificationCard.good('Validated and submitted successfully');
			}
			setEditorText(JSON.stringify(layout, null, 2));
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
