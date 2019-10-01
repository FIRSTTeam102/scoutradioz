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
	
	window.onbeforeunload = function() {
		return "Leaving this page will lose pit scouting data.";
	};
	
	//$(".chkText").on('click', chkToggleText);
	//$(".chkTextLabel").on('click', chkToggleFromTxt);
});
/*
function chkToggleText(){
	var txtInput = this.nextElementSibling.firstElementChild;
	if(this.checked){
		txtInput.disabled = false;
		txtInput.classList.remove("gear-disabled-click");
	}else{
		txtInput.disabled = true;
		txtInput.classList.add("gear-disabled-click");
	}
}
function chkToggleFromTxt(){
	var chk = this.previousElementSibling;
	chk.checked = true;
	var txtInput = this.firstElementChild;
	txtInput.disabled = false;
	txtInput.classList.remove("gear-disabled-click");
}
*/