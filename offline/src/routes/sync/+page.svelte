<script lang='ts'>
	import Tab, { Label } from '@smui/tab';
	import TabBar from '@smui/tab-bar';
	
	let activeTab = 'Scouter';
</script>

<div>
	<TabBar tabs={['Scouter', 'Scouting lead']} let:tab bind:active={activeTab}>
		<Tab {tab} color='red'>
			<Label>{tab}</Label>
		</Tab>
	</TabBar>
	
</div>