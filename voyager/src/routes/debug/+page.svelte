<script lang="ts">
	import db, { type Log } from '$lib/localDB';

	import {
		getGlobalLogLevel,
		logLevelNumberToString,
		logLevelStringToNumber,
		setGlobalLogLevel,
		type logLevel
	} from '$lib/logger';
	import { getPageLayoutContexts } from '$lib/utils';
	import DataTable, { Body, Cell, Head, Label, Pagination, Row } from '@smui/data-table';
	import IconButton from '@smui/icon-button';
	import Select, { Option } from '@smui/select';
	import { liveQuery, type IndexableTypeArray, type Observable } from 'dexie';

	const { snackbar, dialog} = getPageLayoutContexts();

	let groups: Observable<IndexableTypeArray>;
	$: groups = liveQuery(() => db.logs.orderBy('group').uniqueKeys());

	$: selectedLevelNum = logLevelStringToNumber(selectedLogLevel);

	let items: Observable<Log[]>;
	$: items = liveQuery(() => {
		let collection =
			selectedLogGroup !== 'all'
				? db.logs.where({ group: selectedLogGroup })
				: db.logs.orderBy('time');
		return collection
			.and((log) => log.level >= selectedLevelNum)
			.reverse()
			.toArray();
	});
	let rowsPerPage = 10;
	let currentPage = 0;
	
	const maxMessageLength = 100;

	$: start = currentPage * rowsPerPage;
	$: end = Math.min(start + rowsPerPage, $items?.length);
	$: slice = $items?.slice(start, end);
	$: lastPage = $items ? Math.max(Math.ceil($items.length / rowsPerPage) - 1, 0) : 0;

	$: if (currentPage > lastPage) {
		currentPage = lastPage;
	}

	async function copyToClipboard() {
		let collection =
			selectedLogGroup !== 'all'
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

<h1>Logging behavior</h1>
<Select variant="filled" label="Log level to record" bind:value={recordedLogLevel} on:MDCSelect:change={() => setGlobalLogLevel(recordedLogLevel)}>
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
<IconButton
	class="material-icons"
	on:click={async () => {
		if (confirm('Delete all logs stored on the device?')) {
			await db.logs.clear();
		}
	}}>delete</IconButton
>

<DataTable table$aria-label="User list" style="width: 100%;">
	<Head>
		<Row>
			<Cell colspan={1}>Group</Cell>
			<Cell colspan={1}>Level</Cell>
			<Cell colspan={1}>Time</Cell>
			<Cell colspan={4} style="width: 100%">Message</Cell>
		</Row>
	</Head>
	<Body>
		{#if $items}
			{#each slice as item}
				<Row>
					<Cell>{item.group}</Cell>
					<Cell>{logLevelNumberToString(item.level)}</Cell>
					<Cell>{item.time.toLocaleString()}</Cell>
					{#if item.message?.length > maxMessageLength}
						<Cell class='cursor-pointer text-ellipsis overflow-hidden' on:click={() => {
							dialog.show(item.time.toLocaleString(), item.message.replace(/\n/g, '<br>'), {disableNo: true,})
						}}>{item.message.substring(0, maxMessageLength)}...</Cell>
					{:else}
						<Cell>{item.message}</Cell>
					{/if}
				</Row>
			{/each}
		{/if}
	</Body>
	<Pagination slot="paginate">
		<svelte:fragment slot="rowsPerPage">
			<Label>Rows Per Page</Label>
			<Select variant="outlined" bind:value={rowsPerPage} noLabel>
				<Option value={10}>10</Option>
				<Option value={25}>25</Option>
				<Option value={100}>100</Option>
			</Select>
		</svelte:fragment>
		<svelte:fragment slot="total">
			{start + 1}-{end} of {$items?.length || 'unknown'}
		</svelte:fragment>

		<IconButton
			class="material-icons"
			action="first-page"
			title="First page"
			on:click={() => (currentPage = 0)}
			disabled={currentPage === 0}>first_page</IconButton
		>
		<IconButton
			class="material-icons"
			action="prev-page"
			title="Prev page"
			on:click={() => currentPage--}
			disabled={currentPage === 0}>chevron_left</IconButton
		>
		<IconButton
			class="material-icons"
			action="next-page"
			title="Next page"
			on:click={() => currentPage++}
			disabled={currentPage === lastPage}>chevron_right</IconButton
		>
		<IconButton
			class="material-icons"
			action="last-page"
			title="Last page"
			on:click={() => (currentPage = lastPage)}
			disabled={currentPage === lastPage}>last_page</IconButton
		>
	</Pagination>
</DataTable>
