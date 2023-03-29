// @ts-nocheck
importScripts('/lib/zbar.js');
importScripts('/lib/koder-browser.js');
// import Koder from '/lib/koder-browser.js';

(async () => {
	// Initialize Koder
	const koder = await new Koder().initialize({ wasmDirectory: '/lib' });
	// const koder = await new Koder().initialized;

	// Listen for messages from JS main thread containing raw image data
	self.addEventListener('message', (event) => {
		if ('width' in event.data && 'height' in event.data) {
			self.width = event.data.width;
			self.height = event.data.height;
		}

		const { data } = event.data;
		if (!data) return;

		const t0 = new Date().getTime();
		const scanResult = koder.decode(data, self.width, self.height);
		const t1 = new Date().getTime();
		if (scanResult) {
			console.log(`Scanned in ${t1 - t0} ms`);
			postMessage({
				data: scanResult,
				ms: t1 - t0
			});
		}
	});
})();
