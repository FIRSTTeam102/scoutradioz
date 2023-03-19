// These variables are created in the pug view
declare let stickyBarEnabled: boolean;
declare let headerList: Array<string>;

$(function () {
	
	$('#toggleStickyToggle').addClass('animate');
	
	$('#toggleSticky').on('change', () => {
		let enabled = $('#toggleSticky').prop('checked');
		stickyBarEnabled = enabled;
		if (enabled) {
			// Show the sticky bar
			$('#stickyBar').show().css('bottom', -60).animate({
				'bottom': 0
			}, 200);
			// Save the fact that it's enabled
			localStorage.removeItem('disableStickyBar');
		}
		else {
			// Hide the sticky bar
			$('#stickyBar').animate({
				'bottom': -60
			}, 200);
			// Clear the "disabled-form" class from all elements
			$('.disabled-form').removeClass('disabled-form').removeAttr('disabled')
				.find('input, button').removeAttr('disabled'); // and its children which are inputs
			// Save the fact that it's disabled
			localStorage.setItem('disableStickyBar', '1');
		}
	});
	
	//- Get a list of all the header elements, to use for scrolling
	let headerElements: Array<HTMLElement> = [];
	for (let label of headerList) {
		let thisHeader = $(`#${label}`);
		if (thisHeader[0]) headerElements.push(thisHeader[0]);
	}
				
	const stickyBarTitle = $('#stickyBarTitle');
	const stickyBarLeft  = $('#stickyBarLeft');
	const stickyBarRight = $('#stickyBarRight');
	
	const matchform = $('#matchform');
	
	let currentHeaderID = '';
	
	handleScroll();
				
	let ticking = false;
	$(window).on('scroll', () => {
		if (!ticking) {
			requestAnimationFrame(() => {
				handleScroll();
				ticking = false;
			});
		}
		ticking = true;
	});
	
			
	function handleScroll() {
		if (!stickyBarEnabled) return;
		
		const centerX = window.innerWidth / 2;
		const centerY = window.innerHeight * 2/3;
		
		let centerDiv;
		// sometimes gap between elements causes the elementfrompoint to be a parent element
		for (let i = 0; i < 10; i++) {
			centerDiv = document.elementFromPoint(centerX, centerY - i * 4);
			if (centerDiv && matchform.has(centerDiv).length) {
				break;
			}
		}
		if (!centerDiv) {
			console.error('Could not find a center div!');
			return;
		}
		
		// Find the "root" form element so we can iterate across siblings
		let attemptsRemaining = 20; // to avoid infinite loop, just in case
		while (centerDiv.parentElement && !matchform.is(centerDiv.parentElement) && attemptsRemaining > 0) {
			centerDiv = centerDiv.parentElement;
			attemptsRemaining--;
		}
		
		// Loop backwards until we find a header element
		let thisElement = centerDiv;
		attemptsRemaining = 50; // if someone has a group of form elements that's 50 long, they've got problems.
		let headerInMiddle: HTMLElement|null = null;
		while (thisElement instanceof HTMLElement && !headerInMiddle && attemptsRemaining > 0) {
			// test if this element is a header
			if (headerElements.includes(thisElement)) {
				headerInMiddle = thisElement; // we found our winner
				break;
			}
			thisElement = thisElement.previousElementSibling as HTMLElement; // proceed
			attemptsRemaining--;
		}
		
		if (!headerInMiddle) {
			console.log(attemptsRemaining);
			console.error('Could not find a header in the middle!');
			return;
		}
		
		let header = headerInMiddle;
		
		// Special case: Scrolled all the way down in the page, just set the very last header to active
		let diff = Math.abs(scrollY + innerHeight - document.body.offsetHeight);
		if (diff < 10) {
			console.log('Within 10 px of bottom of screen; setting last header to active');
			header = headerElements[headerElements.length - 1];
		}
		
		if (currentHeaderID !== header.id) {
			setStickyBar(header.id, header.innerText);
		}
		
		// Old code backup: Simply find the first visible header element
		// for (let header of headerElements) {
		// 	let isVisible = checkVisible(header);
		// 	if (isVisible) {
		// 		//- Only update the sticky bar when it needs to change
		// 		if (currentHeaderID !== header.id) {
		// 			setStickyBar(header.id, header.innerText);
		// 		}
		// 		break;
		// 	}
		// }
	}
	
	/**
	 * Set the sticky bar text.
	 * @param id string
	 * @param text string
	 */
	function setStickyBar(id: string, text: string) {
		let st = performance.now();
		stickyBarTitle.text(text);
		currentHeaderID = id;
					
		//- Now, update the visibility of the elements under the OTHER headers
		for (let i = 0; i < headerElements.length; i++) {
			let header = headerElements[i];
			let nextHeader = headerElements[i + 1];
			let thisSibling = header.nextElementSibling;
						
			if (header.id === id) {
				header.classList.remove('disabled-form');
				while(thisSibling && thisSibling !== nextHeader) {
					thisSibling.classList.remove('disabled-form');
					// Attempt to un-disable an input element within the sibling; also un-disable the sibling itself
					let thisSibInputs = thisSibling.querySelectorAll('input, button');
					// if (thisSiblingInput) thisSiblingInput.disabled = false;
					if (thisSibInputs) thisSibInputs.forEach(itm => itm.disabled = false);
					else thisSibling.disabled = false;
					thisSibling = thisSibling.nextElementSibling;
				}
			}
			else {
				header.classList.add('disabled-form');
				while(thisSibling && thisSibling !== nextHeader) {
					thisSibling.classList.add('disabled-form');
					// Attempt to disable an input element within the sibling; also disable the sibling itself
					let thisSibInputs = thisSibling.querySelectorAll('input, button');
					if (thisSibInputs) thisSibInputs.forEach(itm => itm.disabled = true);
					else thisSibling.disabled = true;
					thisSibling = thisSibling.nextElementSibling;
				}
			}
		}
		console.log(performance.now() - st);
	}
				
	stickyBarLeft.on('click', () => {
		let currentHeader = document.getElementById(currentHeaderID);
		if (!currentHeader) throw new Error(`Header ${currentHeaderID} not found`);
		
		let index = headerElements.indexOf(currentHeader);
		let prevHeader = headerElements[index - 1];
		if (prevHeader) {
			window.scrollToId('dynamicscroll_' + prevHeader.id);
		}
	});
				
	stickyBarRight.on('click', () => {
		let currentHeader = document.getElementById(currentHeaderID);
		if (!currentHeader) throw new Error(`Header ${currentHeaderID} not found`);
		
		let index = headerElements.indexOf(currentHeader);
		let nextHeader = headerElements[index + 1];
		if (nextHeader) {
			window.scrollToId('dynamicscroll_' + nextHeader.id);
		}
	});
				
	//- Just some visual flourish for the icons
	stickyBarLeft.on('mousedown', fancyMouseDown);
	stickyBarLeft.on('touchstart', fancyMouseDown);
	stickyBarRight.on('mousedown', fancyMouseDown);
	stickyBarRight.on('touchstart', fancyMouseDown);
	stickyBarLeft.on('mouseup', fancyMouseUp);
	stickyBarLeft.on('touchend', fancyMouseUp);
	stickyBarRight.on('mouseup', fancyMouseUp);
	stickyBarRight.on('touchend', fancyMouseUp);
				
	function fancyMouseDown(this: HTMLElement) {
		$(this).css({
			top: 2,
			left: 2,
		});
	}
	function fancyMouseUp(this: HTMLElement) {
		$(this).css({
			top: '',
			left: '',
		});
	}
				
	//- Credit: https://stackoverflow.com/questions/5353934/check-if-element-is-visible-on-screen
	function checkVisible(elem: HTMLElement) {
		let rect = elem.getBoundingClientRect();
		let viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
		return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
	}
				
	window.onResize(() => {
		if (!stickyBarEnabled) return;
		
		// - The text is centered at a fixed size, but we want to make sure the text is visible even on small screens.
		let triLeft = $('#stickyBarLeft')[0];
		let text = $('#stickyBarTitle')[0];
		const OFFSET = -8; // the buttons have a lot of padding; allowing a bit of overlap
					
		text.style.fontSize = '1em';
		let triRect = triLeft.getBoundingClientRect();
		//- This just loops from 1 to 10 and iteratively reduces the font size until it fits without overlapping the triangle icons.
		let iterations = 0, textSize = 1;
		while (iterations < 10 && text.getBoundingClientRect().left < triRect.right + OFFSET) {
			textSize -= 0.05;
			text.style.fontSize = textSize + 'em';
			iterations++;
		}
	});

});

$(function(){
	
	$('#submit').on('click', function(){
		
		// JL: Disabled inputs are only for visual assistance in dynamic scrolling, but they might be ignored in the form submission if they remain disabled
		$('input[disabled]').removeAttr('disabled'); 
		
		let matchForm = $('form[name=matchform]');
		
		let matchSubmission = new FormSubmission(matchForm, '/scouting/match/submit', 'matchScouting');
		
		matchSubmission.submit((err, response) => {
			if (err || !response || !response.message) {
				NotificationCard.error('An error occurred. Please retry.');
			}
			else{
				let message = response.message;
				NotificationCard.show(message, {darken: true, type: 'good', ttl: 0});
				
				// 2022-03-24 JL: Send assigned scouters back to dashboard, send unassigned scouters back to dashboard/matches 
				let newHref = (response.assigned) ? '/dashboard' : '/dashboard/matches';
				
				setTimeout(() => {
					window.onbeforeunload = null;
					window.location.href = newHref;
				}, 1000);
			}
		});
	});
		
	window.onbeforeunload = function() {
		return 'Leaving this page will lose match scouting data.';
	};
	
});

// Again because JQuery typing is dumb
interface Element {
	disabled: boolean;
}

interface SRResponse {
	assigned: boolean;
}