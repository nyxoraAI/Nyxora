<script lang="ts">
	import '../app.css';
	import { themeStore } from '$lib/stores/theme';
	import { configStore } from '$lib/stores/config.svelte';
	
	themeStore.init();
	configStore.load();
	
	let { children } = $props();
</script>

<div class="app text-gray-900 dark:text-[#ffffff] min-h-screen">
	{@render children()}
</div>
