import type { LayoutEdit, StringDict } from 'scoutradioz-types';
// consolesdflkjd
function validate() {
	// get the JSON from the form
	const jsonFieldElem = document.getElementById('jsonfield') as HTMLInputElement;
	let jsonText = jsonFieldElem.value;

	const previousKeysElem = document.getElementById('previousKeys') as HTMLInputElement;
	let previousKeys = JSON.parse(previousKeysElem.value);
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
		NotificationCard.error('Invalid JSON! Please correct.');
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
		if (!idDict['otherNotes'])
			NotificationCard.warn('WARNING! You have not defined \'otherNotes\'');
		if (!idDict['contributedPoints'])
			NotificationCard.warn('WARNING! You have not defined \'contributedPoints\'');
	}

	// check if any existing data fields are not included
	// TODO enable for Pit Scouting (will need changes in orgconfig.ts as well)
	if (formType == 'matchscouting') {
		for (let j = 0; j < previousKeys.length; j++) {
			console.log(j + ' ' + previousKeys[j]);
			if (!idDict[previousKeys[j]]) {
				NotificationCard.warn('WARNING! JSON is missing existing data key ' + previousKeys[j]);
				//return null;
			}
		}
	}

	// verify keys are all 'allowed'
	// TODO

	return jsonString;
}

function test() {
	let jsonString = validate();
	if (jsonString == null)
		return;

	// submit the form
	const testDataElem = document.getElementById('testData') as HTMLInputElement;
	testDataElem.value = jsonString;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	tdocument.forms.testForm.submit();
}

function submit() {
	let jsonString = validate();
	if (jsonString == null)
		return;

	// submit the form
	const jsonDataElem = document.getElementById('jsonData') as HTMLInputElement;
	jsonDataElem.value = jsonString;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	document.forms.submitForm.submit();
}
