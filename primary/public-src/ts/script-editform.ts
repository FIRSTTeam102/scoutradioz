import type { AbsoluteValueOperation, CompareOperation, DivideOperation, LogOperation, MinMaxOperation, MultiplyOperation, MultiselectOperation, operand, SumOperation } from 'scoutradioz-types';

type LayoutEdit = import('scoutradioz-types').LayoutEdit;
type StringDict = import('scoutradioz-types').StringDict;
type DerivedLayout = import('scoutradioz-types').DerivedLayout;

// consolesdflkjd
async function validate() {
	// get the JSON from the form
	const jsonFieldElem = document.getElementById('jsonfield') as HTMLInputElement;
	let jsonText = jsonFieldElem.value;

	const previousKeysElem = document.getElementById('previousKeys') as HTMLInputElement;
	let previousKeys = JSON.parse(previousKeysElem.value);
	lightAssert(Array.isArray(previousKeys), 'previousKeys is not an array');
	//console.log("previousKeys.length=" + previousKeys.length);

	const formTypeElem = document.getElementById('form_type') as HTMLInputElement;
	let formType = formTypeElem.value;
	console.log('formType=' + formType);

	// parse to JSON (or fail out with an error)
	let jsonData: LayoutEdit[] = [];
	try {
		jsonData = JSON.parse(jsonText);
	}
	catch (error) {
		if (error instanceof SyntaxError) {
			NotificationCard.error(`Invalid JSON! Please correct. \n${error}`, { ttl: 0, exitable: true });
		}
		else {
			NotificationCard.error('Invalid JSON! Please correct.');
		}
		return null;
	}

	// make sure 'order' and 'id' are unique; also clear out extraneous stuff
	let idDict: StringDict = {};
	let idCount = 0;
	for (let i = 0; i < jsonData.length; i++) {
		// since jsonData gets loaded back to the user, remove backend keys
		delete jsonData[i]['_id'];
		delete jsonData[i]['form_type'];
		delete jsonData[i]['org_key'];
		delete jsonData[i]['year'];
		delete jsonData[i]['order'];

		let thisType = jsonData[i]['type'];
		if (thisType == null) {
			console.log('Missing type:', jsonData[i]);
			NotificationCard.error('Missing at least one \'type\' attribute! Please correct.');
			return null;
		}

		if (thisType != 'spacer') {
			let thisId = jsonData[i]['id'];
			if (thisId == null) {
				console.log('Missing id:', jsonData[i]);
				NotificationCard.error('Missing at least one \'id\' attribute! Please correct.');
				return null;
			}
			idCount++;
			if (idDict[thisId]) {
				console.warn('Duplicate ID?', thisId);
			}
			idDict[thisId] = thisId;
		}
	}

	if (Object.keys(idDict).length != idCount) {
		console.log('Keys:', Object.keys(idDict));
		console.log(`Count: ${idCount}`);
		NotificationCard.error('At least one duplicate \'id\' value! Please correct.');
		return null;
	}
	let jsonString = JSON.stringify(jsonData);
	console.log('jsonData=' + jsonString);

	// make sure required fields exist - otherNotes, contributedPoints [for matchScouting only]
	if (formType == 'matchscouting') {
		let otherNotes = idDict['otherNotes'];
		let contributedPoints = idDict['contributedPoints'];
		if (!otherNotes || !contributedPoints) {
			let message = '*WARNING!* You have not defined the following required fields: ';
			if (!otherNotes) message += '\n - otherNotes';
			if (!contributedPoints) message += '\n - contributedPoints';
			let { cancelled } = await Confirm.show(message, { yesText: 'OK' });
			if (cancelled) return null;
		}
	}

	// Validate derived metrics
	const derivedLayouts = jsonData.filter(itm => itm.type === 'derived') as DerivedLayout[];
	for (let derived of derivedLayouts) {
		// For error messages
		let derivedDescription = ` - for Derived Metric with id=${derived.id} and label=${derived.label}`;
		lightAssert(Array.isArray(derived.operations), `Derived metric does not have an array of operations ${derivedDescription}`);
		let finalOperation = derived.operations[derived.operations.length - 1];
		lightAssert(!finalOperation.hasOwnProperty('as'), `The final derived operation must not have an 'as' keyword ${derivedDescription}`);
		// Go through the list of operations one by one, validating the variables each step
		let intermediateVariables: string[] = [];

		const isValidOperand = (operand: operand) => {
			// Ensure the variable reference is valid
			if (typeof operand === 'string') {
				if (operand.startsWith('$')) {
					return intermediateVariables.includes(operand);
				}
				else {
					return !!idDict[operand];
				}
			}
			// just validate that the other operand is a number
			else {
				return typeof operand === 'number';
			}
		};

		derived.operations.forEach((thisOp, i) => {
			// JL: I don't like copy-pasted strings, so using a function for the different cases to validate whatever # of operands need to be validated
			const validateOperands = (operandList: operand[]) => {
				operandList.forEach(operand => {
					lightAssert(isValidOperand(operand), `Operation #${i}, ${thisOp.operator}, has an invalid operand "${operand}" ${derivedDescription}`);
				});
			};

			// Handle different operation types
			switch (thisOp.operator) {
				case 'multiselect': {
					let op = thisOp as MultiselectOperation;
					// Ensure the variable reference is valid
					let thisMultiselectLayout = jsonData.find(item => item.id === op.id && item.type === 'multiselect');
					lightAssert(thisMultiselectLayout, `Multiselect derived operation has an invalid id. Make sure it references either a variable earlier in the operand chain or the id of a non-derived metric. Invalid value=${op.id}, derived ${derivedDescription}`);
					let thisMultiselectOpts = thisMultiselectLayout?.options;
					lightAssert(Array.isArray(thisMultiselectOpts), `Multiselect with id ${thisMultiselectLayout.id} options is not an array`);
					// Ensure the quantifiers are valid for the multiselect
					for (let opt of thisMultiselectOpts) {
						lightAssert(op.quantifiers.hasOwnProperty(opt), `Operation #${i}, multiselect, does not have a quantifier for the string ${opt} ${derivedDescription}`);
					}
					for (let varName in op.quantifiers) {
						lightAssert(thisMultiselectOpts.includes(varName), `Operation #${i}, multiselect, has a quantifier for the string ${varName}, but that string is not an option for the multiselect ${derivedDescription}`);
						// Also, check that the quantifier is a number
						lightAssert(typeof op.quantifiers[varName] === 'number', `Operation #${i}, multiselect, has a non-number quantifier "${op.quantifiers[varName]}" for the string ${varName} ${derivedDescription}`);
					}
					break;
				}
				// Operations that take 2 operands
				case 'subtract': case 'divide': case 'gt': case 'gte': case 'lt': case 'lte': case 'eq': case 'ne': case 'min': case 'max': {
					let op = thisOp as | DivideOperation | CompareOperation | MinMaxOperation;
					lightAssert(op.operands.length === 2, `Operation #${i}, ${op.operator}, needs exactly 2 operands ${derivedDescription}`);
					validateOperands(op.operands);
					break;
				}
				// Operations that take N operands
				case 'add': case 'sum': case 'multiply': {
					let op = thisOp as SumOperation | MultiplyOperation;
					validateOperands(op.operands);
					break;
				}
				// 1 operand
				case 'abs': {
					let op = thisOp as AbsoluteValueOperation;
					lightAssert(op.operands.length === 1, `Operation #${i}, ${op.operator}, needs exactly 1 operand ${derivedDescription}`);
					validateOperands(op.operands);
					break;
				}
				// 1 operand then 1 number
				case 'log': {
					let op = thisOp as LogOperation;
					lightAssert(op.operands.length === 2, `Operation #${i}, ${op.operator}, needs exactly 2 operands ${derivedDescription}`);
					validateOperands([op.operands[0]]);
					lightAssert(typeof op.operands[1] === 'number', `Operation #${i}, ${op.operator}, needs its second operand to be a number but found "${op.operands[1]}" ${derivedDescription}`);
				}
			}
			// Add the output of this operation to the list of intermediate variables
			if (i < derived.operations.length - 1) {
				let thisOpAs = thisOp.as;
				lightAssert(thisOpAs, `Operation #${i}, ${thisOp.operator} does not have an 'as' keyword ${derivedDescription}`);
				intermediateVariables.push('$' + thisOpAs);
			}
		});
	}

	// verify keys are all 'allowed'
	// TODO


	// check if any existing data fields are not included
	// TODO enable for Pit Scouting (will need changes in orgconfig.ts as well)
	let missingDataKeys = previousKeys.filter((key) => !idDict[key]);
	if (missingDataKeys.length > 0) {
		let message = `*WARNING!* The following keys (ids) exist in your past match scouting data, but are not included in this layout: \n${missingDataKeys.map(key => `\n - ${key}`)}`;
		let { cancelled } = await Confirm.show(message, { yesText: 'OK', noText: 'Cancel' });
		if (cancelled) return null;
	}
	return jsonString;
}

async function test() {
	let jsonString = await validate();
	if (jsonString == null)
		return;

	// submit the form
	const testDataElem = document.getElementById('testData') as HTMLInputElement;
	testDataElem.value = jsonString;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	document.forms.testForm.submit();
}

async function submit() {
	let jsonString = await validate();
	if (jsonString == null)
		return;

	// submit the form
	const jsonDataElem = document.getElementById('jsonData') as HTMLInputElement;
	jsonDataElem.value = jsonString;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	document.forms.submitForm.submit();
}

$(() => {
	$('#testBtn').on('click', test);
	$('#submitBtn').on('click', submit);
	$('#validateBtn').on('click', validate);
});
