$(function(){
	
	$("#submit").on('click', function(){
		
		var formData = getFormData($("#scoutform"));
		var formDataString = JSON.stringify(formData);
		
		//adds data to local storage
		localStorage.setItem("matchFormData", formDataString); 
		
		//data on item to submit
		var toSubmit = {
			url: "/scouting/pit/submit",
			dataKey: "matchFormData",
			callback: function(){
				console.log("Callback called from match-client.js");
				
				setTimeout(function(){
					window.location.href="/dashboard";
				}, 1000);
			}
		};
		
		//create screen darkener
		darkener = document.createElement("div");
		darkener.classList.add("canvas");
		darkener.classList.add("theme-darkener");
		document.body.appendChild(darkener);
		//create card to say sending data
		createNotificationCard("Submitting pit data...");
		
		submitData(toSubmit.url, toSubmit.dataKey, toSubmit.callback);
	});

});