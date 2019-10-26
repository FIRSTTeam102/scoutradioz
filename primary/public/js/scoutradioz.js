if(!$){
	console.error("scoutradioz.js error: jQuery not enabled");
}

var debugLogger = document.createElement("div");
$(debugLogger).css({
	"background-color": "white",
	"color": "black",
	"z-index": "99",
	"position": "absolute",
	"top": "0",
	"width": "25%",
	"padding": "8px 16px",
});

function debugToHTML(message) {
	
	var text;
	
	switch (typeof message) {
		case "string":
		case "number":
			text = message;
			break;
		case "object":
		case "array":
			text = JSON.stringify(message);
			break;
		default:
			text = message;
	}
	
	//if logger is not already added to document.body, add it now
	if ( !$(debugLogger).parent()[0] ) {
		
		$(document.body).append(debugLogger);
	}
	
	var newTextElem = document.createElement("pre");
	$(newTextElem).text(text);
	
	$(debugLogger).append(newTextElem);
}

function createNotificationCard( text, type, ttl ){
	
	var color;
	
	switch( type ){
		case "bad": 
			color = "theme-red";
			break;
		case "warn":
			color = "w3-amber";
			break;
		case "good":
			color = "alliance-blue";
			break;
		default:
			color = "w3-white";
			 break;
	}
	
	//ttl in milliseconts
	if (!ttl) {
		var ttl = 1500;
	}
	
	if(!text){
		console.error("createNotificationCard: No text parameter sent");
		return null;
	}
	
	card = document.createElement("div");
	
	card.innerText = text;
	card.classList.add("w3-card");
	card.classList.add("w3-padding");
	card.classList.add("w3-border");
	card.classList.add("w3-center");
	card.classList.add( color );
	card.style = "position:fixed; top:50px; transition:opacity 2.5s; opacity:1; z-index:3;";
	card.id = "notification-card";
	
	if(window.innerWidth >= 601){
		card.classList.add("w3-half");
		card.style.left = "25%";
	}else{
		card.classList.add("w3-container");
		card.style.width = "100%";
	}
	
	document.body.appendChild(card);
	
	
	setTimeout( function(){
		var cards = document.querySelectorAll("#notification-card");
		
		if(cards.length >= 0)
			for( var i = 0; i < cards.length; i++ ){
				cards[i].style.opacity = 0;
			}
	}, ttl);
	
	setTimeout( function(){
		$("#notification-card").remove();
	}, ttl + 5000);
	
}

function getFormData($form){
    var unindexed_array = $form.serializeArray();
    var indexed_array = {};

    $.map(unindexed_array, function(n, i){
        indexed_array[n['name']] = n['value'];
    });

    return indexed_array;
}

function submitData(url, dataKey, callback, indexOfLS){
	//console.log(dataKey);
	var dataString = localStorage.getItem(dataKey);
	if(!dataString)
		return console.error("Failed to get data from localStorage");
	//console.log(dataString);
	var data = JSON.parse(dataString);
	//console.log(data);
	
	console.log(`url: ${url}`);
	console.log(`data:`);
	console.log(data);
	
	$.post( url, data, function( res, status ){
		var cardType;
		
		switch( res.status ){
			case 200:
				cardType = "good"; break;
			case 500:
				cardType = "bad"; break;
		}
		console.log(res);
		
		createNotificationCard( res.message, cardType );
		
		callback(null);
	}).fail(function(){
		console.warn("failed");
		createNotificationCard("Failed to send data. Attempting to re-submit...", "warn");
		setTimeout(function(){
			submitData(url, dataKey, callback, indexOfLS);
		}, 2000);
	});
	
}

function getToSubmit(){
	return JSON.parse(localStorage.getItem('toSubmit'));
}

function setToSubmit( array ){
	localStorage.setItem("toSubmit", JSON.stringify(array) );
}