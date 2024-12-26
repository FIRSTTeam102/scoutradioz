<!-- Shows a pretty loading bar to the user while it waits for a fetched resource. -->
<script lang="ts">
	/**
	 * test test
	 */
	type D = $$Generic<any>;
	import Paper, { Title, Subtitle, Content } from '@smui/paper';
	import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
	import LinearProgress from '@smui/linear-progress';
	
	interface Props {
		dataToAwait: Promise<D>;
		children?: import('svelte').Snippet<[any]>;
	}

	let { dataToAwait, children }: Props = $props();
</script>

{#await dataToAwait}
<Paper>
	<LinearProgress indeterminate />
</Paper>
{:then data}
	{@render children?.({ data, })}
{:catch error}
<Paper>
	<Title>Error {error.status}</Title>
	<Subtitle>{error.message}</Subtitle>
	{#if error.body}
		<DataTable style='max-width: 100%;'>
			<Body>
				{#each Object.keys(error.body) as key}
					<Row>
						<Cell><pre>{key}</pre></Cell>
						<Cell><pre>{error.body[key]}</pre></Cell>
					</Row>
				{/each}
			</Body>
		</DataTable>
	{/if}
</Paper>
{/await}