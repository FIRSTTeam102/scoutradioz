<script lang='ts'>
	import type { PageServerData } from './$types';
	import Paper, { Title, Subtitle, Content } from '@smui/paper';
	
	export let data: PageServerData;
</script>

<div class='paper-container'>
	<!-- {#each data.users as user}
		<Paper>
			<Title>{user.name}</Title>
			<Subtitle>{user.org_key}</Subtitle>
		</Paper>
	{/each} -->
</div>

<style lang='scss'>
	.paper-container {
		margin: 24px;
		& :global(.smui-paper) {
			margin-bottom: 24px;
		}
	}
</style>