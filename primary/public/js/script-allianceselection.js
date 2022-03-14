/* eslint-disable no-undef */
window.onbeforeunload = function(){return 'This page won\'t be saved.';};

const ROW_BASE_COLOR = '#b0b0c057';
const ROW_HIGHLIGHT_COLOR = 'rgba(220,220,240)';
const ROW_GRAYED_TEXT_COLOR = '#8d8d8dcf';

$(function(){
	//gray out first team
	grayOutRow( state.rankings[1] );

	//prettify table
	//prettifyTable();

	$('.alliance-team').click(doAllianceTeamClick);

	$(`#${state.alliances.alliance1[0]}`).addClass('team-taken');
	$(`#${state.alliances.alliance1[0]}`).attr('available', false);
	$('#all1team2').addClass('team-available');
	$('#all1team2').attr('spot-available', true);

	let startTime = Date.now();
	previousStates.push( {
		state: cloneState(),
		html: $('#allianceSelection').clone()
	});
	console.log(`Cloned in ${Date.now() - startTime} ms`);

	$('#undo').click(function(){
		doUndo();
	});
});

function doUndo(){
	console.log('Undo has been called.');

	//un-highlight currentSelectedTeam row
	unHighlightRow(state.currentSelectedTeam);

	if( state.moveHistory.length > 0){

		requestAnimationFrame(function(){

			var lastState = previousStates.pop();
			var parentElem = $('#allianceSelection').parent();
			var previousHTML = lastState.html;

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
			var lastMove = state.moveHistory.pop();
			var lastTeam = lastMove.teamKey;
			var lastSpot = lastMove.previousSpot;
			var lastNewCaptain = lastMove.newAllianceCaptain;
			console.log(lastMove, lastNewCaptain, lastTeam);
			
			if (lastTeam)
				unGrayOutRow(lastTeam);
			if (lastNewCaptain)
				unGrayOutRow(lastNewCaptain);
		});
	}
}

function doAllianceTeamClick(){

	var that = $(this);

	//console.log(`Team ${this.id} has been clicked`);
	var teamKey = this.id;
	let isAvailable = this.getAttribute('available') == 'true' ? true : false;
	//console.log(isAvailable);
	var spotIsAvailable = this.getAttribute('spot-available') == 'true' ? true : false;
	var currentSelectedTeam = state.currentSelectedTeam;

	//isAvailable: if this is a team that can be picked
	if( isAvailable ){
		//if there is a team already selected, remove highlight
		if( currentSelectedTeam ){
			$(`#${currentSelectedTeam}`).removeClass('team-highlighted');

			//un-highlight currentSelectedTeam row
			unHighlightRow(state.currentSelectedTeam);
		}
		//if we're clicking same team twice, remove currentselectedteam
		if( state.currentSelectedTeam == teamKey ){
			//un-highlight currentSelectedTeam row
			unHighlightRow(state.currentSelectedTeam);

			state.currentSelectedTeam = null;
		}
		//if not clicking same team twice, set the now-clicked team to be selected
		else{
			//un-highlight currentSelectedTeam row
			unHighlightRow(state.currentSelectedTeam);

			that.addClass('team-highlighted');
			state.currentSelectedTeam = teamKey;

			//now highlight new current team row
			highlightRow(state.currentSelectedTeam);
		}
	}
	//spotIsAvailable: if this is a slot that can be filled
	else if( spotIsAvailable ){
		//if a team is selected, DO EVERYTHING
		if( currentSelectedTeam ){

			//console.log(currentSelectedTeam);
			$(`#${currentSelectedTeam}`).removeClass('team-highlighted');
			state.currentSelectedTeam = null;

			var currentSpot = 0;

			//find rank of team
			for(let i = 0; i < state.rankings.length; i++){
				if(state.rankings[i] == currentSelectedTeam){
					currentSpot = i;
				}
			}
			if (state.currentRound == 0) console.log(state.rankings[state.currentAlliance + 1]);
			
			//Clone this state into previousStates
			var clonedState = cloneState();
			var clonedHTML = $('#allianceSelection').clone();
			var thisMove = {
				teamKey: currentSelectedTeam,
				previousSpot: currentSpot,
				allianceSpot: state.currentRound == 0 ? 2 : 3,
			};
			state.moveHistory.push(thisMove);

			//if team is not a captain, hide team from below list
			if( currentSpot > 8 ){
				$(`#${currentSelectedTeam}`).parent().hide();

				//remove team from rankings
				state.rankings.splice(currentSpot, 1);
			}
			//if team is a captain, move alliances up
			else{
				//get alliance num
				var currentAlliance = parseInt($(`#${currentSelectedTeam}`).attr('alliance'));

				//loop through remaining alliances, shifting them up
				for(let i = currentAlliance; i <= 8; i++){

					let nextTeamInThisSpot = state.rankings[i + 1];
					//console.log(nextTeamInThisSpot)
					let thisSpot = $(`#${state.rankings[i]}`);
					//console.log(thisSpot);

					//set this spot's contents to next team
					thisSpot.html( nextTeamInThisSpot.substring(3) );
					//id has to be set after the fact

					//if this team is not a captain, just hide em
					if( !$(`#${nextTeamInThisSpot}`).attr('alliance') ){

						$(`#${nextTeamInThisSpot}`).parent().hide();
					}

					//console.log( state.rankings[i] );
				}
				//remove team from rankings
				state.rankings.splice(currentSpot, 1);

				var allAllianceTeams = $('.alliance-team');

				for(let i = 1; i < allAllianceTeams.length; i++ ){

					let thisTeam = allAllianceTeams[i];

					//if this element contains a valid team
					if( thisTeam.id && thisTeam.id.substring(0,3) == 'frc' ){
						//then set id equal to the text it contains
						$(thisTeam).attr( 'id', 'frc' + $(thisTeam).text() );
					}
				}
			}
			//gray out selected team's row
			grayOutRow(currentSelectedTeam);

			//place the selected team into the selected spot
			that.html(currentSelectedTeam.substring(3));

			//gray out the now-populated slot
			that.removeClass('team-available')	//remove highlight
				.addClass('team-taken')			//make dark
				.attr('spot-available', false);	//make spot no longer able to be populated

			//if first round, move selection thingimajiggy down until 8
			if( state.currentRound == 0 ){

				if( state.currentAlliance < 8 ){

					//switch over to the next alliance to kerfuffle
					state.currentAlliance++;
					//set team 2 of next alliance as available
					$(`#all${state.currentAlliance}team2`).addClass('team-available')	//highlight
						.attr('spot-available', true);									//make spot able to be populated
				}
				//if the alliance we just did is alliance 8
				else{
					//begin to move down the chain now
					state.currentRound = 1;

					//set team 3 (THREE) of next alliance as available
					$(`#all${state.currentAlliance}team3`).addClass('team-available')
						.attr('spot-available', true);
				}
				//set first team in alliance to be unavailable
				let team1 = state.rankings[state.currentAlliance];

				console.log('Gonna disable '+team1);
				$(`#${team1}`).attr('available', false)		//make team no longer able to be highlighted
					.addClass('team-taken');				//make dark
				grayOutRow(team1); 							//gray out the row in the data
				thisMove.newAllianceCaptain = team1;		//keep track of the new alliance captain in the state move history
			}
			else{
				//only set next alliance available if we have at least one left
				if( state.currentAlliance > 1 ){

					state.currentAlliance--;
					//set team 3 (THREE) of next alliance as available
					$(`#all${state.currentAlliance}team3`).addClass('team-available')
						.attr('spot-available', true);
				}
			}
			//Push into move history after we've identified who the new alliance captain is
			clonedState.moveHistory.push(thisMove);
			console.log(clonedState.moveHistory);
			console.log(state.moveHistory);
			
			previousStates.push( {
				state: clonedState,
				html: clonedHTML
			});
		}
	}
}

function cloneState(){

	var clone = {};

	//clone rankings
	clone.rankings = [];
	for(let i = 0; i < state.rankings.length; i++){
		clone.rankings[i] = state.rankings[i];
	}

	//clone moveHistory
	clone.moveHistory = [];
	for(let i = 0; i < state.moveHistory.length; i++){
		clone.moveHistory[i] = state.moveHistory[i];
	}

	//clone currentSelectedTeam, currentRound, currentAlliance
	clone.currentSelectedTeam = state.currentSelectedTeam;
	clone.currentRound = state.currentRound;
	clone.currentAlliance = state.currentAlliance;

	// console.log(clone);

	return clone;
}

function highlightRow(teamKey){
	$(`#row_${teamKey}`).css({
		'background-color': ROW_HIGHLIGHT_COLOR,
		'color': '#000000'
	}).attr({
		'selectable': 'false'
	});

	var children = $(`#row_${teamKey}`).children();

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

		r = lerp(r, targetR, 0.7);
		g = lerp(g, targetG, 0.7);
		b = lerp(b, targetB, 0.7);

		$(children[i]).attr({
			'style': `background-color: rgba(${r}, ${g}, ${b}, 1); color:#000!important`
		});
	}
}

function unHighlightRow(teamKey){
	$(`#row_${teamKey}`).attr({
		'selectable' : 'true',
		'style' : 'background-color:' + ROW_BASE_COLOR
	});

	var children = $(`#row_${teamKey}`).children();

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
}

function grayOutRow(teamKey){
	
	const thisRow = $(`#row_${teamKey}`);
	
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
		let g = thisChild.attr('g') ||thisStyle[1];
		let b = thisChild.attr('b') ||thisStyle[2].substring(0, thisStyle[2].indexOf(')'));
		
		// Save the previous rgb values for unGrayOutRow (in case the row was NOT highlighted before being grayed out, then r/g/b would be unset)
		thisChild.attr({
			r: r,
			g: g,
			b: b
		});

		r = lerp(r, targetR, 0.8);
		g = lerp(g, targetG, 0.8);
		b = lerp(b, targetB, 0.8);

		thisChild.css({
			'background-color': `rgba(${r}, ${g}, ${b}, 0.41)`,
			'color': ROW_GRAYED_TEXT_COLOR
		});
	}
}

function lerp(a, b, t) {
	return (1-t)*a + t*b;
}

function unGrayOutRow(teamKey){
	
	const thisRow = $(`#row_${teamKey}`);

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
}

function prettifyTable(){

	requestAnimationFrame(function(){
		var table = $('#metricTable').eq(0);
		var rows = table.find('tr:gt(0)').toArray();

		for(let i = 0; i < rows.length; i++){

			if( $(rows[i]).attr('selectable') != 'false'){
				//style every other row
				if( i % 2 == 0 ){
					$(rows[i]).css({
						'background-color': 'rgba(255, 255, 255, 0.25)',
						'color': '#fff'
					});
				}
				else{
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
	if(this.checked){
		$('#data').show();
	}
	else{
		$('#data').hide();
	}
});