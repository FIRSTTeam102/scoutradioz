/* eslint-disable no-constant-condition */
/// <reference types="qunit"/>

interface Window {
	jQuery: JQueryStatic;
}

/** Document inside iframe */
let doc: Document;
/** Window inside iframe */
let wnd: Window;
/** JQuery `$` function inside the iframe. */
let $$: JQueryStatic;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const iframe: HTMLIFrameElement = document.getElementById('iframe');

function setIframeZoom() {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore -- JL note: zoom is non standard but works on chromium and it's just a nice-to-have
	if (iframe.contentDocument) iframe.contentDocument.body.style.zoom = '50%';
}

function setIframeSrc(src: string): Promise<void> {
	// const iframe: JQuery<HTMLIFrameElement> = $('#iframe');
	
	return new Promise((resolve) => {
		iframe.onload = () => {
			setIframeZoom();
			iframe.onload = setIframeZoom; // set it back to the default
			let iframeWindow = iframe.contentWindow;
			if (!iframeWindow) throw 'iframe window not defined';
			let iframeDocument = iframeWindow.document;
			if (!iframeDocument) throw 'iframe document not defined';
			wnd = iframeWindow;
			doc = iframeDocument;
			if (!iframeWindow.jQuery) throw 'iframe jquery not defined';
			$$ = iframeWindow.jQuery;
			resolve();
		};
		iframe.src = location.origin + src;
	});
}

function waitForIframeLoad(): Promise<void> {
	const iframe: JQuery<HTMLIFrameElement> = $('#iframe');
	
	return new Promise((resolve) => {
		iframe.on('load', () => {
			iframe.off('load');
			
			let iframeWindow = iframe[0].contentWindow;
			if (!iframeWindow) throw '';
			let iframeDocument = iframeWindow.document;
			if (!iframeDocument) throw '';
			wnd = iframeWindow;
			doc = iframeDocument;
			$$ = iframeWindow.jQuery;
			resolve();
		});
	});
}

/**
 * Resolves after the requested amount of time.
 */
function waitForMs(time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}

function queryTestAPI(path: string, data?: any): Promise<any> {
	if (!path.startsWith('/')) path = '/' + path;
	if (!data) data = {};
	
	return new Promise((resolve, reject) => {
		$.post(`/admin/tests${path}`, data)
			.done((data) => {
				resolve(data);
			})
			.fail((data) => {
				reject(data);
			});
	});
}

/**
 * Asserts that there is no element with id "errorContents" in the iframe document.
 */
function assertNoErrorContents(assert: typeof QUnit.assert) {
	assert.ok(!doc.getElementById('errorContents'));
}

// NOTE: elem.trigger('click') doesn't seem to work for `a` elements. Instead, do elem[0].click()

if (false) QUnit.module('switchorg', function () {
	QUnit.test('Switch org', async (assert) => {
		await setIframeSrc('/user/switchorg');
		assertNoErrorContents(assert);
		assert.equal(wnd.location.pathname, '/'); // Make sure switchorg sends the user to '/'
	});
	QUnit.test('selectOrg radio buttons', async (assert) => {
		await setIframeSrc('/user/switchorg');
		$$('#chbLearnMore').trigger('click').trigger('change');
		await waitForMs(20);
		assert.ok($$('#discordLink').is(':visible'), 'Discord link is visible');
		assert.false($$('#blurbViewData').is(':visible'), 'View Data blurb is not visible');
		assert.false($$('a[href="/demo/home"]').is(':visible'), 'Demo View Data link is not visible');
		assert.false($$('a[href="/selectorg-login?org_key=demo&rdr=/home"]').is(':visible'), 'Demo selectorg-login link is not visible');
		
		$$('#chbLoginScout').trigger('click').trigger('change');
		await waitForMs(20);
		assert.ok($$('a[href="/selectorg-login?org_key=demo&rdr=/home"]').is(':visible'), 'Demo selectorg-login link is visible');
		assert.false($$('#discordLink').is(':visible'), 'Discord link is not visible');
		assert.false($$('#blurbViewData').is(':visible'), 'View Data blurb is not visible');
		assert.false($$('a[href="/demo/home"]').is(':visible'), 'Demo View Data link is not visible');
		
		$$('#chbViewData').trigger('click').trigger('change');
		await waitForMs(20);
		assert.ok($$('a[href="/demo/home"]').is(':visible'), 'Demo View Data link is visible');
		assert.ok($$('#blurbViewData').is(':visible'), 'View Data blurb is visible');
		assert.false($$('a[href="/selectorg-login?org_key=demo&rdr=/home"]').is(':visible'), 'Demo selectorg-login link is not visible');
		assert.false($$('#discordLink').is(':visible'), 'Discord link is not visible');
	});
	QUnit.test('Select demo org', async (assert) => {
		await setIframeSrc('/user/switchorg');
		$$('a[href="/demo/home"]')[0].click(); // "View data" link
		await waitForIframeLoad();
		assert.equal(wnd.location.pathname, '/home', 'Logged in to org and displayed homepage');
		$$('#burger button')[0].click();
		await waitForMs(50);
		$$('li.mm-listitem a[href="/user/switchorg"]')[0].click();
		await waitForIframeLoad();
		assert.equal(wnd.location.pathname, '/', 'Went back to switch org');
		
		$$('a[href="/selectorg-login?org_key=demo&rdr=/home"]')[0].click(); // "Log in to scout" link
		await waitForIframeLoad();
		assert.equal(wnd.location.pathname, '/user/login', 'Logged in to org went to login page');
	});
});

QUnit.module('login', function () {
	QUnit.test('Scouter login', async (assert) => {
		let loginData = await queryTestAPI('login-to-org-data');
		await setIframeSrc('/selectorg-login?org_key=demo&rdr=/home');
		console.log(loginData);
		$$('input[name="org_password"]').val(loginData.passwd);
		$$('form').trigger('submit');
		await waitForIframeLoad();
		assert.equal(wnd.location.pathname, '/user/login/select', 'Post-password org login');
		
		assert.false($$('input[name="password"]').is(':visible'), 'Personal password not visible');
		$$('select[name="user"]').val(loginData.userWithPassword); // someone with a personal password
		$$('#btnLogin').trigger('click');
		await waitForMs(300);
		assert.ok($$('input[name="password"]').is(':visible'), 'Personal password visible');
		
		// $$('select[name="user"]').val(loginData.userWithoutPassword); // someone without a personal password
		// await waitForMs(20);
		// assert.false($$('input[name="password"]').is(':visible'), 'Personal password not visible after switched to someone else');
		// $$('#btnLogin').trigger('click');
		// await waitForIframeLoad();
		// assert.ok(wnd.location.pathname.startsWith('/dashboard'), 'Resulted in /dashboard or /dashboard/unassigned');
	});
});