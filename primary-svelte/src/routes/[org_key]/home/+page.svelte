<script lang='ts'>
	import type { PageData } from "./$types";
	import { msg, msgJs } from "$lib/i18n";

	import JQ from 'jquery';
	import { goto } from "$app/navigation";
	
	export let data: PageData;
	
	const allTeamsMsg = msg('reports.allTeams');
	
	let upcomingMatchesMsg: string;
	$: 
		upcomingMatchesMsg = msg('reports.upcomingMatchesTeam', {team: selectedTeamNumber || allTeamsMsg});
			
	let selectedTeamNumber: string;
	
	function handleClickIntel(){
		if( !JQ("#teamSelect").val() ){
			if( !!JQ("#teamNo").val()) {
				//if teamSelect is filled, proceed to intel url
				var key = "frc".concat(JQ("#teamNo").val() as string);
				goto("./reports/teamintel?team_key="+key)
			
			}else if( !JQ("#stats").prop("disabled"))
				//if nothing selected then do alert thang
				alert(msgJs('home.specifyTeam'));
		}
		else {
			//if text input is filled, proceed to intel url
			var key = "frc".concat(JQ("#teamSelect").val() as string);
			goto("./reports/teamintel?team_key="+key)
		}
	}
	//Checks if teamSelect/teamNo are filled; and if so, redirect user to upcoming page.
	function handleClickUpcoming() {
		//if teamselect value is empty then redirect to upcoming matches page for all teams
		if( !JQ("#teamSelect").val() ){
			goto("./reports/upcoming")
		}
		//if a team is selected then redirect to upcoming for that team
		else {
			let key;
			if(!!JQ("#teamSelect").val) {
				key = "frc".concat(JQ("#teamSelect").val() as string);
			}
			else {
				key = "frc".concat(JQ("#teamNo").val() as string);
			}
			goto("./reports/upcoming?team_key="+key)
		}
	}
	
</script>

<template lang="pug">
	h6(class="theme-text").i {msg('home.menu', {menu: '≡'})}
		p
		div(class="w3-container w3-section")
			h4(class="theme-text") {msg('home.tournamentInfo')}
			
			a(href="reports/rankings")
				div(class="gear-btn theme-link w3-btn")
					span {msg('reports.currentRankings.titleShort')}
			br 
			a(href="reports/finishedmatches")
				div(class="gear-btn theme-link w3-btn")
					span {msg('reports.completedMatches')}
			br 
			a(href="reports/allteammetrics")
				div(class="gear-btn theme-link w3-btn")
					span {msg('reports.allTeamMetricsTitle')}
		div(class="w3-container w3-section")
			h4(class="theme-text") {msg('home.teamInfo')}
			//-teamSelect dropdown for intel and upcoming pages.
			a(href="dashboard/driveteam")
				div(class="gear-btn theme-link w3-btn")
					span {msg('driveDashboard.title')}
			br
			+if('data.teams && data.teams[0]')
				label(class="")
					select#teamSelect(class="gear-btn theme-input-link w3-btn" bind:value='{selectedTeamNumber}')
						option(value="") {msg('home.teamNum')}
						+each('data.teams as team')
							option(value="{team.team_number}" class="w3-bar-item") {team.team_number}
			a
				button(class="gear-btn theme-link w3-btn w3-disabled" on:click="{handleClickIntel}" id="stats" disabled)
					span {msg('home.stats')}
			a
				div(class="gear-btn theme-link w3-btn" on:click="{handleClickUpcoming}")
					span#upcomingMatches {upcomingMatchesMsg}
		//-If there is no logged-in user, then show a log-in link
		+if('!data.user || data.user.name === "default_user"')
			div(class="w3-container w3-section")
				h4(class="theme-text") {msg('home.userLogin')}
				a(href="user/login") 
					div(class="gear-btn theme-link w3-btn")
						span {msg('user.login')}
			+else()
				div(class="w3-container w3-section")
					h4(class="theme-text") {data.user.name}
					a(href="dashboard")
						div(class="gear-btn theme-link w3-btn") {msg('home.scoutingDashboard')}
					+if('data.user.role && data.user.role.access_level >= Permissions.ACCESS_TEAM_ADMIN')
						a(href="manage")
							div(class="gear-btn theme-link w3-btn") {msg('home.management')}
					+if('data.user.role && data.user.role.access_level >= Permissions.ACCESS_GLOBAL_ADMIN')
						a(href="admin")
							div(class="gear-btn theme-link w3-btn") {msg('home.admin')}
</template>