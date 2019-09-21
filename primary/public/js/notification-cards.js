if(!$){
	console.error("notification-cards error: jQuery not enabled");
}

function createNotificationCard( text, type ){
	
	var color;
	
	switch( type ){
		case "bad": 
			color = "theme-red";
			break;
		case "warn":
			color = "w3-amber";
			break;
		case "good":
			color = "gear-blue";
			break;
		case "102":
			color = "theme-link";
			break;
		default:
			color = "gear-white";
			 break;
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
	}, 800);
	
	setTimeout( function(){
		$("#notification-card").remove();
	}, 5000);
	
}





