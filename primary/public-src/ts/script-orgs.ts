$(() => {
	$('[classname-caret]').on('click', onClassCaretClick);
	$('[subteam-caret]').on('click', onSubteamCaretClick);
	
	$('#createOrg').on('click', (e) => {
		e.preventDefault();
		let form = new FormSubmission($('#createOrgForm'), '/admin/orgs/create', 'createOrg', {autoRetry: false});
		form.submit((err, response) => {
			if (!response) {
				NotificationCard.error('Error: Check the console');
				console.error(err);
			}
			else if (response.status === 200) {
				// On success, 
				NotificationCard.good(response.message);
				setTimeout(() => {
					location.reload();
				}, 1000);
			}
			else {
				NotificationCard.error(response.message);
			}
		});
	});
});

async function deleteOrg(key: string) {
	const result = await PasswordPrompt.show('*DANGER ZONE!!!* Deleting this org will also delete ALL OF ITS USERS.\nIf you are SURE you want to proceed, type your password.');
	if (result.cancelled === false) {
		$.post('/admin/orgs/delete', {password: result.password, org_key: key})
			.done(result => {
				if (result.status === 200) {
					NotificationCard.good(result.message);
					setTimeout(() => {
						location.reload();
					}, 1000);
				}
				else {
					NotificationCard.error(result.message);
				}
			});
	}
}

// Log in to an org's "scoutradioz_admin" user, similar to "sudo su <user>"
async function loginToOrg(key: string) {
	const result = await Prompt.show([
		{
			type: 'label',
			value: `To log into the org ${key}, enter your password.`
		},
		{
			type: 'label',
			value: 'If you are currently logged in as a "real" Scoutradioz Admin user, you just need to enter your password.\nIf you are currently logged in as _scoutradioz\\_admin_, then enter the org\\_key, username, *and* password of your account.'
		},
		{
			type: 'textinput',
			value: 'Org Key (if logged in as scoutradioz_admin)'
		},
		{
			type: 'textinput',
			value: 'Username (if logged in as scoutradioz_admin)'
		},
		{
			type: 'label',
			value: 'Password:'
		},
		{
			type: 'password',
			value: '',
			default: true,
		}
	], twoPromptButtons('OK', 'Cancel'));
	// Prompt for user's password
	// const result = await PasswordPrompt.show(`To log into the org ${key}, enter your password. You must be logged in as a "real" Scoutradioz Admin user, with an actual password, to do this.`);
	if (result.cancelled === false) {
		console.log(result);
		let user_org_key = result.data[0].value;
		let username = result.data[1].value;
		let password = result.data[2].value;
		
		// Send a POST request with their password & the specified org key
		$.post('/admin/orgs/login-to-org', {user_org_key, username, password, org_key: key})
			.done(result => {
				// If the status sent back is 200, that means they've successfully logged in as scoutradioz_admin
				if (result.status === 200) {
					location.href = '/home';
				}
				else {
					NotificationCard.error(result.message);
				}
			});
	}
}

function onClassCaretClick(this: HTMLElement, e: Event) {
	if (!e.target) return;
	let elem = $(this);
	let thisParent = elem.parent();
	let aboveParent = thisParent.prev();
	if (aboveParent.length === 0) return console.log('Top class in the list; not doing anything');
	
	let thisIdxStr = (thisParent.attr('id')?.split('_')[1]);
	if (!thisIdxStr) return console.log('Index not defined');
	let thisIdx = parseInt(thisIdxStr);
	let aboveIdx = thisIdx - 1;
	
	// Get the elements for this row & above row
	let thisLabel = thisParent.find(`input[name=classes_${thisIdx}_label]`);
	let thisKey = thisParent.find(`input[name=classes_${thisIdx}_classkey]`);
	let thisSeniority = thisParent.find(`input[name=classes_${thisIdx}_seniority]`);
	let thisYouth = thisParent.find(`select[name=classes_${thisIdx}_youth]`);
	
	let aboveLabel = aboveParent.find(`input[name=classes_${aboveIdx}_label]`);
	let aboveKey = aboveParent.find(`input[name=classes_${aboveIdx}_classkey]`);
	let aboveSeniority = aboveParent.find(`input[name=classes_${aboveIdx}_seniority]`);
	let aboveYouth = aboveParent.find(`select[name=classes_${aboveIdx}_youth]`);
	
	// Cache the values of one of them
	let thisLabelVal = thisLabel.val() || '';
	let thisKeyVal = thisKey.val() || '';
	let thisSeniorityVal = thisSeniority.val() || '';
	let thisYouthVal = thisYouth.val() || '';
	
	// Now, swap them
	thisLabel.val(aboveLabel.val() || '');
	thisKey.val(aboveKey.val() || '');
	thisSeniority.val(aboveSeniority.val() || '');
	thisYouth.val(aboveYouth.val() || '');
	
	aboveLabel.val(thisLabelVal);
	aboveKey.val(thisKeyVal);
	aboveSeniority.val(thisSeniorityVal);
	aboveYouth.val(thisYouthVal);
}

function onSubteamCaretClick(this: HTMLElement, e: Event) {
	if (!e.target) return;
	let elem = $(this);
	let thisParent = elem.parent();
	let aboveParent = thisParent.prev();
	if (aboveParent.length === 0) return console.log('Top class in the list; not doing anything');
	
	let thisIdxStr = (thisParent.attr('id')?.split('_')[1]);
	if (!thisIdxStr) return console.log('Index not defined');
	let thisIdx = parseInt(thisIdxStr);
	let aboveIdx = thisIdx - 1;
	
	console.log('sdffdsfds');
	
	// Get the elements for this row & above row
	let thisLabel = thisParent.find(`input[name=subteams_${thisIdx}_label]`);
	let thisKey = thisParent.find(`input[name=subteams_${thisIdx}_subteamkey]`);
	let thisPitscout = thisParent.find(`select[name=subteams_${thisIdx}_pitscout]`);
	
	let aboveLabel = aboveParent.find(`input[name=subteams_${aboveIdx}_label]`);
	let aboveKey = aboveParent.find(`input[name=subteams_${aboveIdx}_subteamkey]`);
	let abovePitscout = aboveParent.find(`select[name=subteams_${aboveIdx}_pitscout]`);
	
	// Cache the values of one of them
	let thisLabelVal = thisLabel.val() || '';
	let thisKeyVal = thisKey.val() || '';
	let thisPitscoutVal = thisPitscout.val() || '';
	
	thisLabel.val(aboveLabel.val() || '');
	thisKey.val(aboveKey.val() || '');
	thisPitscout.val(abovePitscout.val() || '');
	
	aboveLabel.val(thisLabelVal);
	aboveKey.val(thisKeyVal);
	abovePitscout.val(thisPitscoutVal);
}

function addClass(orgKey: string) {
	//Find out what to name this index
	let i;
	for (i = 0; i < 100; i++) {
		if ($(`#classes_${orgKey} #classname_${i}`).length == 0) {
			break;
		}
	}
	let newIdx = i;
	
	let newClass = $('#classTemplate')
		.children()
		.clone();
	newClass.attr('id', `classname_${newIdx}`)
		.appendTo(`#classes_${orgKey}`)
		.find('[classname-caret]')
		.on('click', onClassCaretClick);
	
	newClass.find('input[name=classes_num_label]').attr('name', `classes_${newIdx}_label`);
	newClass.find('input[name=classes_num_classkey]').attr('name', `classes_${newIdx}_classkey`);
	newClass.find('input[name=classes_num_seniority]').attr('name', `classes_${newIdx}_seniority`);
	newClass.find('select[name=classes_num_youth]').attr('name', `classes_${newIdx}_youth`);
}
function deleteClass(orgKey: string) {
	//find lastmost class
	let i;
	for (i = 0; i < 100; i++) {
		if ($(`#classes_${orgKey} #classname_${i}`).length == 0) {
			break;
		}
	}
	let lastIdx = i - 1;
	
	$(`#classes_${orgKey} #classname_${lastIdx}`).remove();
}
function addSubteam(orgKey: string) {
	//Find out what to name this index
	let i;
	for (i = 0; i < 100; i++) {
		if ($(`#subteams_${orgKey} #subteam_${i}`).length == 0) {
			break;
		}
	}
	let newIdx = i;
	
	let newClass = $('#subteamTemplate')
		.children()
		.clone();
	newClass.attr('id', `subteam_${newIdx}`)
		.appendTo(`#subteams_${orgKey}`)
		.find('[classname-caret]')
		.on('click', onSubteamCaretClick);
	$('input[name=subteams_num_label]').attr('name', `subteams_${newIdx}_label`);
	$('input[name=subteams_num_subteamkey]').attr('name', `subteams_${newIdx}_subteamkey`);
	$('input[name=subteams_num_pitscout]').attr('name', `subteams_${newIdx}_pitscout`);
}
function deleteSubteam(orgKey: string) {
	//find lastmost subteam
	let i;
	for (i = 0; i < 100; i++) {
		if ($(`#subteams_${orgKey} #subteam_${i}`).length == 0) {
			break;
		}
	}
	let lastIdx = i - 1;
	
	$(`#subteams_${orgKey} #subteam_${lastIdx}`).remove();
}