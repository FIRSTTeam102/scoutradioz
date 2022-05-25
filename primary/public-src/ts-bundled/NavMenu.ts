'use strict';
var navMenu;

$(() => {
	navMenu = new NavigationBar();
});


class NavigationBar{
	
	opened: boolean;
	moving: boolean;
	panning: boolean;
	pendingAnimationFrame: boolean;
	menuElem: JQuery;
	barElem: JQuery;
	overlayElem: JQuery;
	title: string;
	footerContents: Array<string>;
	locales: Array<Locale>;
	opts: {
		openingInterval: number,
		fastTransitionTime: number,
		slowTransitionTime: number,
		slowTransition: string,
		fastTransition: string,
		panThreshold: number,
	}
	// mmenu.js doesn't provide a typescript version; Not gonna bother updating the mmenu minified js to typescript
	menu: any;
	api: any;
	
	constructor(){
		//Options and ID names are hard-coded. I'm not THAT much of a masochist!
		this.opts = {
			openingInterval: 25,
			fastTransitionTime: 200,
			slowTransitionTime: 400,
			slowTransition: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
			fastTransition: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
			panThreshold: 30,
		};
		//Options
		this.opened = false;
		this.moving = false;
		this.panning = false;
		this.pendingAnimationFrame = false;
		//Related DOM elements
		this.menuElem = $('#menu');
		this.barElem = $('#headerbar');
		this.overlayElem = $('#overlay');

		//Take menu title & footer branding variables from inline script in nav.pug		
		if (typeof navMenuTitle === 'string') this.title = navMenuTitle;
		else this.title = 'Menu';
		if (footerContents instanceof Array) this.footerContents = footerContents;
		else this.footerContents = [];
		if (locales instanceof Array) this.locales = locales;
		else this.locales = [];

		var currentLang = document.documentElement.lang || 'en';
		//Create Mmenu object
		this.menu = new Mmenu('#menu',
			{
			//navbar title
				navbar: {
					title: this.title,
				},
				//ON-canvas menu (We're handling all the sliding stuff)
				offCanvas: false,
				//Number counters on subpanels
				counters: true,
				//Changes border-lines to fill the whole panel
				extensions: {
					'all': ['border-full'],
				},
				navbars: [
					// Locale selector (locales is set in nav.pug)
					{
						use: this.locales.length > 0, // only show when there are multiple locales
						position: 'bottom',
						content: `<select id="localeSelector">${this.locales.map(locale => `<option ${locale.lang === currentLang ? 'selected' : ''} value="${locale.lang}" lang="${locale.lang}">${locale.name}</option>`)}</select>`
					},
					//Branding on bottom of menu (footerContents is set in nav.pug)
					{
						position: 'bottom',
						content: this.footerContents,
					}
				],
			}, {
				// mmenu has its own internal translations
				language: currentLang
			});
		
		this.api = this.menu.API;
		//Move element into parent body
		this.menuElem.detach().appendTo(document.body);
		//Set up event handlers
		this.eventHandlers();
	}
	
	eventHandlers(){
		
		//Our main toggle boi
		$('#burger').click(() => {
			
			//console.log("Burger has been clicked");
			//If menu is fully closed
			if (!this.opened && !this.moving) {
				//Run pre-opening sequence
				this.preMenuOpen();
				//Run main opening sequence after interval
				setTimeout(() => {
					this.menuOpen();
				}, this.opts.openingInterval);
			}
			//If menu is fully opened
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
		$('#page').click(() => {
			//If menu is fully opened
			if (this.opened && !this.moving) {
				//run pre-closing sequence
				this.preMenuClose();
				//run main closing sequence after interval
				setTimeout(() => {
					this.menuClose();
				}, this.opts.openingInterval);
			}
		});
		
		// Locale selector
		$('#localeSelector').on('change', (e) => {
			var newLang = (e.target as HTMLSelectElement).value;
			Cookies.set('language', newLang);
			location.reload();
		});
	}
	
	preMenuOpen(){
		//console.log('preMenuOpen');
		//Get fully-closed positions
		const positions = this.calculateTransformPosition(0);
		//Menu element: Make visible, place off-canvas way to the left, set transition time
		this.menuElem.css({
			display: 'flex',
			transform: `translate3d(${positions.menu}, 0, 0)`,
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
		//Bar element: Set transition time
		this.barElem.css({
			transform: `translate3d(${positions.bar}, 0, 0)`,
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
		//Overlay: Make visible, 0 opacity, set transition time
		this.overlayElem.css({
			display: 'flex',
			opacity: 0,
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
	}
	
	menuOpen(){
		//console.log('menuOpen');
		
		this.moving = true;
		//Get fully-opened positions
		const positions = this.calculateTransformPosition(1);
		
		requestAnimationFrame(() => {
			//Menu element: Ending position
			this.menuElem.css({
				transform: `translate3d(${positions.menu}, 0, 0)`,
			});
			//Bar element: Ending position
			this.barElem.css({
				transform: `translate3d(${positions.bar}, 0, 0)`,
			});
			//Overlay element: Full opacity
			this.overlayElem.css({
				opacity: 1,
			});
		});
		
		//Add class for mburger to animate opening
		$('#burger').addClass('mm-wrapper_opened');
		//Call postMenuOpen after full opening interval
		setTimeout(() => {
			this.postMenuOpen();
		}, this.opts.slowTransitionTime);
	}
	
	postMenuOpen(){
		//console.log('postMenuOpen');
		//Menu is now fully open
		this.opened = true;
		this.moving = false;
	}
	
	preMenuClose(){
		//console.log('preMenuClose');
		//Set transition for all elements
		this.menuElem.css({
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
		this.barElem.css({
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
		this.overlayElem.css({
			transition: `${this.opts.slowTransitionTime}ms ${this.opts.slowTransition}`,
		});
	}
	
	menuClose(){
		// console.log('menuClose');
		
		this.moving = true;
		//Get final positions
		const positions = this.calculateTransformPosition(0);
		
		requestAnimationFrame(() => {
			//Menu element: Ending position
			this.menuElem.css({
				transform: `translate3d(${positions.menu}, 0, 0)`,
			});
			//Bar element: Ending position
			this.barElem.css({
				transform: `translate3d(${positions.bar}, 0, 0)`,
			});
			//Overlay: element: Fully transparent
			this.overlayElem.css({
				opacity: 0,
			});
		});
		
		//Remove class for mburger to animate closing
		$('#burger').removeClass('mm-wrapper_opened');
		//Call postMenuClose after full closing interval
		setTimeout(() => {
			this.postMenuClose();
		}, this.opts.slowTransitionTime);
	}
	
	postMenuClose(){
		//console.log('postMenuClose');
		
		this.opened = false;
		this.moving = false;
		//Menu element: Reset transition and position, and set display:none
		this.menuElem.css({
			display: 'none',
			transform: '',
			transition: '',
		});
		//Bar element: Reset transform and position
		this.barElem.css({
			transform: '',
			transition: '',
		});
		//Overlay element: Reset transform and position
		this.overlayElem.css({
			opacity: '',
			display: 'none',
		});
	}
	
	calculateTransformPosition(percentageOpened: number): TransformPosition{
		//filter percentageOpened to not be greater than 1 or less than 0
		if (percentageOpened > 1) percentageOpened = 1;
		if (percentageOpened < 0) percentageOpened = 0;
		
		const windowWidth = window.innerWidth;
		const isRTL = document.dir === 'rtl';
		var positions: {
			menu: number;
			bar: number;
		}, unit: string;
		
		//If 80% of the screen is lower than 440px, use percentages instead of pixels
		if (windowWidth < 550) {
			positions = {
				menu: -80 * (1 - percentageOpened),
				bar: 80 * percentageOpened
			}
			unit = 'vw'
		}
		//if 80% of screen is greater than 440px, use pixels
		else {
			positions = {
				menu: Math.floor( (1- percentageOpened) * -440),
				bar: Math.floor( (percentageOpened) * 440)
			}
			unit = 'px';
		}

		if (isRTL) {
			positions.menu *= -1;
			positions.bar *= -1;
		}

		return {
			menu: positions.menu + unit,
			bar: positions.bar + unit
		};
	}
}

declare class TransformPosition {
	menu: string;
	bar: string;
}

interface Locale {
	lang: string;
	name: string;
	dir: 'ltr' | 'rtl';
}

// Initialized in pug
declare var navMenuTitle: string | undefined;
declare var footerContents: Array<string> | undefined;
declare var locales: Array<Locale> | undefined;
declare var Mmenu: any;

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
				
				//if greater than threshold
				if (percentageOpened > 0.5) {
					//only move if already paning
					if (this.panning) {
						this.menuOpen();
					}
				}
				//if lower than threshold
				else {
					//only move if panning
					if (this.panning) {
						this.menuClose();
					}
				}
				
				this.panning = false;
				
			}, this.opts.openingInterval);
		});
		
		hammertime.on('pan', (ev) => {
			//If menu is open, then enable panning
			if (this.opened && !this.moving) {
				this.panning = true;
			}
			//If user has panned enough to the right, start panning
			if (ev.deltaX > this.opts.panThreshold) {
				
				if (!this.opened && !this.moving && !this.panning) {
					//Run pre-open sequence
					this.preMenuOpen();
					//Override timings to be fast
					this.menuElem.css({
						display: 'flex',
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
			if (this.panning && !this.moving) {
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
							display: 'flex',
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