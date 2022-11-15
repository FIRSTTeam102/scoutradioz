/* eslint-disable no-constant-condition */
/// <reference types="qunit"/>

interface Window {
	jQuery: JQueryStatic;
}

interface JQueryStatic {
	// Whether the JQuery object has been overridden.
	// 	JL note: Again, not compliant with TypeScript's norms, but this is just a testing script.
	overridden: boolean;
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

// Updates wnd, doc, and $$ any time the iframe loads a new page
iframe.onload = () => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore -- JL note: zoom is non standard but works on chromium and it's just a nice-to-have
	if (iframe.contentDocument) iframe.contentDocument.body.style.zoom = '50%';
	
	let iframeWindow = iframe.contentWindow;
	if (!iframeWindow) throw 'iframe window not defined';
	let iframeDocument = iframeWindow.document;
	if (!iframeDocument) throw 'iframe document not defined';
	wnd = iframeWindow;
	doc = iframeDocument;
	if (!iframeWindow.jQuery) throw 'iframe jquery not defined';
	$$ = iframeWindow.jQuery;
	overrideJqueryAjax();
};

function setIframeSrc(src: string): Promise<void> {
	// const iframe: JQuery<HTMLIFrameElement> = $('#iframe');
	
	return new Promise((resolve) => {
		$(iframe).on('load', () => {
			$(iframe).off('load');
			resolve();
		});
		iframe.src = location.origin + src;
	});
}

function waitForIframeLoad(): Promise<string> {
	const iframe: JQuery<HTMLIFrameElement> = $('#iframe');
	
	let didResolve = false;
	
	return new Promise((resolve, reject) => {
		iframe.on('load', () => {
			iframe.off('load');
			resolve('');
			didResolve = true;
		});
		// After 1 second, if the iframe did not load, then reject (that means it probably was never loading in the first place)
		setTimeout(() => {
			if (!didResolve) {
				reject('Page never loaded!');
			}
		}, 2500);
	});
}

// Wait for jqAjaxPromise to resolve
function waitForAjaxPromise() {
	console.log('waitForAjaxPromise');
	return new Promise((resolve) => {
		waitForMs(20)// In case the ajax request isn't fired immediately
			.then(() => {
				jqAjaxPromise.then(resolve);
			}); 
	});
}

// Promise that will resolve after any $$.post completes (even if it fails)
let jqAjaxPromise: Promise<void>;

// Overrides JQuery's AJAX function (which we use a lot) to give this page an await-able hook.
// 	JL note: Perfect TypeScript compatibility really doesn't matter in this case, which is the reason for all the @ts-ignores.
function overrideJqueryAjax() {
	// return;
	// Only override $$ if it hasn't already been modified
	if (!$$.overridden) {
		let origAjaxFunction = $$.ajax;
		// @ts-ignore
		$$.ajax = (...args) => {
			// @ts-ignore
			let ret = origAjaxFunction(...args);
			let done = ret.done;
			let fail = ret.fail;
			jqAjaxPromise = new Promise((resolve) => {
				ret.done = (callback: (...args: unknown[]) => void) => {
					let newCallback = (...args: unknown[]) => {
						callback(...args);
						resolve();
					};
					return done(newCallback);
				};
				ret.fail = (callback: (...args: unknown[]) => void) => {
					let newCallback = (...args: unknown[]) => {
						callback(...args);
						resolve();
					};
					return fail(newCallback);
				};
			});
			return ret;
		};
		$$.overridden = true;
	}
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
				reject(JSON.stringify(data));
			});
	});
}

/**
 * Asserts that there is no element with id "errorContents" in the iframe document.
 */
function assertNoErrorContents(assert: typeof QUnit.assert) {
	assert.ok(!doc.getElementById('errorContents'));
}

/**
 * Pathnames that end in a / are equivalent to pathnames that don't end in a /.
 * We must account for this with a slightly modified call to assert.equal.
 */
function assertPathname(assert: typeof QUnit.assert, pathname: string, message?: string) {
	let realPathname = wnd.location.pathname;
	if (!realPathname.endsWith('/')) realPathname = realPathname + '/';
	if (!pathname.endsWith('/')) pathname = pathname + '/';
	assert.equal(realPathname, pathname, message);
}

QUnit.config.testTimeout = 10000;
// NOTE: elem.trigger('click') doesn't seem to work for `a` elements. Instead, do elem[0].click()

QUnit.module('switchorg', function () {
	QUnit.test('Switch org', async (assert) => {
		await setIframeSrc('/user/switchorg');
		assertNoErrorContents(assert);
		assertPathname(assert, '/'); // Make sure switchorg sends the user to '/'
	});
	QUnit.test('selectOrg radio buttons', async (assert) => {
		await setIframeSrc('/user/switchorg');
		$$('#chbLearnMore').trigger('click').trigger('change');
		await waitForMs(20);
		assert.ok($$('#discordLink').is(':visible'), 'Discord link is visible');
		assert.false($$('#blurbViewData').is(':visible'), 'View Data blurb is visible');
		assert.false($$('a[href="/demo/home"]').is(':visible'), 'Demo View Data link is visible');
		assert.false($$('a[href="/selectorg-login?org_key=demo&rdr=/home"]').is(':visible'), 'Demo selectorg-login link is visible');
		
		$$('#chbLoginScout').trigger('click').trigger('change');
		await waitForMs(20);
		assert.ok($$('a[href="/selectorg-login?org_key=demo&rdr=/home"]').is(':visible'), 'Demo selectorg-login link is visible');
		assert.false($$('#discordLink').is(':visible'), 'Discord link is visible');
		assert.false($$('#blurbViewData').is(':visible'), 'View Data blurb is visible');
		assert.false($$('a[href="/demo/home"]').is(':visible'), 'Demo View Data link is visible');
		
		$$('#chbViewData').trigger('click').trigger('change');
		await waitForMs(20);
		assert.ok($$('a[href="/demo/home"]').is(':visible'), 'Demo View Data link is visible');
		assert.ok($$('#blurbViewData').is(':visible'), 'View Data blurb is visible');
		assert.false($$('a[href="/selectorg-login?org_key=demo&rdr=/home"]').is(':visible'), 'Demo selectorg-login link is visible');
		assert.false($$('#discordLink').is(':visible'), 'Discord link is visible');
	});
	QUnit.test('Select demo org', async (assert) => {
		await setIframeSrc('/user/switchorg');
		$$('a[href="/demo/home"]')[0].click(); // "View data" link
		await waitForIframeLoad();
		assertPathname(assert, '/home', 'Logged in to org and displayed homepage');
		$$('#burger button')[0].click();
		await waitForMs(50);
		$$('li.mm-listitem a[href="/user/switchorg"]')[0].click();
		await waitForIframeLoad();
		assertPathname(assert, '/', 'Went back to switch org');
		
		$$('a[href="/selectorg-login?org_key=demo&rdr=/home"]')[0].click(); // "Log in to scout" link
		await waitForIframeLoad();
		assertPathname(assert, '/user/login', 'Logged in to org went to login page');
	});
});

QUnit.module('login', function () {
	QUnit.test('Scouter login', async (assert) => {
		let loginData = await queryTestAPI('login-to-org-data');
		await setIframeSrc('/selectorg-login?org_key=demo');
		$$('input[name="org_password"]').val(loginData.passwd);
		$$('form').trigger('submit');
		await waitForIframeLoad();
		assertPathname(assert, '/user/login/select', 'Post-password org login');
		assert.false($$('input[name="password"]').is(':visible'), 'Personal password visible');
		assert.false($$('#passwordCreationContainer').is(':visible'), 'Password creation visible');
		
		// Someone with a personal password
		$$('select[name="user"]').val(loginData.userWithPassword) // someone with a personal password
			.trigger('change');
		$$('#btnLogin').trigger('click');
		await waitForAjaxPromise();
		assert.ok($$('input[name="password"]').is(':visible'), 'Personal password visible 2');
		
		// Someone without a personal password
		$$('select[name="user"]').val(loginData.userWithoutPassword)
			.trigger('change'); 
		await waitForAjaxPromise();
		assert.false($$('input[name="password"]').is(':visible'), 'Personal password visible after switched to someone else');
		$$('#btnLogin').trigger('click');
		await waitForIframeLoad();
		assert.ok(wnd.location.pathname.startsWith('/dashboard'), 'Resulted in /dashboard or /dashboard/unassigned');
	});
	QUnit.test('2. Logout and password creation', async (assert) => {
		let newUserData = await queryTestAPI('password-creation-data');
		let loginData = await queryTestAPI('login-to-org-data');
		
		if (newUserData.skip) {
			assert.expect(1);
			assert.ok(true, 'Password creation test skipped!!! Tier is not dev!!!');
			return;
		}
		
		await setIframeSrc('/user/logout');
		assertPathname(assert, '/home', 'User logged out');
		assert.equal($$('a[href="/user/login"]').length, 2, 'Two login buttons: One in nav, one in homepage');
		
		await setIframeSrc('/user/login');
		$$('input[name="org_password"]').val(loginData.passwd);
		$$('form').trigger('submit');
		await waitForIframeLoad();
		
		console.log(newUserData);
		$$('select[name="user"]').val(newUserData.userForPasswordCreation) // someone with a personal password
			.trigger('change');
		$$('#btnLogin').trigger('click');
		await waitForAjaxPromise();
		assert.ok($$('input[name=newPassword1]').is(':visible') && $$('input[name=newPassword2]').is(':visible'), 'New password inputs are visible');
		
		const newPassword = String(Math.random()); // easy random password
		console.log('New password: ', newPassword);
		$$('input[name=newPassword1]').val(newPassword);
		$$('input[name=newPassword2]').val(newPassword);
		$$('#btnLogin').trigger('click');
		await waitForIframeLoad();
		assertPathname(assert, '/home', 'Temp user logged in & is at homepage');
		
		// log out & log back in again with new password
		await setIframeSrc('/user/logout'); 
		await setIframeSrc('/user/login'); 
		$$('input[name="org_password"]').val(loginData.passwd);
		$$('form').trigger('submit');
		await waitForIframeLoad();
		
		$$('select[name="user"]').val(newUserData.userForPasswordCreation) // someone with a personal password
			.trigger('change');
		$$('#btnLogin').trigger('click');
		await waitForAjaxPromise();
		assert.ok($$('input[name="password"]').is(':visible'), 'Personal password visible after being set');
		$$('input[name="password"]').val(newPassword);
		$$('#btnLogin').trigger('click');
		await waitForIframeLoad();
		
		assertPathname(assert, '/manage', 'Temp user successfully logged in with password');
		
		await setIframeSrc('/user/logout'); // Log out
		let removeUserResult = await queryTestAPI('remove-temp-user');
		assert.ok(removeUserResult.ok, 'Removed user successfully');
		let verifyRemoveResult = await queryTestAPI('verify-temp-user-removed');
		assert.ok(verifyRemoveResult.ok, 'Verified users removed (sanity check)');
	});
});

QUnit.done(async () => {
	console.log('hi!');
	let x = await queryTestAPI('remove-temp-user');
	console.log(x);
});