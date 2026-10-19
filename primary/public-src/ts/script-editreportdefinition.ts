import type { AbsoluteValueOperation, CompareOperation, DerivedLayout, DerivedLayoutLegacy, DivideOperation, LayoutEdit, LogOperation, MinMaxOperation, MultiplyOperation, MultiselectItem, MultiselectOperation, operand, SumOperation } from 'scoutradioz-types';

import type { editor, MonacoEditor } from 'monaco-types';

declare const monaco: MonacoEditor;
declare const loadedJSONLayout: string; // from pug
declare const year: string;
declare const form_type: string;

const jsonfield = document.getElementById('jsonfield') as HTMLDivElement | undefined;
const jsonfieldMobile = document.getElementById('jsonfield-mobile') as HTMLTextAreaElement | undefined;
let monacoEditorLayout: editor.IStandaloneCodeEditor;

const reportSchema = {
	'$schema': 'https://json-schema.org/draft/2020-12/schema',
	'$id': 'https://scoutradioz.com/public/report.schema.json',
	title: 'Reports',
	description: 'A schema for reporting on scouting data',
	type: 'object',
	properties: {
		allTeamsCharts: {
			oneOf: [
				{
					type: 'object',
					properties: {
						type: {
							const: 'stackedBarOfAggregations'
						},
						metrics: {
							type: 'array',
							items: {
								type: 'string'
							}
						}
					},
					required: ['type', 'metrics'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'heatMapOfAllAggregations'
						},
						xaxis: {
							type: 'string'
						},
						yaxis: {
							type: 'string'
						},
						size: {
							type: 'string'
						},
						color: {
							type: 'string'
						},
					},
					required: ['type', 'xaxis', 'yaxis'],
					additionalProperties: false
				},
			],
		},
		teamIntelCharts: {
			oneOf: [
				{
					type: 'object',
					properties: {
						type: {
							const: 'heatMapOfAllAggregations'
						},
					},
					required: ['type'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'lineChartOfMatches'
						},
						metrics: {
							type: 'array',
							items: {
								type: 'string'
							}
						}
					},
					required: ['type', 'metrics'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'stackedBarOfMatches'
						},
						metrics: {
							type: 'array',
							items: {
								type: 'string'
							}
						}
					},
					required: ['type', 'metrics'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'bubbleOfMatches'
						},
						xaxis: {
							type: 'string'
						},
						yaxis: {
							type: 'string'
						},
						size: {
							type: 'string'
						},
						color: {
							type: 'string'
						},
					},
					required: ['type', 'xaxis', 'yaxis'],
					additionalProperties: false
				},
			],
		},
		driveTeamDashboardCharts: {
			oneOf: [
				{
					type: 'object',
					properties: {
						type: {
							const: 'radarOfAggregations'
						},
					},
					required: ['type'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'heatMapOfAggregations'
						},
					},
					required: ['type'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'lineChartOfMatches'
						},
						metrics: {
							type: 'array',
							items: {
								type: 'string'
							}
						}
					},
					required: ['type', 'metrics'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'stackedBarOfAggregations'
						},
						metrics: {
							type: 'array',
							items: {
								type: 'string'
							}
						}
					},
					required: ['type', 'metrics'],
					additionalProperties: false
				},
				{
					type: 'object',
					properties: {
						type: {
							const: 'bubbleOfAggregations'
						},
						xaxis: {
							type: 'string'
						},
						yaxis: {
							type: 'string'
						},
						size: {
							type: 'string'
						},
						color: {
							type: 'string'
						},
					},
					required: ['type', 'xaxis', 'yaxis'],
					additionalProperties: false
				}
			]
		}
	}
};

// if not on mobile, create monaco editor
if (jsonfield && 'monaco' in globalThis) {
	if (jsonfield) {
		let modelUri = monaco.Uri.parse('a://c/foo.json'); // a made up unique URI for our model
		let model = monaco.editor.createModel(loadedJSONLayout, 'json', modelUri);

		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			schemas: [
				{
					uri: 'https://scoutradioz.com/public/report.schema.json',
					fileMatch: [modelUri.toString()],
					schema: reportSchema,
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
// if on mobile, fill the basic textfield with our data
if (jsonfieldMobile) {
	jsonfieldMobile.value = loadedJSONLayout;
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

function getJSON() {
	const jsonString = getEditorText();
	try {
		// validate it's valid json
		let parsed = JSON.parse(jsonString);
		// return version of json without spaces and newlines
		return JSON.stringify(parsed);
	}
	catch (err) {
		if (err instanceof Error) {
			throw onError(`Invalid JSON ${err.name}: ${err.message}`);
		}
		else {
			throw onError('Invalid JSON');
		}
	}
}

function onError(err: string | Error) {
	NotificationCard.error(String(err), { ttl: 0, exitable: true });
}

async function test() {
	let jsonString = getJSON();
	// Submit for server-side validation (temporary, until [if] we can get client side validation for this)
	$.post('/manage/config/submitreportdefinition', {
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

			// // Finally, submit to testform
			// fetch('/scouting/testform', {
			// 	method: 'POST',
			// 	headers: {
			// 		'Content-Type': 'application/json',
			// 		'in-modal-dialog': 'true',
			// 	},
			// 	body: JSON.stringify({
			// 		testData: JSON.stringify(layout),
			// 		form_type,
			// 		year,
			// 	})
			// })
			// 	.then(response => response.text())
			// 	.then(data => {
			// 		Dialog.show(data);
			// 	});
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

	$.post('/manage/config/submitreportdefinition', {
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
