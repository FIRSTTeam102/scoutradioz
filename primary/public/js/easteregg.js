$(function(){
	
	$("h3").click(function(){
		if( $(this).text() == "Sandstorm" ){
			//do easter egg
			doEasterEgg();
		}
	});
});

function doEasterEgg(){
	
	if( !$("#sandstormEgg")[0] ){
		var audio = document.createElement("audio");
		var source = document.createElement("source");
		$(audio).attr("id", "sandstormEgg");
		$(source).attr("src", "/darude_sandstorm.mp3");
		$(source).attr("type", "audio/mpeg");
		$(audio).append(source);
		$(document.body).append(audio);
	}
	$("#sandstormEgg")[0].play();
}