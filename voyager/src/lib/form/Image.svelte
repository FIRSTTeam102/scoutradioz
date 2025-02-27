<script lang="ts">
	import db, { type EventLocal } from '$lib/localDB';
	import type { ImageItem } from 'scoutradioz-types';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getLogger } from '$lib/logger';

	interface Props {
		field: ImageItem;
	}

	const logger = getLogger('form/Image');

	const org_key: string = page.data.org_key;
	const event: EventLocal = page.data.event;

	const { field }: Props = $props();
	const { image_id } = field;

	let imageUrl = $state('');

	onMount(async () => {
		logger.debug(`Searching for ${image_id}`);
		const upload = await db.uploads
			.where({ org_key, year: event.year })
			.filter((item) => item.image_id === image_id)
			.first();
		if (!upload) return logger.error(`upload not found for image_id ${image_id}`);
		const { s3_key } = upload;
		logger.debug(`Searching for blob with s3_key ${s3_key}`);
		const imageBlobs = await db.images.where({ s3_key }).first();
		if (!imageBlobs) return logger.error(`image blobs not found for s3 key ${s3_key}`);
		imageUrl = URL.createObjectURL(imageBlobs.lg);
	});
</script>

{#if imageUrl}
	<div class='lg:max-w-6xl md:max-w-2xl max-w-full'>
		<img class="max-w-full" src={imageUrl} alt={field.image_id} />
	</div>
{/if}
