<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import { apiFetch } from '$lib/utils/api';
  import Dropdown from '../Dropdown.svelte';
  import { ShieldCheck, Terminal, DollarSign, Ban, CheckCircle2 } from '@lucide/svelte';
  import { onMount } from 'svelte';
  
  let oldPassword = $state('');
  let newPassword = $state('');
  let passSaveStatus = $state('');
  let wipingMemory = $state(false);
  let autoLockTime = $state(parseInt(localStorage.getItem('nyxora_auto_lock') || '0'));

  // Sync state with policy in ~/.nyxora/config/policy.yaml
  let requireApproval = $state(true);
  let autoApproveShell = $state(false);
  let maxUsdPerTx = $state(100);
  let blacklistText = $state('');
  let policySyncStatus = $state('');

  onMount(() => {
    // Initialize from configStore policy or reload directly
    initFromPolicy();
  });

  function initFromPolicy() {
    const policy = configStore.policy;
    if (policy) {
      requireApproval = policy.require_approval !== undefined ? policy.require_approval : true;
      autoApproveShell = policy.auto_approve_shell || false;
      maxUsdPerTx = policy.max_usd_per_tx ?? 100;
      if (policy.blacklisted_addresses && Array.isArray(policy.blacklisted_addresses)) {
        blacklistText = policy.blacklisted_addresses.join(', ');
      }
    }
  }

  // React to configStore changes
  $effect(() => {
    const policy = configStore.policy;
    if (policy && !policySyncStatus) {
      requireApproval = policy.require_approval !== undefined ? policy.require_approval : true;
      autoApproveShell = policy.auto_approve_shell || false;
      maxUsdPerTx = policy.max_usd_per_tx ?? 100;
      if (policy.blacklisted_addresses && Array.isArray(policy.blacklisted_addresses)) {
        blacklistText = policy.blacklisted_addresses.join(', ');
      }
    }
  });

  async function savePolicyToConfig() {
    const blacklisted_addresses = blacklistText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const updatedPolicy = {
      require_approval: requireApproval,
      auto_approve_shell: autoApproveShell,
      max_usd_per_tx: Number(maxUsdPerTx) || 100,
      blacklisted_addresses
    };

    policySyncStatus = 'Syncing...';
    try {
      await configStore.savePolicy(updatedPolicy);
      policySyncStatus = 'Synchronized with ~/.nyxora/config';
      setTimeout(() => {
        policySyncStatus = '';
      }, 3000);
    } catch (err) {
      policySyncStatus = 'Failed to sync with ~/.nyxora/config';
    }
  }

  function toggleWeb3Approval() {
    requireApproval = !requireApproval;
    savePolicyToConfig();
  }

  function toggleShellApproval() {
    autoApproveShell = !autoApproveShell;
    savePolicyToConfig();
  }

  function handleAutoLockChange() {
    localStorage.setItem('nyxora_auto_lock', autoLockTime.toString());
  }
  
  async function handleWipeMemory() {
    if (confirm("DANGER: Are you sure you want to permanently wipe all episodic memory? This cannot be undone.")) {
      wipingMemory = true;
      try {
        const res = await apiFetch('/api/memory/all', { method: 'DELETE' });
        if (res.ok) alert("Episodic memory wiped completely.");
        else alert("Failed to wipe memory.");
      } catch (err) {
        alert("Failed to wipe memory.");
      } finally {
        wipingMemory = false;
      }
    }
  }

  async function handlePasswordChange() {
    try {
      passSaveStatus = 'Saving...';
      const res = await apiFetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        passSaveStatus = 'Password updated successfully';
        oldPassword = '';
        newPassword = '';
      } else {
        passSaveStatus = data.error || 'Failed to update password';
      }
    } catch (err) {
      passSaveStatus = 'Connection failed';
    }
    setTimeout(() => passSaveStatus = '', 4000);
  }
</script>

<div class="space-y-7 w-full">
  <div>
    <div class="flex items-center justify-between mb-1">
      <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Security & Privacy</h2>
      {#if policySyncStatus}
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={13} /> {policySyncStatus}
        </div>
      {/if}
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Manage application access, autonomous authorizations, and risk limits synced with <code class="text-gray-700 dark:text-gray-300 font-mono text-[0.7rem] bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">~/.nyxora/config</code>.</p>
    
    <!-- Action Authorizations (Approvals) -->
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
      <ShieldCheck size={14} class="text-blue-500" /> Action Authorizations (Approvals)
    </div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible mb-7">
      
      <!-- Web3 Transactions -->
      <div class="flex justify-between items-center py-4 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div class="pr-4">
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Web3 Transactions (Send/Swap Tokens)</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Allows the agent to sign blockchain transactions without your explicit approval.</div>
        </div>
        <button 
          type="button"
          role="switch"
          aria-checked={!requireApproval}
          onclick={toggleWeb3Approval}
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {!requireApproval ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}"
        >
          <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {!requireApproval ? 'translate-x-5' : 'translate-x-0'}"></span>
        </button>
      </div>

      <!-- Shell Command Execution -->
      <div class="flex justify-between items-center py-4 px-5">
        <div class="pr-4">
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Shell Command Execution (Terminal)</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Allows the agent to execute commands directly on your operating system.</div>
        </div>
        <button 
          type="button"
          role="switch"
          aria-checked={autoApproveShell}
          onclick={toggleShellApproval}
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {autoApproveShell ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}"
        >
          <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {autoApproveShell ? 'translate-x-5' : 'translate-x-0'}"></span>
        </button>
      </div>

    </div>

    <!-- Risk Limits -->
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
      <DollarSign size={14} class="text-emerald-500" /> Risk Limits
    </div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible mb-7">
      
      <!-- Max Spend Limit -->
      <div class="flex justify-between items-center py-4 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div class="pr-4">
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Maximum Spend Limit (USD)</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">The agent will reject transactions estimating a value higher than this limit per transaction.</div>
        </div>
        <div class="relative flex items-center">
          <span class="absolute left-3 text-xs font-semibold text-gray-500 dark:text-gray-400">$</span>
          <input 
            type="number" 
            bind:value={maxUsdPerTx}
            onblur={savePolicyToConfig}
            class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl pl-7 pr-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[110px] text-right transition-all"
          />
        </div>
      </div>

      <!-- Blacklisted Addresses -->
      <div class="flex flex-col py-4 px-5">
        <div class="flex justify-between items-start mb-2.5">
          <div>
            <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Blacklisted Addresses</div>
            <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">The agent will not be able to send funds or interact with these smart contracts (comma separated).</div>
          </div>
        </div>
        <textarea 
          rows="2"
          placeholder="0x0000...0000, 0xdead...beef"
          bind:value={blacklistText}
          onblur={savePolicyToConfig}
          class="w-full bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl p-3 text-xs font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y transition-all"
        ></textarea>
      </div>

    </div>

    <!-- App Access -->
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">App Access</div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-4 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Change App Password</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Update local application authentication.</div>
          {#if passSaveStatus}
            <div class="text-[0.75rem] mt-1 font-medium {passSaveStatus.includes('success') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">{passSaveStatus}</div>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <input 
            type="password" 
            placeholder="Old Password" 
            bind:value={oldPassword}
            class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[130px] transition-all"
          />
          <input 
            type="password" 
            placeholder="New Password" 
            bind:value={newPassword}
            class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[130px] transition-all"
          />
          <button 
            class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50 transition-all shadow-sm"
            onclick={handlePasswordChange}
            disabled={!oldPassword || !newPassword}
          >
            Update
          </button>
        </div>
      </div>

      <div class="flex justify-between items-center py-4 px-5">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Auto-Lock Session (Idle Timeout)</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Automatically lock the app after inactivity.</div>
        </div>
        <Dropdown 
          bind:value={autoLockTime}
          onchange={handleAutoLockChange}
          options={[
            {value: 0, label: 'Off'},
            {value: 15, label: '15 Minutes'},
            {value: 30, label: '30 Minutes'},
            {value: 60, label: '1 Hour'}
          ]}
          className="min-w-[150px]"
        />
      </div>

    </div>
  </div>

  <div>
    <div class="text-[0.75rem] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 px-1">Danger Zone</div>
    <div class="flex flex-col bg-red-50/60 dark:bg-red-900/15 border border-red-200/80 dark:border-red-900/40 rounded-2xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-4 px-5">
        <div>
          <div class="text-[0.875rem] font-semibold text-red-800 dark:text-red-300">Wipe Episodic Memory</div>
          <div class="text-[0.75rem] text-red-600 dark:text-red-400/80">Permanently delete all learned agent memory. This cannot be undone.</div>
        </div>
        <button 
          onclick={handleWipeMemory}
          disabled={wipingMemory}
          class="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {wipingMemory ? 'Wiping...' : 'Wipe All Memory'}
        </button>
      </div>

    </div>
  </div>
</div>


