<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import ChatComposer from '$lib/components/ChatComposer.svelte';
	import WalletPortfolio from '$lib/components/WalletPortfolio.svelte';
	import MarketIntel from '$lib/components/MarketIntel.svelte';
	import Playbooks from '$lib/components/Playbooks.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import SearchChat from '$lib/components/SearchChat.svelte';
	import { appState } from '$lib/stores/app';
	import { configStore } from '$lib/stores/config.svelte';
	import { PanelLeftOpen, Check, Network, Shield } from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/utils/api';
	
	let currentView = $derived($appState.currentView);
	let isSidebarCollapsed = $derived($appState.isSidebarCollapsed);
	let currentNetwork = $derived($appState.currentNetwork);
	let isSearchOpen = $derived($appState.isSearchOpen);

	let isNetworkDropdownOpen = $state(false);
	
	let isLocked = $state(false);
	let lockedAt = $state(0);
	let lastActivity = Date.now();

	onMount(() => {
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

	const networks = [
		{ id: 'all', name: 'All Chains', logoUrl: '' },
		{ id: 'ethereum', name: 'Ethereum Mainnet', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
		{ id: 'bsc', name: 'BNB Chain', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png' },
		{ id: 'base', name: 'Base', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png' },
		{ id: 'arbitrum', name: 'Arbitrum', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png' },
		{ id: 'robinhood', name: 'Robinhood', logoUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjQ0FGRjAwIi8+PHBhdGggZmlsbD0iIzIwMUUxQSIgZD0iTTIuODQgMjRoLjUzYy4wOTYgMCAuMTkyLS4wNDguMjI0LS4xMjhDNy41OTEgMTMuNjk2IDExLjk0IDguNjU2IDE0LjY3IDUuNjM4Yy4xMTItLjEyOC4wNjQtLjIyNS0uMDk2LS4yMjVoLTQuODhhLjU1LjU1IDAgMCAwLS40NS4yMjVMNS43NDYgOS45NzJjLS41MTQuNjQyLS42NDIgMS4yMzYtLjY0MiAyLjA4NnY0LjQzYy0xLjE0IDMuMTk0LTEuODYyIDUuMzYxLTIuMzkyIDcuMzJjLS4wMzIuMTI1LjAxNi4xOTIuMTI5LjE5Mk0yMC40NDcuNjQ2Yy0uNzU0LS44MDItNC4xNTctLjgzNC01LjczLS4yMjRhMyAzIDAgMCAwLS43ODYuNDY1YTQxIDQxIDAgMCAwLTMuMzIzIDMuMTc4Yy0uMTEyLjExMy0uMDY0LjIyNS4wOTcuMjI1aDUuNDA5Yy40OTcgMCAuNzg2LjI4OS43ODYuNzg2djYuMWMwIC4xNi4xMjguMjA4LjIyNS4wNjRsMy4yNTgtNC4yNTRjLjUzLS42OS42OS0uODk4LjgzNS0xLjg2MWMuMTkyLTEuNDEzLjA4LTMuNTgtLjc3LTQuNDc5bS02Ljk4MiAxNi4xOGwyLjIzMS0zLjY3NmEuNy43IDAgMCAwIC4wNjQtLjI5VjYuNzNjMC0uMTYtLjExMi0uMjI1LS4yMjQtLjA5N2MtMy4zNTUgMy43NC01Ljk3MSA3LjY3Mi04LjM5NSAxMi40MDdjLS4wNi4xMi4wMTYuMjI1LjE2LjE3N2w1LjAwOS0xLjU0Yy41NjUtLjE3NC44ODItLjQwMiAxLjE1NS0uODUyIi8+PC9zdmc+' },
		{ id: 'optimism', name: 'Optimism', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png' },
		{ id: 'polygon', name: 'Polygon', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png' }
	];

	function selectNetwork(name: string) {
		appState.setNetwork(name);
		isNetworkDropdownOpen = false;
	}
</script>

<div class="flex h-screen w-full overflow-hidden text-gray-900 dark:text-[#eceff4] bg-white dark:bg-[#2e3440] selection:bg-blue-200 dark:selection:bg-blue-800/30">
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
	<div class="flex-1 h-full flex flex-col relative bg-white dark:bg-[#2e3440]">
		<!-- Topbar -->
		<div class="h-14 flex items-center px-4 justify-between drag-region relative z-30">
			<div class="flex items-center gap-2 relative">
				{#if isSidebarCollapsed}
					<button onclick={() => appState.toggleSidebar()} class="p-1.5 hover:bg-gray-100 dark:hover:bg-[#434c5e] rounded-md text-gray-500 dark:text-[#d8dee9] hover:text-black dark:hover:text-[#eceff4] no-drag-region cursor-pointer" aria-label="Open sidebar">
						<PanelLeftOpen size={18} />
					</button>
				{/if}
				
				<!-- Network Dropdown Trigger -->
				<button 
					onclick={() => isNetworkDropdownOpen = !isNetworkDropdownOpen}
					class="flex items-center gap-2 no-drag-region cursor-pointer hover:bg-gray-100 dark:hover:bg-[#434c5e] px-3 py-1.5 rounded-xl transition-colors border border-transparent dark:border-[#434c5e]"
				>
					{#if currentNetwork === 'All Chains'}
						<div class="flex items-center justify-center w-4 h-4"><Network size={16} /></div>
					{:else}
						<img src={networks.find(n => n.name === currentNetwork)?.logoUrl || networks[1].logoUrl} alt={currentNetwork} class="w-4 h-4 rounded-full object-cover" />
					{/if}
					<span class="font-medium text-[15px]">{currentNetwork}</span>
					<span class="text-gray-500 dark:text-[#d8dee9] text-[10px] transform transition-transform duration-200 {isNetworkDropdownOpen ? 'rotate-180' : ''}">▼</span>
				</button>

				{#if isNetworkDropdownOpen}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="fixed inset-0 z-10" onclick={() => isNetworkDropdownOpen = false}></div>
					
					<div transition:slide={{ duration: 150 }} class="absolute top-10 left-8 md:left-2 mt-1 w-56 bg-white dark:bg-[#3b4252] rounded-xl shadow-lg border border-gray-100 dark:border-[#4c566a] py-1.5 z-20 overflow-hidden no-drag-region">
						<div class="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Networks</div>
						{#each networks as net}
							<button 
								onclick={() => selectNetwork(net.name)}
								class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-[#e5e9f0] hover:bg-gray-100 dark:hover:bg-[#3f3f3f] transition-colors"
							>
								<div class="flex items-center gap-2">
									{#if net.id === 'all'}
										<div class="flex items-center justify-center w-5 h-5"><Network size={16} /></div>
									{:else}
										<img src={net.logoUrl} alt={net.name} class="w-5 h-5 rounded-full object-cover shadow-sm" />
									{/if}
									{net.name}
								</div>
								{#if currentNetwork === net.name}
									<Check size={14} class="text-blue-500" />
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			
			<div class="flex items-center gap-4 no-drag-region mb-3">
				<!-- Window controls -->
				<div class="flex items-center gap-2">
					<button onclick={() => window.ipcRenderer?.send('window-minimize')} class="w-3.5 h-3.5 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors cursor-pointer" aria-label="Minimize"></button>
					<button onclick={() => window.ipcRenderer?.send('window-maximize')} class="w-3.5 h-3.5 rounded-full bg-green-500 hover:bg-green-600 transition-colors cursor-pointer" aria-label="Maximize"></button>
					<button onclick={() => window.ipcRenderer?.send('window-close')} class="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors cursor-pointer" aria-label="Close"></button>
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
		{:else if currentView === 'playbooks'}
			<Playbooks />
		{/if}
	</div>
</div>
