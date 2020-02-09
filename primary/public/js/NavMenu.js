var navMenu;

$(() => {
	navMenu = new NavigationBar();
})


class NavigationBar{
	
	constructor(){
		//Options and ID names are hard-coded. I'm not THAT much of a masochist!
		this.opts = {
			openingInterval: 25,
			fastTransitionTime: 200,
			slowTransitionTime: 400,
			slowTransition: "cubic-bezier(0.22, 0.61, 0.36, 1)",
			fastTransition: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
			panThreshold: 30,
		}
		this.opened = false;
		this.moving = false;
		this.panning = false;
		this.pendingAnimationFrame = false;
		
		this.menuElem = $("#menu");
		this.barElem = $("#headerbar");
		
		if (navbarTitle) this.title = navbarTitle;
		else this.title = "Menu"
		
		this.menu = new Mmenu('#menu',
		{
			slidingSubmenus: false,
			navbar: {
				title: this.title,
			},
			offCanvas: false,
			extensions: {
				//"(max-width: 400px)": ["fullscreen"],
				"all": ["border-full"],
			},
		}, { });
		
		this.api = this.menu.API;
		//Move element into parent body
		this.menuElem.detach().appendTo(document.body);
		//Set up event handlers
		this.eventHandlers();
	}
	
	eventHandlers(){
		
		//Our main toggle boi
		$("#burger").click(() => {
			
			console.log("Burger has been clicked");
			
			if (!this.opened && !this.moving) {
				//Run pre-opening sequence
				this.preMenuOpen();
				//Run main opening sequence after interval
				setTimeout(() => {
					this.menuOpen();
				}, this.opts.openingInterval);
			}
			else if (!this.moving) {
				//run pre-closing sequence
				this.preMenuClose();
				//run main closing sequence after interval
				setTimeout(() => {
					this.menuClose();
				}, this.opts.openingInterval);
			}
		});
		
		//When page is clicked, close menu
		$("#page").click(() => {
			
			if (this.opened && !this.moving) {
				//run pre-closing sequence
				this.preMenuClose();
				//run main closing sequence after interval
				setTimeout(() => {
					this.menuClose();
				}, this.opts.openingInterval);
			}
		})
		
		/*
		//Hammer.js - Native-like touch interfaces
		var hammertime = new Hammer.Manager(document.body, {
			recognizers: [
				[Hammer.Swipe,{ direction: Hammer.DIRECTION_HORIZONTAL }],
				[Hammer.Pan,{ direction: Hammer.DIRECTION_HORIZONTAL }],
			]
		});
		//Swipe right to open menu
		hammertime.on('swiperight', (ev) => {
			console.log("Hammertime swiperight occurred");
			if (!this.opened && !this.moving) {
				//Run pre-opening sequence
				this.preMenuOpen();
				//Run main opening sequence after interval
				setTimeout(() => {
					this.menuOpen();
				}, this.opts.openingInterval);
			}
		});
		//Swipe left to close menu
		hammertime.on('swipeleft', (ev) => {
			console.log("Hammertime swipeleft occurred");
			if (this.opened && !this.moving) {
				//run pre-closing sequence
				this.preMenuClose();
				//run main closing sequence after interval
				setTimeout(() => {
					this.menuClose();
				}, this.opts.openingInterval);
			}
		});
		
		hammertime.on('panend', (ev) => {
			console.log('Hammertime panend');
			this.panning = false;
			
			//Add fast transition timings
			this.menuElem.css({
				transition: `${this.opts.fastTransitionTime}ms ${this.opts.fastTransition}`,
			});
			this.barElem.css({
				transition: `${this.opts.fastTransitionTime}ms ${this.opts.fastTransition}`,
			});
			
			//When pan ends, if the menu is over a threshold we open it; if it's lower then we close it
			var menuWidth = (window.innerWidth < 550) ? window.innerWidth * .8 : 440;
			var percentageOpened = ev.center.x / menuWidth;
			
			console.log(`menuWidth: ${menuWidth} percOpened: ${percentageOpened}`);
			setTimeout(() => {
				
				//if greater than threshold, open menu
				if (percentageOpened > 0.5) {
					this.menuOpen();
				}
				//if lower than threshold, close menu
				else {
					this.menuClose();
				}
			}, this.opts.openingInterval);
		});
		
		hammertime.on('pan', (ev) => {
			//If menu is open, then enable panning
			if (this.opened) {
				this.panning = true;
			}
			//If user has panned enough to the right, start panning
			if (ev.deltaX > this.opts.panThreshold) {
				
				if (!this.opened && !this.panning) {
					//Run pre-open sequence
					this.preMenuOpen();
					//Override timings to be fast
					this.menuElem.css({
						display: 'block',
						transition: `${this.opts.fastTransitionTime}ms ${this.opts.fastTransition}`,
					});
					this.barElem.css({
						transition: `${this.opts.fastTransitionTime}ms ${this.opts.fastTransition}`,
					});
					setTimeout(() => {
						
						//menuWidth to calculate percentageOpened
						var menuWidth = (window.innerWidth < 550) ? window.innerWidth * .8 : 440;
						
						var percentageOpened = ev.center.x / menuWidth;
						var positions = this.calculateTransformPosition(percentageOpened);
						
						//apply css to menu element and bar element
						requestAnimationFrame(() => {
							this.menuElem.css({
								transform: `translate3d(${positions.menu}, 0, 0)`,
							});
							this.barElem.css({
								transform: `translate3d(${positions.bar}, 0, 0)`,
							});
							setTimeout(() => {
								//enable regular panning
								this.panning = true;
								//remove transition timings after transition
								this.menuElem.css({
									transition: '',
								});
								this.barElem.css({
									transition: '',
								});
							}, this.opts.fastTransition);
						});
					}, this.opts.openingInterval);
				}
			}
			//if regular panning is now enabled
			if (this.panning) {
				//Only animate menu bar if an animation frame is not pending
				if (!this.pendingAnimationFrame) {
					//menuWidth to calculate percentageOpened
					var menuWidth = (window.innerWidth < 550) ? window.innerWidth * .8 : 440;
					//Calculate percentageOpened
					var percentageOpened = ev.center.x / menuWidth;
					var positions = this.calculateTransformPosition(percentageOpened);
					
					this.pendingAnimationFrame = true;
					//Animate menu/bar positions
					requestAnimationFrame(() => {
						this.pendingAnimationFrame = false;
						this.menuElem.css({
							display: 'block',
							transform: `translate3d(${positions.menu}, 0, 0)`,
						});
						this.barElem.css({
							transform: `translate3d(${positions.bar}, 0, 0)`,
						});
					});
				}
			}
		});
		*/
	}

	preMenuOpen(){
		console.log('preMenuOpen');
		
		const positions = this.calculateTransformPosition(0);
		
		this.menuElem.css({
			display: 'block',
			transform: `translate3d(${positions.menu}, 0, 0)`,
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
		this.barElem.css({
			transform: `translate3d(${positions.bar}, 0, 0)`,
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
	}
	
	menuOpen(){
		console.log('menuOpen');
		
		this.moving = true;
		
		const positions = this.calculateTransformPosition(1);
		
		requestAnimationFrame(() => {
			this.menuElem.css({
				transform: `translate3d(${positions.menu}, 0, 0)`,
			});
			this.barElem.css({
				transform: `translate3d(${positions.bar}, 0, 0)`,
			});
		});
		
		//Add class for mburger to animate opening
		$("#burger").addClass("mm-wrapper_opened");
		
		setTimeout(() => {
			this.postMenuOpen();
		}, this.opts.slowTransitionTime);
	}
	
	postMenuOpen(){
		console.log('postMenuOpen');
		
		this.opened = true;
		this.moving = false;
	}
	
	preMenuClose(){
		console.log('preMenuClose');
		
		this.menuElem.css({
			transition: `${this.opts.slowTransitionTime}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
		});
		this.barElem.css({
			transition: `${this.opts.slowTransitionTime}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
		});
	}
	
	menuClose(){
		console.log('menuClose');
		
		this.moving = true;
		
		const positions = this.calculateTransformPosition(0);
		
		requestAnimationFrame(() => {
			this.menuElem.css({
				transform: `translate3d(${positions.menu}, 0, 0)`,
			});
			this.barElem.css({
				transform: `translate3d(${positions.bar}, 0, 0)`,
			});
		});
		
		//Remove class for mburger to animate closing
		$("#burger").removeClass("mm-wrapper_opened");
		
		
		setTimeout(() => {
			this.postMenuClose();
		}, this.opts.slowTransitionTime);
	}
	
	postMenuClose(){
		console.log('postMenuClose');
		
		this.opened = false;
		this.moving = false;
		
		this.menuElem.css({
			display: 'none',
			transform: '',
			transition: '',
		});
		this.barElem.css({
			transform: '',
			transition: '',
		});
	}
	
	calculateTransformPosition(percentageOpened){
		//filter percentageOpened to not be greater than 1 or less than 0
		if (percentageOpened > 1) percentageOpened = 1;
		if (percentageOpened < 0) percentageOpened = 0;
		
		const windowWidth = window.innerWidth;
		const positions = {};
		var menuWidth;
		
		//If 80% of the screen is lower than 440px, use percentages instead of pixels
		if (windowWidth < 550) {
			positions.menu = -80 * (1 - percentageOpened) + 'vw';
			positions.bar = 80 * percentageOpened + 'vw';
		}
		//if 80% of screen is greater than 440px, use pixels
		else {
			positions.menu = Math.floor( (1- percentageOpened) * -440) + 'px', 
			positions.bar = Math.floor( (percentageOpened) * 440) + 'px'
		}
		
		//console.log(`calculateTransformPosition: menu: ${positions.menu} bar: ${positions.bar}`);
		
		return positions;
	}
}