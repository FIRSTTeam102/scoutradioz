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
		/*
		//if(indexOfLS){
			//console.log("indexofls exists");
			if(!indexOfLS)
				indexOfLS = 0;
			
			var toSubmit = get
			();
			//console.log(toSubmit);
			toSubmit.splice(indexOfLS,1);
			localStorage.setItem('toSubmit', JSON.stringify(toSubmit));
		//}
		*/
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
/*
function checkNeedSubmit(){
	
	var toSubmit = JSON.parse(localStorage.getItem('toSubmit'));
	if(!toSubmit)
		return null;
	
	for(var i = 0; i < toSubmit.length; i++){
		var url = toSubmit[i].url;
		var dataKey = toSubmit[i].dataKey;
		var callback = toSubmit[i].callback;
		createNotificationCard("Attempting to submit...");
		
		submitData( url, dataKey, callback, i );
	}
}
setTimeout( checkNeedSubmit, 300);
*/