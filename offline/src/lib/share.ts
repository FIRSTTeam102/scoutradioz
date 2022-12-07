export function share(/*orgKey?*/) {
	if (!('share' in navigator && 'canShare' in navigator)) return;

	let url = new URL(globalThis.location);
	// if (orgKey) url.pathname = '/' + orgKey + url.pathname;

	let shareData = {
		url,
		title: document.title,
	};

	if (navigator.canShare(shareData)) {
		try {
			navigator.share(shareData);
		} catch (err) {
			console.error('Error sharing data:', err);
		}
	}
}