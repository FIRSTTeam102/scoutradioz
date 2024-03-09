<script lang="ts">
	import { goto } from '$app/navigation';
	import QrCodeScanner from '$lib/QrCodeScanner.svelte';
	import {
		importMatchScoutingSchedule,
		importMetadata,
		importOneMatchScoutingResult,
		importOnePitScoutingResult,
		importPitScoutingSchedule
	} from '$lib/QrDataImport';
	import { decompress } from '$lib/compression';
	import { msg } from '$lib/i18n';
	import { getLogger } from '$lib/logger';
	import { getPageLayoutContexts, matchKeyToCompLevel } from '$lib/utils';

	// Cache last QR code data that failed, for processing later
	// 	(original intention is for storing failed match schedule QR while scanning users & nicknames QR)
	let lastFailedCode = '';

	let qrcodeEnabled = true;
	const { snackbar, dialog } = getPageLayoutContexts();
	const logger = getLogger('sync/Scanner');

	async function attemptImportQr(base64: string) {
		logger.info('base64', base64);
		try {
			let encodedData = await decompress(base64);
			switch (encodedData._) {
				// Match scouting schedule
				case 'sched': {
					let result = await importMatchScoutingSchedule(encodedData);
					logger.info('Got:', result);
					let dlgResult = await dialog.show(
						msg('qrsync.foundMatchScoutingSchedule'),
						msg('qrsync.goTo', { location: msg('scouting.match') }),
						{ noText: msg('qrsync.scanMore'), yesText: msg('qrsync.go') }
					);
					if (dlgResult.cancelled === false) {
						return goto('/scouting/match');
					}
					break;
				}
				// Pit scouting assignments
				case 'pit': {
					let result = await importPitScoutingSchedule(encodedData);
					logger.info('Got:', result);
					let dlgResult = await dialog.show(
						msg('qrsync.foundPitScoutingSchedule'),
						msg('qrsync.goTo', { location: msg('scouting.pit') }),
						{ noText: msg('qrsync.scanMore'), yesText: msg('qrsync.go') }
					);
					if (dlgResult.cancelled === false) {
						return goto('/scouting/pit');
					}
					break;
				}
				// Org/event metadata
				case 'meta': {
					let result = await importMetadata(encodedData);
					logger.info('Got:', result);
					// If we've cached a failed scan, offer to reprocess it
					if (lastFailedCode) {
						// TODO: add picker to select which user you are
						// 	for the time being: just select default_user
						let dlgResult = await dialog.show(msg('qrsync.foundMetadata'), msg('qrsync.tryAgain'), {
							yesText: msg('yes'),
							noText: msg('no')
						});
						if (dlgResult.cancelled === false) {
							logger.info('Attempting to re-import cached failed QR code');
							// Since the catch of this very function will re-set lastFailedcode when the import fails,
							// we should clear it BEFORE reimporting, not after.
							let codeToRetry = lastFailedCode;
							lastFailedCode = '';
							await attemptImportQr(codeToRetry);
						}
					}
					// otherwise, just show OK
					else {
						let dlgResult = await dialog.show(msg('qrsync.foundMetadata'), '', { disableNo: true });
					}
					break;
				}
				// 1 match result
				case '1matchdata': {
					let result = await importOneMatchScoutingResult(encodedData);
					logger.info('Got:', result);
					let matchLevel = msg(`matchType.${matchKeyToCompLevel(result.match_key)}`)
					snackbar.open(msg('qrsync.foundOneMatchResult', {
						match: msg('reports.match', {number: result.match_number, level: matchLevel}),
						name: result.actual_scorer?.name || 'unknown',
					}), 4000)
					break;
				}
				// 1 pit scouting result
				case '1pitdata': {
					let result = await importOnePitScoutingResult(encodedData);
					logger.info('Got:', result);
					snackbar.open(msg('qrsync.foundOnePitResult', {
						team: result.team_key.substring(3),
						name: result.actual_scouter?.name || 'unknown',
					}), 4000)
					break;
				}
			}
			qrcodeEnabled = true; // re enable scanning after user responds
		} catch (err) {
			logger.error(err);
			await dialog.show(msg('qrsync.decodeFailed'), String(err), {
				disableNo: true
			});
			lastFailedCode = base64; // store for reprocessing later
			qrcodeEnabled = true; // Attempt to resume scanning
		}
	}
</script>

<QrCodeScanner
	on:data={async (e) => {
		qrcodeEnabled = false; // Disable scanning while we process the data

		let qr = e.detail.text;
		logger.trace(`Got QR code: ${qr.substring(0, 100)}...`);

		// // We're expecting the QR to be a URL, https://(domain)/qr?q=[actual data]
		// let index = qr.indexOf('?q=');
		// assert(index > 0, `Expected but did not find '?q=' in qrcode`);
		// let base64 = qr.substring(index + 3);
		let base64 = qr; //
		attemptImportQr(base64);
	}}
	enabled={qrcodeEnabled} />
