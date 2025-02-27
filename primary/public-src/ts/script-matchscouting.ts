// These variables are created in the pug view
declare let stickyBarEnabled: boolean;
declare let groupedLayout: Array<{
	label: string;
	items: import('scoutradioz-types').SchemaItem[];
}>;

let sections = [] as Array<{
	elem: JQuery<HTMLElement>;
	label: string;
	rect: DOMRect;
	top: number;
	center: number;
}>;

$(function () {
	// disable blur when the page loads if it's been disabled before in this session
	if (sessionStorage.blurDisabled) {
		console.log('Disabling blur due to session variable');
		disableBlur();
	}

	$('#toggleStickyToggle').addClass('animate');

	$('#toggleSticky').on('change', () => {
		let enabled = $('#toggleSticky').prop('checked');
		stickyBarEnabled = enabled;
		if (enabled) {
			// Show the sticky bar
			$('#stickyBar').show().css('bottom', -60).animate(
				{
					bottom: 0,
				},
				200
			);
			// Save the fact that it's enabled
			localStorage.removeItem('disableStickyBar');
			requestAnimationFrame(handleScroll);
		}
		else {
			// Hide the sticky bar
			$('#stickyBar').animate(
				{
					bottom: -60,
				},
				200
			);
			// Clear the "disabled-form" class from all elements
			$('.disabled-form')
				.removeClass('disabled-form')
				.removeAttr('disabled')
				.find('input, button')
				.removeAttr('disabled'); // and its children which are inputs
			// Save the fact that it's disabled
			localStorage.setItem('disableStickyBar', '1');
			currentSectionIdx = -1;
		}
	});

	const stickyBarTitle = $('#stickyBarTitle');
	const stickyBarLeft = $('#stickyBarLeft');
	const stickyBarRight = $('#stickyBarRight');

	let currentSectionIdx = -1;

	let ticking = false;
	$(window).on('scroll', () => {
		if (!ticking) {
			// 2023-03-19 JL: Added a delay to scroll calculations to save on performance
			setTimeout(() => {
				requestAnimationFrame(() => {
					handleScroll();
					ticking = false;
				});
			}, 50);
			ticking = true;
		}
	});

	function lerp(t: number, a: number, b: number) {
		return (1 - t) * a + t * b;
	}

	function handleScroll() {
		if (!stickyBarEnabled) return console.log('not enabled');
		if (sections.length === 0) return console.error('Sections array is empty!');

		// Create a "target" that is usually in the center of the screen but semi-smoothly transitions
		// 	from the top of the screen at scroll 0 to the middle, and then from the middle to the bottom of
		// 	the screen, to prevent any sections from being missed while scrolling
		let scrollY = window.scrollY;
		let halfScreenHeight = window.innerHeight / 2;
		let centerOfScreen = window.scrollY + halfScreenHeight;
		let bufferZone = window.innerHeight / 3;
		let bufferZoneBelowBottom = document.body.offsetHeight - window.innerHeight - bufferZone;

		let targetY = centerOfScreen;
		if (scrollY < bufferZone) {
			let t = scrollY / bufferZone;
			targetY = lerp(Math.sqrt(t), 0, centerOfScreen);
		}
		if (scrollY > bufferZoneBelowBottom) {
			let t = (scrollY - bufferZoneBelowBottom) / bufferZone;
			targetY = lerp(Math.pow(t, 2), centerOfScreen, document.body.offsetHeight);
		}

		// Find the section whose center is closest to the calculated target
		let closestSection = 0;
		let closestDistance = 9999999;
		for (let i = 0; i < sections.length; i++) {
			let distance = Math.abs(targetY - sections[i].center);
			if (distance < closestDistance) {
				closestSection = i;
				closestDistance = distance;
			}
		}
		
		setSection(closestSection);
	}
	
	// For older devices that don't have the performance to handle blur
	function disableBlur() {
		$(':root').css({
			'--disabled-form-filter': 'none'
		});
	}

	function setSection(idx: number) {
		assert(sections[idx], new RangeError());
		if (currentSectionIdx === idx) return; // avoid unnecessary recalculations
		let st = performance.now();
		currentSectionIdx = idx;

		// Update the visibility of the elements 
		for (let i = 0; i < sections.length; i++) {
			if (idx === i) {
				sections[i].elem.removeClass('disabled-form');
				sections[i].elem.find('input, button').removeAttr('disabled');
			}
			else {
				sections[i].elem.addClass('disabled-form');
				sections[i].elem.find('input, button').attr('disabled', '');
			}
		}
		stickyBarTitle.text(sections[idx].label);
		// Check the time it takes to do the layout recalc
		if (!sessionStorage.blurDisabled) {
			let t2 = performance.now();
			document.body.offsetWidth;
			let t3 = performance.now();
			// if it takes a long time to do the recalc, disable blur
			if (t3 - t2 > 50) {
				console.log('Disabling blur');
				disableBlur();
				sessionStorage.blurDisabled = '1';
			}
		}
	}

	stickyBarLeft.on('click', () => {
		if (currentSectionIdx < 0) throw new RangeError('Current section not set!');
		let sectionToScrollTo = currentSectionIdx - 1;
		if (sectionToScrollTo < 0) sectionToScrollTo = 0; // in this case, just scroll to the top of the first section
		let section = sections[sectionToScrollTo];
		window.scrollTo({
			// Scroll such that the center of the section is in the middle of the screen.
			// JL note: This seems to work with the match form I tested, but it might still not be perfect
			// 	depending on the size of the sections in the form. But it's at least a TON better than 
			// 	the previous implementation.
			top: section.center - window.innerHeight/2,
			behavior: 'smooth'
		});
	});

	stickyBarRight.on('click', () => {
		if (currentSectionIdx < 0) throw new RangeError('Current section not set!');
		let sectionToScrollTo = currentSectionIdx + 1;
		if (sectionToScrollTo >= sections.length) sectionToScrollTo = sections.length - 1; // in this case, just scroll to the top of the first section
		let section = sections[sectionToScrollTo];
		window.scrollTo({
			// JL note: see above.
			top: section.center - window.innerHeight/2,
			behavior: 'smooth'
		});
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
	
	function handleResize() {
		// Sections calculation needs to be done even if sticky bar is disabled
		let bodyRect = document.body.getBoundingClientRect(); // need to subtract bodyRect.top to get absolute position
		sections = [];
		for (let i = 0; i < groupedLayout.length; i++) {
			let section = $(`#group_${i}`);
			let rect = section[0].getBoundingClientRect();
			let top = rect.top - bodyRect.top;
			let center = top + rect.height / 2;
			let label = groupedLayout[i].label;
			// the group 0 section may contain no children, if so, ignore it
			if (section.children().length > 0) {
				sections.push({
					elem: section,
					label,
					rect,
					top,
					center,
				});
			}
		}
		// but we can skip the following code if sticky bar is disabled
		if (!stickyBarEnabled) return;
		handleScroll();

		// - The text is centered at a fixed size, but we want to make sure the text is visible even on small screens.
		let triLeft = $('#stickyBarLeft')[0];
		let text = $('#stickyBarTitle')[0];
		const OFFSET = -8; // the buttons have a lot of padding; allowing a bit of overlap

		text.style.fontSize = '1em';
		let triRect = triLeft.getBoundingClientRect();
		//- This just loops from 1 to 10 and iteratively reduces the font size until it fits without overlapping the triangle icons.
		let iterations = 0,
			textSize = 1;
		while (
			iterations < 10 &&
			text.getBoundingClientRect().left < triRect.right + OFFSET
		) {
			textSize -= 0.05;
			text.style.fontSize = textSize + 'em';
			iterations++;
		}

	}

	window.onResize(handleResize);
	// when team image loads, recalculate page size too
	$('img').on('load', handleResize);
});

$(function () {
	$('#submit').on('click', function () {
		// JL: Disabled inputs are only for visual assistance in dynamic scrolling, but they might be ignored in the form submission if they remain disabled
		$('input[disabled]').removeAttr('disabled');

		let matchForm = $('form[name=matchform]');

		let matchSubmission = new FormSubmission(
			matchForm,
			'/scouting/match/submit',
			'matchScouting'
		);

		matchSubmission.submit((err, response) => {
			if (err || !response) {
				let message = typeof err === 'string' ? err : 'An error occurred. Please retry.';
				NotificationCard.error(message);
			}
			else {
				let message = response.message;
				NotificationCard.show(message, { darken: true, type: 'good', ttl: 0 });

				// 2022-03-24 JL: Send assigned scouters back to dashboard, send unassigned scouters back to dashboard/matches
				let newHref = response.assigned ? '/dashboard' : '/dashboard/matches';

				setTimeout(() => {
					window.onbeforeunload = null;
					window.location.href = newHref;
				}, 1000);
			}
		});
	});

	// 2024-01-26 JL: Made the editform preview appear in a dialog window; in this case, location.href === 'about:srcdoc'
	// 	and we don't want onbeforeunload to fire in the sub window when changes don't matter
	if (this.location.href !== 'about:srcdoc') {
		window.onbeforeunload = function () {
			return 'Leaving this page will lose match scouting data.';
		};
	}
});

// Again because JQuery typing is dumb
interface SRResponse {
	assigned: boolean;
}
