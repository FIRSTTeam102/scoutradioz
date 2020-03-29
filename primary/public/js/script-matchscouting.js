/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
$(function(){
	
	$('#submit').on('click', function(){
		
		var matchForm = $('form[name=matchform]');
		
		var matchSubmission = new FormSubmission(matchForm, '/scouting/match/submit', 'matchScouting');
		
		matchSubmission.submit((err, message) => {
			if (err) {
				NotificationCard.error('An error occurred. Please retry.');
			}
			else{
				NotificationCard.show(message, {darken: true, type: 'good', ttl: 0});
				
				setTimeout(() => {
					window.onbeforeunload = null;
					window.location.href = '/dashboard/matches';
				}, 1000);
			}
		});
		
		window.onbeforeunload = function() {
			return 'Leaving this page will lose match scouting data.';
		};
	});

});