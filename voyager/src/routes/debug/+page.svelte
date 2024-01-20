<script lang="ts">
	import { encodeMatchScouting, decodeMatchScouting } from '$lib/compression';
	import db, { type Log } from '$lib/localDB';
	import { event_key, org_key } from '$lib/stores';

	import { type logLevel, logLevelStringToNumber, logLevelNumberToString, setGlobalLogLevel, getGlobalLogLevel } from '$lib/logger';
	import Select, { Option } from '@smui/select';
	import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
	import IconButton from '@smui/icon-button';
	import { liveQuery, type IndexableTypeArray, type Observable } from 'dexie';
	import { getContext } from 'svelte';
	import type { SnackbarContext } from '$lib/types';

	let snackbar = getContext('snackbar') as SnackbarContext;

	let groups: Observable<IndexableTypeArray>;
	$: groups = liveQuery(() => db.logs.orderBy('group').uniqueKeys());

	$: selectedLevelNum = logLevelStringToNumber(selectedLogLevel);

	let items: Observable<Log[]>;
	$: items = liveQuery(() => {
		let collection = (selectedLogGroup !== 'all')
			? db.logs.where({ group: selectedLogGroup })
			: db.logs.orderBy('id');
		return collection
			.and((log) => log.level >= selectedLevelNum)
			.reverse()
			.limit(100)
			.toArray();
	});

	async function copyToClipboard() {
		let collection = (selectedLogGroup !== 'all')
			? db.logs.where({ group: selectedLogGroup })
			: db.logs.toCollection();
		let logs = await collection.and((log) => log.level >= selectedLevelNum).toArray();
		let text = logs
			.map(
				(log) =>
					`[${log.group}] [${logLevelNumberToString(log.level).toUpperCase()}]: ${log.message}`
			)
			.join('\n');
		await navigator.clipboard.writeText(text);
		snackbar.open(`Copied ${logs.length} log message(s) to clipboard`, 4000);
	}
	
	let selectedLogGroup = 'all';
	let selectedLogLevel: logLevel = 'debug';
	
	// Allow the changing of the recorded log level
	let recordedLogLevel: logLevel = getGlobalLogLevel();
	
	$: setGlobalLogLevel(recordedLogLevel);
</script>

<h1>Debug stuff</h1>

<button
	on:click={async () => {
		await db.delete();

		snackbar.open('Cleared database.');

		setTimeout(() => {
			location.href = location.href; // reload page
		}, 1000);
	}}>Wipe local database</button
>

<button
	on:click={async () => {
		let response = await fetch('/debug/flush_cache');
		if (response.ok) {
			snackbar.open('Flushed server DB cache.');
		} else {
			snackbar.error('Something went wrong');
		}
	}}>Flush server database cache</button
>

<button
	on:click={async () => {
		let reason = await snackbar.open('Test', -1, 'Test');
		console.log(reason);
	}}
>
	Snackbar test
</button>

<h1>Logging behavior</h1>
<Select variant="filled" label="Log level to record" bind:value={recordedLogLevel}>
	<Option value="trace">Trace</Option>
	<Option value="debug">Debug</Option>
	<Option value="info">Info</Option>
	<Option value="warn">Warn</Option>
	<Option value="error">Error</Option>
	<Option value="fatal">Fatal</Option>
</Select>
<div>Logs at or above this level will be recorded; logs below this level will be ignored.</div>


<h1>Logs</h1>

<Select variant="filled" label="Log group" bind:value={selectedLogGroup}>
	<Option value="all">All</Option>
	{#if $groups}
		{#each $groups as group}
			<Option value={group}>{group}</Option>
		{/each}
	{/if}
</Select>

<Select variant="filled" label="Display levels:" bind:value={selectedLogLevel}>
	<Option value="trace">Trace</Option>
	<Option value="debug">Debug</Option>
	<Option value="info">Info</Option>
	<Option value="warn">Warn</Option>
	<Option value="error">Error</Option>
	<Option value="fatal">Fatal</Option>
</Select>

<IconButton class="material-icons" on:click={copyToClipboard}>content_copy</IconButton>
<IconButton class="material-icons" on:click={async () => {
	if (confirm('Delete all logs stored on the device?')) {
		await db.logs.clear();
	}
}}>delete</IconButton>

<p>Note: Table is limited to 100 messages. Click the clipboard button to copy all logs (with the current filter) to the clipboard.</p>

<DataTable table$aria-label="User list" style="width: 100%;">
	<Head>
		<Row>
			<Cell numeric>ID</Cell>
			<Cell>Group</Cell>
			<Cell>Level</Cell>
			<Cell style="width: 100%">Message</Cell>
		</Row>
	</Head>
	<Body>
		{#if $items}
			{#each $items as item}
				<Row>
					<Cell numeric>{item.id}</Cell>
					<Cell>{item.group}</Cell>
					<Cell>{logLevelNumberToString(item.level)}</Cell>
					<Cell>{item.message}</Cell>
				</Row>
			{/each}
		{/if}
	</Body>
	<!-- TODO: Progress bar when data is loading from DB -->
</DataTable>