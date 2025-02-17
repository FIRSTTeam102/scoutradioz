// See views/dashboard/allianceselection.pug for an explanation of these objects
declare class State {
	// unused
	alliances?: TeamKey[][];
	rankings: Array<TeamKey>; 
	currentSelectedTeam: TeamKey;
	moveHistory: Array<Move>;
	currentRound: integer;
	currentAlliance: integer;
	t605s: Array<TeamKey>;
	t605Alliances: integer[];
	currentT605: integer;
	doingRevisits: boolean;
}

// Moves added in the move history
// Appears to only be used in 'Undo' for knowing which table rows to un-gray out
declare class Move {
	// allianceSpot: integer;  // M.O'C, 2025-02-17: This is not used
	newAllianceCaptain?: TeamKey;
	// previousSpot: integer;  // M.O'C, 2025-02-17: This is not used
	teamKey: TeamKey;
	skippedAllianceCaptain?: TeamKey;
}

// Each "previous state" contains a snapshot of the html of the top section
declare class PreviousState {
	state: State;
	html: JQuery;
}

declare type integer = number; // not sure what the & { __int__ } part means, but I got it from a website
declare type TeamKey = string|null;

declare let state: State;
declare let previousStates: Array<PreviousState>;
declare let startingCaptain: TeamKey;
declare let i18n: Record<string, string>; // select i18n messages are passed through pug
declare let numAlliances: number;

window.onbeforeunload = (e) => {
	e.preventDefault();
	return i18n['wontSave'];
};

const ROW_BASE_COLOR = '#b0b0c057';
const ROW_HIGHLIGHT_COLOR = 'rgba(220,220,240)';
const ROW_GRAYED_TEXT_COLOR = '#8d8d8dcf';

console.log(`s-a:global - numAlliances=${numAlliances}`);

// flag for displaying tracing messages
let TRACE = true;

$(function(){
	if (TRACE) console.log('s-a:$(function() - ENTER');

	//gray out first team
	grayOutRow(state.rankings[1]);

	//prettify table
	//prettifyTable();

	$('.alliance-team').click(doAllianceTeamClick);

	$(`#${startingCaptain}`).addClass('team-taken')
		.attr('available', 'false');
	$('#all1team2').addClass('team-available')
		.attr('spot-available', 'true');

	let startTime = Date.now();
	previousStates.push({
		state: cloneState(),
		html: $('#allianceSelection').clone()
	});
	console.log(`s-a:$(function() - Cloned in ${Date.now() - startTime} ms`);

	// Undo button
	$('#btnUndo').on('click', function(){
		doUndo();
	});

	// Skip button
	$('#btnSkip').on('click', function(){
		doSkip();
	});

	// Options button
	$('#btnOptions').on('click', function () {
		document.getElementById('options')?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
	});

	$('#numAlliances').on('change', (e) => doNumChange(e.target, 'numAlliances'));
	$('#numRounds').on('change', (e) => doNumChange(e.target, 'numRounds'));
	
	// When a team number is clicked, open a dialog with their super scout notes
	$('[team-key]').on('click', function() {
		let team_key = $(this).attr('team-key');
		Dialog.showURL(`/reports/teamintel?team_key=${team_key}`);
	});
	
	if (TRACE) console.log('s-a:$(function() - EXIT');
});

function doNumChange(el: Element, param: string) {
	if (TRACE) console.log(`s-a:doNumChange - ENTER el=${JSON.stringify(el)}, param=${param}`);

	let search = new URLSearchParams(location.search);
	search.set(param, String($(el).val()));
	location.search = search.toString();

	if (TRACE) console.log('s-a:doNumChange - EXIT');
}

function doUndo(){
	if (TRACE) console.log('s-a:doUndo - ENTER');

	//un-highlight currentSelectedTeam row
	unHighlightRow(state.currentSelectedTeam);

	if(state.moveHistory.length > 0){

		requestAnimationFrame(function(){

			let lastState = previousStates.pop();
			if (!lastState) throw new Error(i18n['previousStateUndefined']);
			
			let parentElem = $('#allianceSelection').parent();
			let previousHTML = lastState.html;

			//replace html
			$('#allianceSelection').remove();
			parentElem.append(previousHTML);

			//un-highlight highlighted team
			$('.team-highlighted').removeClass('team-highlighted');

			//re-initialize onclick handler
			$('.alliance-team').click(doAllianceTeamClick);

			//refresh state
			state = lastState.state;

			//get last team thingy
			let lastMove = state.moveHistory.pop();
			if (!lastMove) throw new Error(i18n['noLastMove']);
			let lastTeam = lastMove.teamKey;
			//let lastSpot = lastMove.previousSpot;
			let lastNewCaptain = lastMove.newAllianceCaptain;
			console.log(`s-a:doUndo - lastMove=${JSON.stringify(lastMove)}, lastNewCaptain=${JSON.stringify(lastNewCaptain)}, lastTeam=${JSON.stringify(lastTeam)}`);
			
			if (lastTeam)
				unGrayOutRow(lastTeam);
			if (lastNewCaptain)
				unGrayOutRow(lastNewCaptain);
		});
	}

	if (TRACE) console.log('s-a:doUndo - EXIT');
}

function doSkip(){
	if (TRACE) console.log('s-a:doSkip - ENTER');

	//Clone this state into previousStates
	let thisMove: Move = {
		teamKey: state.rankings[state.currentAlliance],
		skippedAllianceCaptain: state.rankings[state.currentAlliance],
		//previousSpot: currentSpot,
		//allianceSpot: state.currentRound == 0 ? 2 : 3,
	};
	state.moveHistory.push(thisMove);
	let clonedState = cloneState();
	let clonedHTML = $('#allianceSelection').clone();
	previousStates.push({
		state: clonedState,
		html: clonedHTML
	});

	// un-highlight currentSelectedTeam row
	if (!state.doingRevisits) {
		if (TRACE) console.log(`s-a:doSkip - Skipping NOT a revisit - #all${state.currentAlliance}team${state.currentRound+2} removing team-available`);
		$(`#all${state.currentAlliance}team${state.currentRound+2}`).removeClass('team-available');
	}
	else {
		if (TRACE) console.log(`s-a:doSkip - Skipping REVISIT - #all${state.t605Alliances[state.currentT605]}team${state.currentRound+2} removing team-available`);
		$(`#all${state.t605Alliances[state.currentT605]}team${state.currentRound+2}`).removeClass('team-available');
	}

	// if we're not currently doing revisits?...
	if (TRACE) console.log('s-a:doSkip - state.doingRevisits=', state.doingRevisits);
	if (!state.doingRevisits) {
		if (TRACE) console.log('s-a:doSkip - state.currentAlliance=', state.currentAlliance);
		if (TRACE) console.log('s-a:doSkip - state.rankings[state.currentAlliance]=', state.rankings[state.currentAlliance]);
		// ...then this is a new T605 violation
		// add the current team to the T605 list
		state.t605s.push(state.rankings[state.currentAlliance]);
		state.t605Alliances.push(state.currentAlliance);

		// IFF this the only T605 at the moment? then jump to next captain
		if (TRACE) console.log('s-a:doSkip - state.t605s.length=', state.t605s.length);
		if (state.t605s.length == 1) {
			if (TRACE) console.log('s-a:doSkip - new T605 is only T605, moving to next captain');
			moveToNextCaptain();
			return;
		}

		// otherwise, start doing revisits & cycle through the current T605s
		if (TRACE) console.log('s-a:doSkip - there were prior T605s so starting revisits');
		state.doingRevisits = true;
		if (TRACE) console.log('s-a:doAllianceTeamClick - resetting currentT605 to 0');
		state.currentT605 = 0;

		moveToNextRevisit();
	}
	else {
		// we're doing revisits and we skipped a revisit
		if (TRACE) console.log(`s-a:doSkip - about to increment currentT605 (now ${state.currentT605})`);
		state.currentT605++;
	
		// ...keep moving through the revisits
		if (state.currentT605 < state.t605s.length)	{	
			if (TRACE) console.log('s-a:doSkip - cycling through revisits');
			moveToNextRevisit();
		}
		else {
			// ...if we're done with the revisits, then we're done with the T605s
			if (TRACE) console.log('s-a:doSkip - done with revisits');
			state.doingRevisits = false;
			moveToNextCaptain();
		}
	}

	//moveToNextCaptain();

	if (TRACE) console.log('s-a:doSkip - EXIT');
}

function moveToNextRevisit() {
	if (TRACE) console.log('s-a:moveToNextRevisit - ENTER');

	if (TRACE) console.log('s-a:moveToNextRevisit - state.currentT605=', state.currentT605);
	if (TRACE) console.log(`s-a:moveToNextRevisit - all${state.t605Alliances[state.currentT605]}team${state.currentRound+2}`);
	$(`#all${state.t605Alliances[state.currentT605]}team${state.currentRound+2}`).addClass('team-available') // highlight
		.attr('spot-available', 'true'); // make spot able to be populated

	if (TRACE) console.log('s-a:moveToNextRevisit - EXIT');
}

function doAllianceTeamClick(this: HTMLElement){
	if (TRACE) console.log(`s-a:doAllianceTeamClick - ENTER this=${JSON.stringify(this)}`);

	const _this = $(this);

	if (TRACE) console.log(`s-a:doAllianceTeamClick - !!!!!! Team ${this.id} has been clicked`);
	let teamKey = this.id;
	let isAvailable = this.getAttribute('available') == 'true' ? true : false;
	if (TRACE) console.log(`s-a:doAllianceTeamClick - isAvailable=${isAvailable}`);
	let spotIsAvailable = this.getAttribute('spot-available') == 'true' ? true : false;
	let currentSelectedTeam = state.currentSelectedTeam;

	//isAvailable: if this is a team that can be picked
	if (isAvailable) {
		//if there is a team already selected, remove highlight
		if (currentSelectedTeam) {
			$(`#${currentSelectedTeam}`).removeClass('team-highlighted');

			//un-highlight currentSelectedTeam row
			unHighlightRow(state.currentSelectedTeam);
		}
		//if we're clicking same team twice, remove currentselectedteam
		if (state.currentSelectedTeam == teamKey) {
			//un-highlight currentSelectedTeam row
			unHighlightRow(state.currentSelectedTeam);

			state.currentSelectedTeam = null;
		}
		//if not clicking same team twice, set the now-clicked team to be selected
		else{
			//un-highlight currentSelectedTeam row
			unHighlightRow(state.currentSelectedTeam);

			_this.addClass('team-highlighted');
			state.currentSelectedTeam = teamKey;

			//now highlight new current team row
			highlightRow(state.currentSelectedTeam);
		}
	}
	//spotIsAvailable: if this is a slot that can be filled
	else if (spotIsAvailable) {
		//if a team is selected, DO EVERYTHING
		if (currentSelectedTeam) {

			if (TRACE) console.log(`s-a:doAllianceTeamClick - <<<<<< currentSelectedTeam=${currentSelectedTeam}`);
			$(`#${currentSelectedTeam}`).removeClass('team-highlighted');
			state.currentSelectedTeam = null;

			let currentSpot = 0;

			//find rank of team
			for(let i = 0; i < state.rankings.length; i++){
				if(state.rankings[i] == currentSelectedTeam){
					currentSpot = i;
				}
			}
			if (state.currentRound == 0) console.log(`s-a:doAllianceTeamClick - state.rankings[state.currentAlliance + 1]=${JSON.stringify(state.rankings[state.currentAlliance + 1])}`);
			
			//Clone this state into previousStates
			let clonedState = cloneState();
			let clonedHTML = $('#allianceSelection').clone();
			let thisMove: Move = {
				teamKey: currentSelectedTeam,
				//previousSpot: currentSpot,
				//allianceSpot: state.currentRound == 0 ? 2 : 3,
			};
			state.moveHistory.push(thisMove);

			//if team is not a captain, hide team from below list
			if (currentSpot > numAlliances) {
				$(`#${currentSelectedTeam}`).parent().hide();

				//remove team from rankings
				state.rankings.splice(currentSpot, 1);
			}
			//if team is a captain, move alliances up
			else {
				//get alliance num
				let currentAllianceStr = $(`#${currentSelectedTeam}`).attr('alliance');
				if (!currentAllianceStr) throw new Error(i18n['noAllianceAttribute'].replace('{team}', currentSelectedTeam));
				
				let currentAlliance = parseInt(currentAllianceStr);

				//loop through remaining alliances, shifting them up
				for(let i = currentAlliance; i <= numAlliances; i++){

					let nextTeamInThisSpot: TeamKey = state.rankings[i + 1];
					let thisSpot = $(`#${state.rankings[i]}`);
					
					if (typeof nextTeamInThisSpot !== 'string') throw new TypeError(i18n['noTeamStateRankings'].replace('{i}', ''+i+1));

					//set this spot's contents to next team
					thisSpot.html(nextTeamInThisSpot.substring(3));
					//id has to be set after the fact

					//if this team is not a captain, just hide em
					if (!$(`#${nextTeamInThisSpot}`).attr('alliance')) {

						$(`#${nextTeamInThisSpot}`).parent().hide();
					}

					if (TRACE) console.log(`s-a:doAllianceTeamClick - state.rankings[i]=${state.rankings[i]}`);
				}
				//remove team from rankings
				state.rankings.splice(currentSpot, 1);

				let allAllianceTeams = $('.alliance-team');

				for(let i = 1; i < allAllianceTeams.length; i++ ){

					let thisTeam = allAllianceTeams[i];

					//if this element contains a valid team
					if (thisTeam.id && thisTeam.id.substring(0,3) == 'frc') {
						//then set id equal to the text it contains
						$(thisTeam).attr('id', 'frc' + $(thisTeam).text());
					}
				}
			}
			//gray out selected team's row
			grayOutRow(currentSelectedTeam);

			//place the selected team into the selected spot
			_this.html(currentSelectedTeam.substring(3));

			//gray out the now-populated slot
			_this.removeClass('team-available')	//remove highlight
				.addClass('team-taken')			//make dark
				.attr('spot-available', 'false');	//make spot no longer able to be populated

			// Were we revisiting when an alliance was formed?
			if (state.doingRevisits) {
				if (TRACE) console.log('s-a:doAllianceTeamClick - we be doing a revisit!');

				// remove this team from the revisits
				if (TRACE) console.log(`s-a:doAllianceTeamClick - state.t605s=${JSON.stringify(state.t605s)}`);
				if (TRACE) console.log(`s-a:doAllianceTeamClick - state.t605Alliances=${JSON.stringify(state.t605Alliances)}`);
				if (TRACE) console.log(`s-a:doAllianceTeamClick - --- state.currentT605=${state.currentT605}, state.t605Alliances[state.currentT605]=${state.t605Alliances[state.currentT605]}`);
				state.t605Alliances.splice(state.currentT605, 1);
				state.t605s.splice(state.currentT605, 1);
				if (TRACE) console.log(`s-a:doAllianceTeamClick - >>> state.s605s=${JSON.stringify(state.t605s)}`);
				if (TRACE) console.log(`s-a:doAllianceTeamClick - >>> state.t605Alliances=${JSON.stringify(state.t605Alliances)}`);
				state.currentT605 = 0;
				state.doingRevisits = false;
			}
			// Are there (still) T605s?
			if (state.t605s.length > 0) {
				if (TRACE) console.log(`s-a:doAllianceTeamClick - state.t605s.length=${state.t605s.length}`);
				state.doingRevisits = true;
				if (TRACE) console.log('s-a:doAllianceTeamClick - resetting currentT605 to 0');
				state.currentT605 = 0;
				moveToNextRevisit();
				return;
			}

			moveToNextCaptainWithClone(clonedState, clonedHTML, thisMove);
		}
	}

	if (TRACE) console.log('s-a:doAllianceTeamClick - EXIT');
}

function moveToNextCaptainWithClone(clonedState: State, clonedHTML: JQuery, thisMove: Move){
	if (TRACE) console.log('s-a:moveToNextCaptainWithClone - ENTER');

	let team1 = moveToNextCaptain();

	if (state.currentRound == 0) {
		thisMove.newAllianceCaptain = team1; // keep track of the new alliance captain in the state move history
	}

	// push into move history after we've identified who the new alliance captain is
	clonedState.moveHistory.push(thisMove);
	console.log(`s-a:doAllianceTeamClick - clonedState.moveHistory=${JSON.stringify(clonedState.moveHistory)}`);
	
	previousStates.push({
		state: clonedState,
		html: clonedHTML
	});

	if (TRACE) console.log('s-a:moveToNextCaptainWithClone - EXIT');
}

function moveToNextCaptain(){
	if (TRACE) console.log('s-a:moveToNextCaptain - ENTER');

	// even rounds, move down towards last alliance; odd rounds, move up towards first
	let goingDown = state.currentRound % 2 == 0;

	// continuing this round
	if (goingDown ? state.currentAlliance < numAlliances : state.currentAlliance > 1) {
		// switch over to the next alliance
		state.currentAlliance += goingDown ? 1 : -1;
		// set next team of next alliance as available
		$(`#all${state.currentAlliance}team${state.currentRound+2}`).addClass('team-available') // highlight
			.attr('spot-available', 'true'); // make spot able to be populated
	}
	// next round
	else {
		state.currentRound++;
		
		$(`#all${state.currentAlliance}team${state.currentRound+2}`).addClass('team-available')
			.attr('spot-available', 'true');
	}

	let team1 = undefined;
	if (state.currentRound == 0) {
		// set first team in alliance to be unavailable
		team1 = state.rankings[state.currentAlliance];
		console.log('s-a:doAllianceTeamClick - Gonna disable', team1);
		$(`#${team1}`).attr('available', 'false') // make team no longer able to be highlighted
			.addClass('team-taken');
		grayOutRow(team1); // gray out the row in the data
	}

	if (TRACE) console.log(`s-a:moveToNextCaptain - EXIT team1=${JSON.stringify(team1)}`);
	return team1;
}

function cloneState(): State{
	//if (TRACE) console.log('s-a:cloneState - ENTER');

	//clone rankings
	const rankings = [];
	for(let i = 0; i < state.rankings.length; i++){
		rankings[i] = state.rankings[i];
	}

	//clone moveHistory
	const moveHistory = [];
	for(let i = 0; i < state.moveHistory.length; i++){
		moveHistory[i] = state.moveHistory[i];
	}

	// console.log(clone);
	
	//clone currentSelectedTeam, currentRound, currentAlliance
	let clone: State = {
		rankings: rankings,
		moveHistory: moveHistory,
		currentSelectedTeam: state.currentSelectedTeam,
		currentRound: state.currentRound,
		currentAlliance: state.currentAlliance,
		t605s: state.t605s,
		t605Alliances: state.t605Alliances,
		currentT605: state.currentT605,
		doingRevisits: state.doingRevisits
	};

	if (TRACE) console.log(`s-a:cloneState - EXIT clone=${JSON.stringify(clone)}`);
	return clone;
}

function highlightRow(teamKey: TeamKey){
	if (TRACE) console.log(`s-a:highlightRow - ENTER teamKey=${JSON.stringify(teamKey)}`);

	$(`.row_${teamKey}`).css({
		'background-color': ROW_HIGHLIGHT_COLOR,
		'color': '#000000'
	}).attr({
		'selectable': 'false'
	});

	let children = $(`.row_${teamKey}`).children();

	let targetR = 240, targetG = 240, targetB = 255;

	for(let i = 3; i < children.length; i++){

		let thisStyle = $(children[i]).css('background-color').split(',');
		let r = thisStyle[0].substring(thisStyle[0].indexOf('(')+1);
		let g = thisStyle[1];
		let b = thisStyle[2].substring(0, thisStyle[2].indexOf(')'));

		$(children[i]).attr({
			'r': r,
			'g': g,
			'b': b
		});
		
		let rNew = lerp(parseFloat(r), targetR, 0.7);
		let gNew = lerp(parseFloat(g), targetG, 0.7);
		let bNew = lerp(parseFloat(b), targetB, 0.7);

		$(children[i]).attr({
			'style': `background-color: rgba(${rNew}, ${gNew}, ${bNew}, 1); color:#000!important`
		});
	}

	//if (TRACE) console.log('s-a:highlightRow - EXIT');
}

function unHighlightRow(teamKey: TeamKey){
	if (TRACE) console.log(`s-a:unHighlightRow - ENTER teamKey=${JSON.stringify(teamKey)}`);

	$(`.row_${teamKey}`).attr({
		'selectable' : 'true',
		'style' : 'background-color:' + ROW_BASE_COLOR
	});

	let children = $(`.row_${teamKey}`).children();

	let targetR = 240, targetG = 240, targetB = 255;

	for(let i = 3; i < children.length; i++){

		let r = $(children[i]).attr('r');
		let g = $(children[i]).attr('g');
		let b = $(children[i]).attr('b');

		$(children[i]).attr({
			'style': `background-color: rgba(${r}, ${g}, ${b}, 1);`
		});
	}
	//prettifyTable();
	//if (TRACE) console.log('s-a:unHighlightRow - EXIT');
}

function grayOutRow(teamKey: TeamKey){
	if (TRACE) console.log(`s-a:grayOutRow - ENTER teamKey=${JSON.stringify(teamKey)}`);
	
	const thisRow = $(`.row_${teamKey}`);
	
	thisRow.css({
		'background-color': 'rgba(67, 66, 66, 0.41)',
		'color': ROW_GRAYED_TEXT_COLOR
	}).attr({
		'selectable': 'false'
	});
	const children = thisRow.children();

	let targetR = 0, targetG = 0, targetB = 0;

	for(let i = 3; i < children.length; i++){
		const thisChild = $(children[i]);
		let thisStyle = $(children[i]).css('background-color').split(',');
		// Take priority of r/g/b attributes instead of background color, in case the row was highlighted before being grayed out
		let r = thisChild.attr('r') || thisStyle[0].substring(thisStyle[0].indexOf('(')+1);
		let g = thisChild.attr('g') || thisStyle[1];
		let b = thisChild.attr('b') || thisStyle[2].substring(0, thisStyle[2].indexOf(')'));
		
		// Save the previous rgb values for unGrayOutRow (in case the row was NOT highlighted before being grayed out, then r/g/b would be unset)
		thisChild.attr({
			r: r,
			g: g,
			b: b
		});

		let rNew = lerp(parseFloat(r), targetR, 0.8);
		let gNew = lerp(parseFloat(g), targetG, 0.8);
		let bNew = lerp(parseFloat(b), targetB, 0.8);

		thisChild.css({
			'background-color': `rgba(${rNew}, ${gNew}, ${bNew}, 0.41)`,
			'color': ROW_GRAYED_TEXT_COLOR
		});
	}

	//if (TRACE) console.log('s-a:grayOutRow - EXIT');
}

function lerp(a: number, b: number, t: number) {
	return (1-t)*a + t*b;
}

function unGrayOutRow(teamKey: TeamKey){
	if (TRACE) console.log(`s-a:unGrayOutRow - ENTER teamKey=${JSON.stringify(teamKey)}`);
	
	const thisRow = $(`.row_${teamKey}`);

	thisRow.css({
		'background-color': ROW_BASE_COLOR,
		'color': ''
	}).attr({
		'selectable': 'true',
	});
	
	
	const children = thisRow.children();
	for(let i = 3; i < children.length; i++) {
		const thisChild = $(children[i]);
		// Retrieve the original rgb values before graying it out
		let r = thisChild.attr('r');
		let g = thisChild.attr('g');
		let b = thisChild.attr('b');
		thisChild.css({
			'background-color': `rgb(${r}, ${g}, ${b})`,
			'color': ''
		});
	}
	//prettifyTable();
	//if (TRACE) console.log('s-a:unGrayOutRow - EXIT');
}

function prettifyTable(){

	requestAnimationFrame(function(){
		let table = $('#metricTable').eq(0);
		let rows = table.find('tr:gt(0)').toArray();

		for(let i = 0; i < rows.length; i++){

			if ($(rows[i]).attr('selectable') != 'false'){
				//style every other row
				if (i % 2 == 0) {
					$(rows[i]).css({
						'background-color': 'rgba(255, 255, 255, 0.25)',
						'color': '#fff'
					});
				}
				else {
					$(rows[i]).css({
						'background-color': 'rgba(200, 200, 200, 0.25)',
						'color': '#fff'
					});
				}
			}
		}
	});
}

$('#showHideData').click(function(e){
	if (this.checked) {
		$('#data').show();
	}
	else {
		$('#data').hide();
	}
});