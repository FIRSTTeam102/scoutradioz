<script lang="ts">
	import db, { type Log } from '$lib/localDB';
	import { type logLevel, logLevelStringToNumber, logLevelNumberToString } from '$lib/logger';
	import Select, { Option } from '@smui/select';
	import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
	import { liveQuery, type IndexableTypeArray, type Observable } from 'dexie';

	let groups: Observable<IndexableTypeArray>;
	$: groups = liveQuery(() => db.logs.orderBy('group').uniqueKeys());

	let items: Observable<Log[]>;
	$: items = liveQuery(() => {
		let selectedLevelNum = logLevelStringToNumber(selectedLogLevel);
		let collection = selectedLogGroup
			? db.logs.where({ group: selectedLogGroup })
			: db.logs.toCollection();
		return collection
			.and((log) => log.level >= selectedLevelNum)
			.limit(100)
			.toArray();
	});

	let selectedLogGroup: string;
	let selectedLogLevel: logLevel = 'debug';
</script>

<Select variant="filled" bind:value={selectedLogGroup}>
	<Option value="">All</Option>
	{#if $groups}
		{#each $groups as group}
			<Option value={group}>{group}</Option>
		{/each}
	{/if}
</Select>

<Select variant="filled" bind:value={selectedLogLevel}>
	<Option value="trace">Trace</Option>
	<Option value="debug">Debug</Option>
	<Option value="info">Info</Option>
	<Option value="warn">Warn</Option>
	<Option value="error">Error</Option>
	<Option value="fatal">Fatal</Option>
</Select>

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
