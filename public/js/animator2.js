/**
*	Animator2.js
*	Coded by Jordan Lees: February 2017
*/

var animator;

function turnToggleOn(){
	//turns toggle on
	animator.stopAnimating();
	localStorage.setItem("animation", false);
	this.innerText = "Turn animation on";
	this.onclick = turnToggleOff;
}

function turnToggleOff(){
	//turns toggle off
	animator.init();
	localStorage.setItem("animation", true);
	this.innerText = "Turn animation off";	
	this.onclick = turnToggleOn;
}

if($){
	$(function(){
		
		animator = new Animator();
		
		if(window.innerWidth <= 600){
			localStorage.setItem("animation", "false");
		}
		
		if(localStorage.getItem("animation") != "false"){
			
			animator.init();
			localStorage.setItem("animation", true);
			animator.toggle.innerText = "Turn animation off";
			
			//Sets toggle to turn animation on.
			animator.toggle.onclick = turnToggleOn;
		
		}else{
			//Sets toggle to turn animation off.
			animator.toggle.onclick = turnToggleOff;
			//Animator's innertext is default 'turn animation on'
		}
		
		animator.toggle.style.top = window.innerHeight - 25 + "px";
		document.body.append(animator.toggle);
		
		var resizeTimer;
		$(window).on('resize', function() {
			//resize just happened, pixels changed
			
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(function() {
				
				//fix sizes of everything
				//animator.toggle.style.top = window.innerHeight - 25 + "px"; i don't like this when keyboard pops up on mobile
				if(localStorage.getItem("animation") != "false"){					
					animator.stopAnimating();
					animator.init();
				}
					
			}, 250);
		});
	});
	
}else{
	console.log("Error: JQuery is not running properly.");
};

var Animator = function(){
	
	console.log("Initializing Pixel Animator.");
	
	//this.canv;
	var width, height;
	var ctx, tileSize, tilesX, tilesY;
	var firstColor, lastColor, firstLineColor, lastLineColor;

	var stop = false;
	var frameCount = 0;
	var fps, fpsInterval, startTime, now, then, elapsed;
	fps = 15;

	this.toggle = document.createElement("p");
	this.toggle.innerText = "Turn animation on";
	this.toggle.style.opacity = "0.15";
	this.toggle.style.cursor = "pointer";
	this.toggle.style.position = "fixed";
	this.toggle.style.margin = "0px";
	
	this.init = function(){
		
		this.canv = document.createElement("canvas");
		document.body.appendChild(this.canv);
		
		width = window.innerWidth;
		height = window.innerHeight;
		this.canv.width = width;
		this.canv.height = height;
		
		ctx = this.canv.getContext("2d");


		tileSize = 25;
		tilesX = Math.floor(width / tileSize) + 1;
		tilesY = Math.floor(height / tileSize) + 1;

		firstColor = [30,30,35];
		lastColor = [42,42,55];
		firstLineColor = firstColor;//[15,15,15];
		lastLineColor = [0,0,0];
		
		notAnimating = false;
		
		this.startAnimating(fps);
		
	}
	
	this.stopAnimating = function(){
		
		notAnimating = true;

		try{
			document.body.removeChild(this.canv);
		}catch(l){}	
	}

	this.startAnimating = function(fps) {
				
		fpsInterval = 1000 / fps;
		then = Date.now();
		startTime = then;
		animate();
	}

	var animate = function() {

		// request another frame

		requestAnimationFrame(animate);

		// calc elapsed time since last loop

		now = Date.now();
		elapsed = now - then;

		// if enough time has elapsed, draw the next frame

		if (elapsed > fpsInterval && notAnimating == false) {

			// Get ready for next frame by setting then=now, but also adjust for your
			// specified fpsInterval not being a multiple of RAF's interval (16.7ms)
			then = now - (elapsed % fpsInterval);

			// Put your drawing code here
			var time = Date.now();
			
			for(var i = 0; i < tilesX; i++){
				for(var j = 0; j < tilesY; j++){
					
					var color = lerpColor(firstColor, lastColor, 
						Math.pow(Math.sin(((tilesX/30)*time+((tilesX-i)*j-j))/(45*tilesX)),8)
					);
					var lineColor = lerpColor(firstLineColor, lastLineColor, 
						Math.pow(Math.sin(((tilesX/30)*time+((tilesX-i)*j-j))/(45*tilesX)),8)
					);
					drawTile(i,j,color,lineColor);
				}
			}
		}
	}

	var lerpColor = function(c1, c2, i){
		var r = Math.floor(lerp(c1[0], c2[0], i));
		var g = Math.floor(lerp(c1[1], c2[1], i));
		var b = Math.floor(lerp(c1[2], c2[2], i));
		return("rgb("+r+","+g+","+b+")")
	}		

	var lerp = function(a, b, i){
		//return (a * (1.0 - i)) + (b * i);
		return a + i * (b - a);
	}
	
	var drawTile = function(x, y, color, lineColor){

		ctx.fillStyle = color;
		ctx.strokeStyle = lineColor;
		ctx.lineWidth = 2;
		ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
		ctx.strokeRect(x*tileSize, y*tileSize, tileSize, tileSize)
	}			
}