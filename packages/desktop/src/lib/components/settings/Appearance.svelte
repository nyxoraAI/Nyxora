<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import { appState } from '$lib/stores/app';
  import { themeStore } from '$lib/stores/theme';
  import Dropdown from '../Dropdown.svelte';
</script>

{#if configStore.config}
<div class="space-y-7 w-full">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Appearance</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Configure the agent's visual theme and display preferences.</p>
    
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Display Settings</div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Theme</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Select light, dark, or system default.</div>
        </div>
        <Dropdown 
          value={$themeStore} 
          onchange={(val) => themeStore.setTheme(val as 'light' | 'dark' | 'system')}
          options={[
            {value: 'system', label: 'System Default'},
            {value: 'light', label: 'Light'},
            {value: 'dark', label: 'Dark'}
          ]}
          className="min-w-[150px]"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Base Fiat Currency</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Currency for displaying portfolio balances.</div>
        </div>
        <Dropdown 
          bind:value={configStore.config.agent.base_fiat}
          onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
          options={[
            {value: 'USD', label: 'USD ($)'},
            {value: 'EUR', label: 'EUR (€)'},
            {value: 'GBP', label: 'GBP (£)'},
            {value: 'IDR', label: 'IDR (Rp)'}
          ]}
          className="min-w-[150px]"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Log Level</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Verbosity of background process logs.</div>
        </div>
        <Dropdown 
          bind:value={configStore.config.agent.log_level}
          onchange={() => configStore.updateConfig({agent: configStore.config.agent})}
          options={[
            {value: 'debug', label: 'Debug'},
            {value: 'info', label: 'Info'},
            {value: 'warn', label: 'Warn'},
            {value: 'error', label: 'Error'}
          ]}
          className="min-w-[150px]"
        />
      </div>

    </div>
  </div>

</div>
{/if}
