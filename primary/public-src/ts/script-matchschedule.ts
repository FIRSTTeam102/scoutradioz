declare let currentTeams: number[];
declare let currentMatchRow: number;
declare const origEventDate: string;

let isCtrlCmdPressedDown = false;
//eventDate is a Date object, of the correct day but of 0 hours/minutes/seconds.
//Set at onChangeDateInput 
let eventDate: luxon.DateTime;

$(() => {
	//handlers for match input
	$('.RedTeam3').on('change', onChangeMatchInput);
	$('.TimeInput').on('keydown', onKeydownTimeInput);
	$('.DaySelector').on('change', onChangeMatchDayInput);
		
	//handlers for event date
	$('#EventDateYear').on('change', onChangeDateInput);
	$('#EventDateMonth').on('change', onChangeDateInput);
	$('#EventDateDay').on('change', onChangeDateInput);
	$('#EventDateWeekDay').on('change', onChangeDateInput);
	
	let date = luxon.DateTime.fromFormat(origEventDate, 'yyyy-MM-dd');
	$('#EventDateMonth').val(date.month); 
	$('#EventDateDay').val(date.day); 
	$('#EventDateYear').val(date.year);
	
	// parse date at page load
	onChangeDateInput();
	
	let selectors = $('.DaySelector');
	
	for (let sel of selectors) {
		let thisMatchTimeStr = sel.getAttribute('data-time');
		assert(!!thisMatchTimeStr);
		let thisMatchTime = parseInt(thisMatchTimeStr); 
		if (!isNaN(thisMatchTime)) {
			let date = luxon.DateTime.fromMillis(thisMatchTime);
			let thisYearMonthDay = `${date.year}-${date.month}-${date.day}`;
			let thisOption = sel.querySelector(`[year-month-day="${thisYearMonthDay}"]`);
			if (!thisOption) {
				console.log(`Could not find option! matchTime=${thisMatchTime}`);
				continue;
			}
			let thisVal = thisOption.getAttribute('value');
			assert(thisVal);
			$(sel).val(thisVal); // update the select
		}
	}
	
	// Before submit, validate and save times
	$('#submit').on('click', () => {
		
		for (let i = 1; i < currentMatchRow; i++) {
			let schedTime = String($(`input[name="SchedTimeInput_${i}"]`).val());
			let dayNumber = parseInt(String($(`select[name="DayNumber_${i}"]`).val()));
			
			if (schedTime) {
				// Check validity of time
				parseDateTime(dayNumber, schedTime, (err, newTime) => {
					lightAssert(newTime && !err, `Invalid time for match # ${i}!`);
					// Update sched time
					$(`input[name="SchedTime_${i}"]`).val(newTime.toMillis());
				});
				// Check that each input team is on the roster
				for (let str of ['BlueTeam1', 'BlueTeam2', 'BlueTeam3', 'RedTeam1', 'RedTeam2', 'RedTeam3']) {
					let thisTeamInput = $(`input[name="${str}_${i}"]`);
					assert(thisTeamInput.length > 0);
					
					let thisTeamNum = parseInt(String(thisTeamInput.val()));
					if (isNaN(thisTeamNum)) {
						NotificationCard.error('Enter a valid team number!');
						thisTeamInput.trigger('focus');
						return;
					}
					if (!currentTeams.includes(thisTeamNum)) {
						NotificationCard.error(`Team ${thisTeamNum} is not going to this event!`);
						thisTeamInput.trigger('focus');
						return;
					}
				}
			}
		}
		
		Confirm.show('Updating the match schedule will erase the match results (scores and ranking points) from the database. Scouting data will *not* be affected. Are you sure you want to proceed?')
			.then((data) => {
				if (data.cancelled === false) {
					$('#ManualInputMatchSchedule').trigger('submit');
				}
			});
	});
});

//Toggle isCtrlCmdPressedDown to disable parseDate when a ctrl command is sent
$(document).on('keydown', function(evt){
	//CHECK ON MAC ON FIREFOX (224), OPERA (17), CHROMIUM (91, 93)
	if(evt.keyCode == 17){
		isCtrlCmdPressedDown = true;
		console.log('Keydown: ctrlCmd set true'); 
	}
});
$(document).on('keyup', function(evt){
	if(evt.keyCode == 17){
		isCtrlCmdPressedDown = false;
		console.log('Keyup: ctrlCmd set false');
	}
});
		
function onChangeDateInput(){
	//var d = new Date(year, month, day, hours, minutes, seconds, milliseconds);
			
	let year = $('#EventDateYear').val();
	let month = $('#EventDateMonth').val();
	let day = $('#EventDateDay').val();
	assert(typeof year === 'string' && typeof month === 'string' && typeof day === 'string', 'Year, month, and day must be specified!');
	//set eventDate
	eventDate = luxon.DateTime.fromObject({year: parseInt(year), month: parseInt(month), day: parseInt(day)});
	// eventDate = luxon.DateTime.fromJSDate(new Date(parseInt(year), parseInt(month), parseInt(day)));
	
	$('#EventDateWeekDay').val(eventDate.weekday);
	
	let st = performance.now();
	for (let i = 1; i <= 5; i++) {
		let options = $(`.DaySelector option[value=${i}]`);
		let date = luxon.DateTime.fromObject({year: parseInt(year), month: parseInt(month), day: (parseInt(day) + i - 1)});
		let dateStr = date.toLocaleString({weekday: 'short', month: 'short', day: '2-digit'});
		options.text(`Day ${i} (${dateStr})`);
		options.attr('year-month-day', `${date.year}-${date.month}-${date.day}`);
	}
	console.log(performance.now() - st);
}

function onChangeMatchDayInput(this: HTMLSelectElement) {
	
	// find the time input sibling
	let thisName = this.getAttribute('name');
	assert(thisName);
	let thisRow = thisName.split('_')[1];
	const selector = `input[name="SchedTimeInput_${thisRow}"]`;
	const thisTimeInput = document.querySelector(selector);
	assert(thisTimeInput instanceof HTMLInputElement, 'Could not find time input! ' + selector);
	
	updateTime(thisTimeInput.value, parseInt(this.value), thisTimeInput);
}
		
function onKeydownTimeInput(this: HTMLElement, evt: JQuery.Event){
	assert(this instanceof HTMLInputElement, 'Not HTMLInputElement!');
	assert(typeof evt.keyCode === 'number', 'Wrong event type!');
	
	//If they key pressed is NOT: -shift, ctrl, caps lock, tab
	if((evt.keyCode != 16 && evt.keyCode != 17 && evt.keyCode != 20 && evt.keyCode != 9) || !evt){
		let timeString;
		//Keydown event fires BEFORE value is filled, so we must add keycode to string.
		//If key is backspace, manually subtract last character.
		if(evt.keyCode == 8){
			timeString = this.value.substring(0, this.value.length - 1);
		}
		//if input is alphanumeric, or space/colon, AND Ctrl is not pressed, add keycode to string.
		else if((( evt.keyCode <= 90 && evt.keyCode >= 48 ) ||
					evt.keyCode == 32 || evt.keyCode == 186) && !isCtrlCmdPressedDown){
					
			timeString = this.value + evt.key;
		}
		//otherwise, just grab value of input.
		else{
			timeString = this.value;
		}
		
		// find the day select sibling
		let thisName = this.getAttribute('name');
		assert(thisName);
		let thisRow = thisName.split('_')[1];
		const thisDayInput = document.querySelector(`select[name="DayNumber_${thisRow}"]`);
		assert(thisDayInput, 'Could not find dayNumber select!');
		const dayNumber = $(thisDayInput).val();
		assert(typeof dayNumber === 'string');
		
		updateTime(timeString, parseInt(dayNumber), this);
	}
}

function updateTime(timeString: string, dayNumber: number, timeInput: HTMLInputElement) {
	
	parseDateTime(dayNumber, timeString, (err, date) => {
		if(err){
			console.log(err);
			//add error class (red border)
			$(timeInput).addClass('error');
		}
		//If we successfully get a date
		else if(date){
			//remove error class (red border)
			$(timeInput).removeClass('error');
					
			//log date
			console.log(date.toLocaleString(luxon.DateTime.DATETIME_FULL));
			//Put date's value into hidden element SchedTime_#
			let row_number = timeInput.name.split('_')[1];
			$(`#SchedTime_${row_number}`).val(date.valueOf());
		}
	});
}
		
//parseTime function from somewhere on stackoverflow
function parseDateTime(dayNumber: number, t: string, callback: (error: string | null, date: luxon.DateTime|null) => void ) {
			
	if(eventDate){
		//Create new date obj, from eventDate
		let d = new Date(eventDate.valueOf());
				
		let time = t.match( /(\d+)(?::(\d\d))?\s*(p?)/ );
				
		if(time){
			d.setHours( parseInt( time[1]) + (time[3] ? 12 : 0) );
			d.setMinutes( parseInt( time[2]) || 0 );
			
			let date = luxon.DateTime.fromObject({
				year: eventDate.year, 
				month: eventDate.month, 
				day: eventDate.day,
				hour: parseInt( time[1]) + (time[3] ? 12 : 0),
				minute: parseInt( time[2]) || 0
			})
				.plus({days: dayNumber - 1}); // add the day number
			
			if (date.isValid)
				callback(null, date);
			else {
				callback('Invalid DateTime.', null);
			}
		}
		else{
			callback('Couldn\'t parse time.', null);
		}
	}
	else{
		//If eventDate is not set, automatically send error.
		alert('Event date is not set.');
		callback('Event date is not set.', null);
	}
}
		
//Handler for matchInput change
function onChangeMatchInput(this: HTMLInputElement){
	let thisMatchRow = parseInt(this.name.split('_')[1]);
			
	console.log(`thisMatchRow: ${thisMatchRow} currentMatchRow: ${currentMatchRow}`);
	
	let blue1 = $(`input[name=BlueTeam1_${thisMatchRow}]`);
	let blue2 = $(`input[name=BlueTeam2_${thisMatchRow}]`);
	let blue3 = $(`input[name=BlueTeam3_${thisMatchRow}]`);
	let red1 = $(`input[name=RedTeam1_${thisMatchRow}]`);
	let red2 = $(`input[name=RedTeam2_${thisMatchRow}]`);
	let red3 = $(`input[name=RedTeam3_${thisMatchRow}]`);
	
	for (let team of [blue1, blue2, blue3, red1, red2, red3]) {
		console.log(team.val());
		let teamNum = parseInt(String(team.val()));
		lightAssert(currentTeams.includes(teamNum), `Team ${teamNum} is not at this event!`);
	}
			
	if(thisMatchRow == currentMatchRow || thisMatchRow == currentMatchRow - 1){
		addNewMatchRow();
	}
}
		
//Add new match row
function addNewMatchRow(){
	currentMatchRow++;
			
	console.log(currentMatchRow);
			
	//remove current and prev match row add btn
	$(`#MatchAddOne_${currentMatchRow}`).remove();
	$(`#MatchAddOne_${currentMatchRow - 1}`).remove();
			
	let newRow = $('#MatchRow_Model').clone();
			
	//Replace match label with custom number BEFORE find/replace.
	let label = newRow.find('#MatchLabel_Model label');
	label.text(`Match ${currentMatchRow < 10 ? '0' + currentMatchRow : currentMatchRow}:`);
			
	//Find and replace "Model" with current match row for all IDs and values.
	newRow.html(function(index, html){
		return html.replace(/Model/g, String(currentMatchRow));
	});
	//set id, because find and replace is only for innerHTML
	newRow.attr('id', `MatchRow_${currentMatchRow}`);
			
	//Append new row to match table
	$('#MatchTable').append(newRow);
			
	//get add one (child of model so i don't have to deal with MatchAddOneModel ids left over)
	let newAddOne = $('#MatchAddOneModel').clone().children();
	//update id
	newAddOne.attr('id', `MatchAddOne_${currentMatchRow}`);
	//Append new add button to match table
	$('#MatchTable').append(newAddOne);
			
	//Update onchange handlers
	$('.RedTeam3').on('change', onChangeMatchInput);
	$('.TimeInput').on('keydown', onKeydownTimeInput);
}
function promisify (this: any, fn: any) {
	return (...args: any[]) => {
		return new Promise((resolve, reject) => {
			function customCallback(err: any, ...results: any[]) {
				if (err) {
					return reject(err);
				}
				return resolve(results.length === 1 ? results[0] : results); 
			}
			args.push(customCallback);
			fn.call(this, ...args);
		});
	};
}