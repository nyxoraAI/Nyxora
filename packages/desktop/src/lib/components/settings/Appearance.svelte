<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import { appState } from '$lib/stores/app';
  import { themeStore } from '$lib/stores/theme';
  import Dropdown from '../Dropdown.svelte';
</script>

{#if configStore.config}
<div class="space-y-8 w-full">
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Appearance</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure the agent's visual theme and display preferences.</p>
    
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">Display Settings</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Theme</div>
          <div class="text-[0.75rem] text-gray-500">Select light, dark, or system default.</div>
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

      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Base Fiat Currency</div>
          <div class="text-[0.75rem] text-gray-500">Currency for displaying portfolio balances.</div>
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

      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Log Level</div>
          <div class="text-[0.75rem] text-gray-500">Verbosity of background process logs.</div>
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
