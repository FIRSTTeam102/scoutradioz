"use strict";
window.onbeforeunload = function () { return 'This page won\'t be saved.'; };
const ROW_BASE_COLOR = '#b0b0c057';
const ROW_HIGHLIGHT_COLOR = 'rgba(220,220,240)';
const ROW_GRAYED_TEXT_COLOR = '#8d8d8dcf';
$(function () {
    grayOutRow(state.rankings[1]);
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
    console.log(`Cloned in ${Date.now() - startTime} ms`);
    $('#undo').click(function () {
        doUndo();
    });
});
function doUndo() {
    console.log('Undo has been called.');
    unHighlightRow(state.currentSelectedTeam);
    if (state.moveHistory.length > 0) {
        requestAnimationFrame(function () {
            var lastState = previousStates.pop();
            if (!lastState)
                throw new Error('Previous state undefined');
            var parentElem = $('#allianceSelection').parent();
            var previousHTML = lastState.html;
            $('#allianceSelection').remove();
            parentElem.append(previousHTML);
            $('.team-highlighted').removeClass('team-highlighted');
            $('.alliance-team').click(doAllianceTeamClick);
            state = lastState.state;
            var lastMove = state.moveHistory.pop();
            if (!lastMove)
                throw new Error('Last move undefined');
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
function doAllianceTeamClick() {
    const _this = $(this);
    var teamKey = this.id;
    let isAvailable = this.getAttribute('available') == 'true' ? true : false;
    var spotIsAvailable = this.getAttribute('spot-available') == 'true' ? true : false;
    var currentSelectedTeam = state.currentSelectedTeam;
    if (isAvailable) {
        if (currentSelectedTeam) {
            $(`#${currentSelectedTeam}`).removeClass('team-highlighted');
            unHighlightRow(state.currentSelectedTeam);
        }
        if (state.currentSelectedTeam == teamKey) {
            unHighlightRow(state.currentSelectedTeam);
            state.currentSelectedTeam = null;
        }
        else {
            unHighlightRow(state.currentSelectedTeam);
            _this.addClass('team-highlighted');
            state.currentSelectedTeam = teamKey;
            highlightRow(state.currentSelectedTeam);
        }
    }
    else if (spotIsAvailable) {
        if (currentSelectedTeam) {
            $(`#${currentSelectedTeam}`).removeClass('team-highlighted');
            state.currentSelectedTeam = null;
            var currentSpot = 0;
            for (let i = 0; i < state.rankings.length; i++) {
                if (state.rankings[i] == currentSelectedTeam) {
                    currentSpot = i;
                }
            }
            if (state.currentRound == 0)
                console.log(state.rankings[state.currentAlliance + 1]);
            var clonedState = cloneState();
            var clonedHTML = $('#allianceSelection').clone();
            var thisMove = {
                teamKey: currentSelectedTeam,
                previousSpot: currentSpot,
                allianceSpot: state.currentRound == 0 ? 2 : 3,
            };
            state.moveHistory.push(thisMove);
            if (currentSpot > 8) {
                $(`#${currentSelectedTeam}`).parent().hide();
                state.rankings.splice(currentSpot, 1);
            }
            else {
                var currentAllianceStr = $(`#${currentSelectedTeam}`).attr('alliance');
                if (!currentAllianceStr)
                    throw new Error(`Couldn't find alliance attribute for #${currentSelectedTeam}`);
                var currentAlliance = parseInt(currentAllianceStr);
                for (let i = currentAlliance; i <= 8; i++) {
                    let nextTeamInThisSpot = state.rankings[i + 1];
                    let thisSpot = $(`#${state.rankings[i]}`);
                    if (typeof nextTeamInThisSpot !== 'string')
                        throw new TypeError(`Could not find team from state rankings idx ${i + 1}`);
                    thisSpot.html(nextTeamInThisSpot.substring(3));
                    if (!$(`#${nextTeamInThisSpot}`).attr('alliance')) {
                        $(`#${nextTeamInThisSpot}`).parent().hide();
                    }
                }
                state.rankings.splice(currentSpot, 1);
                var allAllianceTeams = $('.alliance-team');
                for (let i = 1; i < allAllianceTeams.length; i++) {
                    let thisTeam = allAllianceTeams[i];
                    if (thisTeam.id && thisTeam.id.substring(0, 3) == 'frc') {
                        $(thisTeam).attr('id', 'frc' + $(thisTeam).text());
                    }
                }
            }
            grayOutRow(currentSelectedTeam);
            _this.html(currentSelectedTeam.substring(3));
            _this.removeClass('team-available')
                .addClass('team-taken')
                .attr('spot-available', 'false');
            if (state.currentRound == 0) {
                if (state.currentAlliance < 8) {
                    state.currentAlliance++;
                    $(`#all${state.currentAlliance}team2`).addClass('team-available')
                        .attr('spot-available', 'true');
                }
                else {
                    state.currentRound = 1;
                    $(`#all${state.currentAlliance}team3`).addClass('team-available')
                        .attr('spot-available', 'true');
                }
                let team1 = state.rankings[state.currentAlliance];
                console.log('Gonna disable ' + team1);
                $(`#${team1}`).attr('available', 'false')
                    .addClass('team-taken');
                grayOutRow(team1);
                thisMove.newAllianceCaptain = team1;
            }
            else {
                if (state.currentAlliance > 1) {
                    state.currentAlliance--;
                    $(`#all${state.currentAlliance}team3`).addClass('team-available')
                        .attr('spot-available', 'true');
                }
            }
            clonedState.moveHistory.push(thisMove);
            console.log(clonedState.moveHistory);
            console.log(state.moveHistory);
            previousStates.push({
                state: clonedState,
                html: clonedHTML
            });
        }
    }
}
function cloneState() {
    const rankings = [];
    for (let i = 0; i < state.rankings.length; i++) {
        rankings[i] = state.rankings[i];
    }
    const moveHistory = [];
    for (let i = 0; i < state.moveHistory.length; i++) {
        moveHistory[i] = state.moveHistory[i];
    }
    var clone = {
        rankings: rankings,
        moveHistory: moveHistory,
        currentSelectedTeam: state.currentSelectedTeam,
        currentRound: state.currentRound,
        currentAlliance: state.currentAlliance,
    };
    return clone;
}
function highlightRow(teamKey) {
    $(`.row_${teamKey}`).css({
        'background-color': ROW_HIGHLIGHT_COLOR,
        'color': '#000000'
    }).attr({
        'selectable': 'false'
    });
    var children = $(`.row_${teamKey}`).children();
    let targetR = 240, targetG = 240, targetB = 255;
    for (let i = 3; i < children.length; i++) {
        let thisStyle = $(children[i]).css('background-color').split(',');
        let r = thisStyle[0].substring(thisStyle[0].indexOf('(') + 1);
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
}
function unHighlightRow(teamKey) {
    $(`.row_${teamKey}`).attr({
        'selectable': 'true',
        'style': 'background-color:' + ROW_BASE_COLOR
    });
    var children = $(`.row_${teamKey}`).children();
    let targetR = 240, targetG = 240, targetB = 255;
    for (let i = 3; i < children.length; i++) {
        let r = $(children[i]).attr('r');
        let g = $(children[i]).attr('g');
        let b = $(children[i]).attr('b');
        $(children[i]).attr({
            'style': `background-color: rgba(${r}, ${g}, ${b}, 1);`
        });
    }
}
function grayOutRow(teamKey) {
    const thisRow = $(`.row_${teamKey}`);
    thisRow.css({
        'background-color': 'rgba(67, 66, 66, 0.41)',
        'color': ROW_GRAYED_TEXT_COLOR
    }).attr({
        'selectable': 'false'
    });
    const children = thisRow.children();
    let targetR = 0, targetG = 0, targetB = 0;
    for (let i = 3; i < children.length; i++) {
        const thisChild = $(children[i]);
        let thisStyle = $(children[i]).css('background-color').split(',');
        let r = thisChild.attr('r') || thisStyle[0].substring(thisStyle[0].indexOf('(') + 1);
        let g = thisChild.attr('g') || thisStyle[1];
        let b = thisChild.attr('b') || thisStyle[2].substring(0, thisStyle[2].indexOf(')'));
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
}
function lerp(a, b, t) {
    return (1 - t) * a + t * b;
}
function unGrayOutRow(teamKey) {
    const thisRow = $(`.row_${teamKey}`);
    thisRow.css({
        'background-color': ROW_BASE_COLOR,
        'color': ''
    }).attr({
        'selectable': 'true',
    });
    const children = thisRow.children();
    for (let i = 3; i < children.length; i++) {
        const thisChild = $(children[i]);
        let r = thisChild.attr('r');
        let g = thisChild.attr('g');
        let b = thisChild.attr('b');
        thisChild.css({
            'background-color': `rgb(${r}, ${g}, ${b})`,
            'color': ''
        });
    }
}
function prettifyTable() {
    requestAnimationFrame(function () {
        var table = $('#metricTable').eq(0);
        var rows = table.find('tr:gt(0)').toArray();
        for (let i = 0; i < rows.length; i++) {
            if ($(rows[i]).attr('selectable') != 'false') {
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
$('#showHideData').click(function (e) {
    if (this.checked) {
        $('#data').show();
    }
    else {
        $('#data').hide();
    }
});
