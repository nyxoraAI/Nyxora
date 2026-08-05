<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import ChatComposer from '$lib/components/ChatComposer.svelte';
	import WalletPortfolio from '$lib/components/WalletPortfolio.svelte';
	import MarketIntel from '$lib/components/MarketIntel.svelte';
	import Playbooks from '$lib/components/Playbooks.svelte';
	import Cron from '$lib/components/Cron.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import SearchChat from '$lib/components/SearchChat.svelte';
	import { appState } from '$lib/stores/app';
	import { configStore } from '$lib/stores/config.svelte';
	import { PanelLeftOpen, Check, Network, Shield, Bot } from '@lucide/svelte';
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/utils/api';
	
	let currentView = $derived($appState.currentView);
	let isSidebarCollapsed = $derived($appState.isSidebarCollapsed);
	let currentNetwork = $derived($appState.currentNetwork);
	let isSearchOpen = $derived($appState.isSearchOpen);

	let isLlmDropdownOpen = $state(false);
	let isElectron = $state(false);
	
	let isLocked = $state(false);
	let lockedAt = $state(0);
	let lastActivity = Date.now();

	// Robust IPC sender — safe in both Electron and browser dev mode
	function sendIpc(channel: string) {
		if (typeof window !== 'undefined' && window.ipcRenderer) {
			window.ipcRenderer.send(channel);
		}
	}

	onMount(() => {
		// Detect if running inside Electron (preload exposes ipcRenderer)
		isElectron = typeof window !== 'undefined' && !!window.ipcRenderer;

		const handleActivity = () => { lastActivity = Date.now(); };
		window.addEventListener('mousemove', handleActivity);
		window.addEventListener('keydown', handleActivity);
		
		const lockCheck = setInterval(() => {
			const autoLockTime = parseInt(localStorage.getItem('nyxora_auto_lock') || '0');
			if (autoLockTime > 0 && !isLocked && (Date.now() - lastActivity > autoLockTime * 60 * 1000)) {
				isLocked = true;
				lockedAt = Date.now();
			}
		}, 1000);

		const unlockCheck = setInterval(async () => {
			if (isLocked) {
				try {
					const res = await apiFetch('/api/status/lock');
					const data = await res.json();
					if (data.lastUnlockRequest && data.lastUnlockRequest > lockedAt) {
						isLocked = false;
						lastActivity = Date.now();
					}
				} catch (e) {}
			}
		}, 1000);

		return () => {
			window.removeEventListener('mousemove', handleActivity);
			window.removeEventListener('keydown', handleActivity);
			clearInterval(lockCheck);
			clearInterval(unlockCheck);
		};
	});

	let currentLlmModel = $derived(configStore.config?.llm?.model || 'Loading...');
	let currentLlmProvider = $derived(configStore.config?.llm?.provider || '');

	const llmPresets = [
		{ provider: 'gemini', model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', logoUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg' },
		{ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', logoUrl: 'https://mintlify.s3-us-west-1.amazonaws.com/anthropic/logo/dark.svg' },
		{ provider: 'openai', model: 'gpt-4o', name: 'GPT-4o', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg' },
		{ provider: 'deepseek', model: 'deepseek-reasoner', name: 'DeepSeek R1', logoUrl: 'https://chat.deepseek.com/favicon.svg' },
		{ provider: 'deepseek', model: 'deepseek-chat', name: 'DeepSeek V3', logoUrl: 'https://chat.deepseek.com/favicon.svg' }
	];

	function selectLlm(preset: typeof llmPresets[0]) {
		if (!configStore.config) return;
		configStore.config.llm.provider = preset.provider;
		configStore.config.llm.model = preset.model;
		configStore.updateConfig({llm: configStore.config.llm});
		configStore.saveAll();
		isLlmDropdownOpen = false;
	}

	function getCurrentLlmDisplay() {
		const preset = llmPresets.find(p => p.model === currentLlmModel && p.provider === currentLlmProvider);
		if (preset) return { name: preset.name, logo: preset.logoUrl };
		
		let displayName = currentLlmModel;
		if (displayName.includes('/')) {
			displayName = displayName.split('/').pop() || displayName;
		}
		
		displayName = displayName
			.split(/[-_]/)
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
			
		return { name: displayName, logo: null };
	}
</script>

<div class="flex h-screen w-full overflow-hidden text-gray-900 dark:text-[#ffffff] bg-white dark:bg-[#1c1c1e] selection:bg-blue-200 dark:selection:bg-blue-800/30">
	{#if isLocked}
	<div class="fixed inset-0 bg-white/5 backdrop-blur-xl z-[99999] flex flex-col items-center justify-center text-gray-900 dark:text-gray-100 font-sans">
		<Shield size={64} class="text-blue-500 mb-5" />
		<h1 class="text-3xl font-bold mb-2 shadow-sm">Session Locked</h1>
		<p class="text-gray-600 dark:text-gray-300 text-lg">
			Please open your terminal and run <code class="bg-black/10 dark:bg-black/30 px-2 py-1 rounded">nyxora unlock</code> to authorize unlock.
		</p>
	</div>
	{/if}
	
	<SettingsModal />
	<Sidebar />

	<!-- Main Area -->
	<div class="flex-1 h-full flex flex-col relative bg-white dark:bg-[#1c1c1e]">
		<!-- Topbar -->
		<div class="h-14 flex items-center px-3 justify-between drag-region relative z-30">
			<!-- LEFT: Sidebar toggle -->
			<div class="flex items-center gap-2 relative" style="-webkit-app-region: no-drag;">
				{#if isSidebarCollapsed}
					<button onclick={() => appState.toggleSidebar()} class="p-1.5 hover:bg-gray-100 dark:hover:bg-[#3a3a3c] rounded-md text-gray-500 dark:text-[#e5e5ea] hover:text-black dark:hover:text-[#ffffff] cursor-pointer" style="-webkit-app-region: no-drag;" aria-label="Open sidebar">
						<PanelLeftOpen size={18} />
					</button>
				{/if}
			</div>

			<!-- RIGHT: LLM Indicator + macOS-style window controls -->
			<div class="flex items-center gap-3" style="-webkit-app-region: no-drag;">
				<!-- LLM Indicator -->
				<div class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e5e5ea] dark:border-[#3a3a3c] bg-gray-50/50 dark:bg-[#2c2c2e]/50">
					<span class="font-medium text-[14px]">{getCurrentLlmDisplay().name}</span>
				</div>

				<!-- macOS Traffic Light Buttons -->
				<div class="wc-group flex items-center gap-[6px]" style="-webkit-app-region: no-drag;">
					<button
						onclick={() => sendIpc('window-minimize')}
						class="wc-btn w-3 h-3 rounded-full flex items-center justify-center cursor-pointer"
						style="background:#FFBD2E; border: 0.5px solid rgba(0,0,0,0.2); -webkit-app-region: no-drag; pointer-events: auto;"
						aria-label="Minimize">
						<span class="wc-icon" style="font-size:7px; font-weight:900; color:#5a3800; line-height:1; user-select:none;">−</span>
					</button>
					<button
						onclick={() => sendIpc('window-maximize')}
						class="wc-btn w-3 h-3 rounded-full flex items-center justify-center cursor-pointer"
						style="background:#28CA41; border: 0.5px solid rgba(0,0,0,0.2); -webkit-app-region: no-drag; pointer-events: auto;"
						aria-label="Maximize">
						<span class="wc-icon" style="font-size:7px; font-weight:900; color:#004d00; line-height:1; user-select:none;">+</span>
					</button>
					<button
						onclick={() => sendIpc('window-close')}
						class="wc-btn w-3 h-3 rounded-full flex items-center justify-center cursor-pointer"
						style="background:#FF5F57; border: 0.5px solid rgba(0,0,0,0.2); -webkit-app-region: no-drag; pointer-events: auto;"
						aria-label="Close">
						<span class="wc-icon" style="font-size:7px; font-weight:900; color:#4d0000; line-height:1; user-select:none;">×</span>
					</button>
				</div>
			</div>
		</div>


		{#if isSearchOpen}
			<SearchChat />
		{:else if currentView === 'chat'}
			<div class="flex-1 flex flex-col overflow-hidden relative">
				<MessageList />
				<ChatComposer />
			</div>
		{:else if currentView === 'portfolio'}
			<WalletPortfolio baseFiat={configStore.config?.agent?.base_fiat || 'usd'} />
		{:else if currentView === 'market'}
			<MarketIntel />
		{:else if currentView === 'cron'}
			<Cron />
		{:else if currentView === 'playbooks'}
			<Playbooks />
		{/if}
	</div>
</div>
