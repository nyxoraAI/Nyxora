<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import Dropdown from '../Dropdown.svelte';
</script>

{#if configStore.policy && configStore.profile}
<div class="space-y-8 w-full">
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Risk & Policy</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Manage global transaction limits and risk profiles for the agent.</p>
    
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">General Risk Limits</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Risk Level</div>
          <div class="text-[0.75rem] text-gray-500">Global operating risk profile.</div>
        </div>
        <Dropdown 
          bind:value={configStore.profile.risk_level}
          onchange={() => configStore.updateProfile({risk_level: configStore.profile?.risk_level})}
          options={[
            {value: 'conservative', label: 'Conservative'},
            {value: 'moderate', label: 'Moderate'},
            {value: 'degen', label: 'Degen (High Risk)'}
          ]}
          className="min-w-[150px]"
        />
      </div>

      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Max USD per Tx</div>
          <div class="text-[0.75rem] text-gray-500">Maximum USD value allowed per transaction.</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[0.85rem] text-gray-500 dark:text-gray-400">$</span>
          <input 
            type="number" step="10" min="0"
            bind:value={configStore.policy.max_usd_per_tx}
            onchange={(e) => {
              const val = parseFloat(e.currentTarget.value);
              configStore.policy.max_usd_per_tx = val;
              configStore.updatePolicy({max_usd_per_tx: val});
            }}
            class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px] text-right"
          />
        </div>
      </div>

      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Daily Spend Limit</div>
          <div class="text-[0.75rem] text-gray-500">Maximum USD value allowed to spend per day.</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[0.85rem] text-gray-500 dark:text-gray-400">$</span>
          <input 
            type="number" step="50" min="0"
            bind:value={configStore.policy.daily_spend_limit}
            onchange={(e) => {
              const val = parseFloat(e.currentTarget.value);
              configStore.policy.daily_spend_limit = val;
              configStore.updatePolicy({daily_spend_limit: val});
            }}
            class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px] text-right"
          />
        </div>
      </div>

      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Max Slippage</div>
          <div class="text-[0.75rem] text-gray-500">Absolute maximum slippage allowed.</div>
        </div>
        <div class="flex items-center gap-2">
          <input 
            type="number" step="0.1" min="0.1" max="100"
            bind:value={configStore.profile.max_slippage}
            onchange={(e) => {
              const val = parseFloat(e.currentTarget.value);
              configStore.profile.max_slippage = val;
              configStore.updateProfile({max_slippage: val});
            }}
            class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[80px] text-right"
          />
          <span class="text-[0.85rem] text-gray-500 dark:text-gray-400">%</span>
        </div>
      </div>

      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Avoid Memecoins</div>
          <div class="text-[0.75rem] text-gray-500">Strictly avoid interacting with memecoins or unknown contracts.</div>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            bind:checked={configStore.profile.avoid_memecoins}
            onchange={(e) => {
              const val = e.currentTarget.checked;
              configStore.profile.avoid_memecoins = val;
              configStore.updateProfile({avoid_memecoins: val});
            }}
            class="sr-only peer"
          >
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

    </div>
  </div>

  <div>
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">Security Controls</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Require User Approval</div>
          <div class="text-[0.75rem] text-gray-500">Pause agent before executing transactions.</div>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            bind:checked={configStore.policy.require_approval}
            onchange={(e) => {
              const val = e.currentTarget.checked;
              configStore.policy.require_approval = val;
              configStore.updatePolicy({require_approval: val});
            }}
            class="sr-only peer"
          >
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Token Whitelist Mode</div>
          <div class="text-[0.75rem] text-gray-500">Only allow trading tokens in the whitelist.</div>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            bind:checked={configStore.policy.whitelist_only}
            onchange={(e) => {
              const val = e.currentTarget.checked;
              configStore.policy.whitelist_only = val;
              configStore.updatePolicy({whitelist_only: val});
            }}
            class="sr-only peer"
          >
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div class="flex flex-col py-3 px-4 border-t border-gray-200 dark:border-white/10">
        <div class="mb-2">
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Allowed Contracts Whitelist</div>
          <div class="text-[0.75rem] text-gray-500">Comma separated list of addresses the agent is allowed to interact with.</div>
        </div>
        <textarea 
          bind:value={configStore.policy.allowed_contracts}
          onchange={(e) => {
            const val = e.currentTarget.value;
            configStore.policy.allowed_contracts = val;
            configStore.updatePolicy({allowed_contracts: val});
          }}
          rows="3"
          placeholder="0x123..., 0xabc..."
          class="w-full bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-2 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        ></textarea>
      </div>

    </div>
  </div>

  

</div>
{/if}
