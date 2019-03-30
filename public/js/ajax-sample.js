$(function(){
	
	$("#submit").on('click', function(){
		
		var data_text = $("#text").val();
		localStorage.setItem("ajaxsample-text", data_text); 
		
		submitData("/ajax-example/submit", {
			text: "ajaxsample-text"
		});
		
	});

});
