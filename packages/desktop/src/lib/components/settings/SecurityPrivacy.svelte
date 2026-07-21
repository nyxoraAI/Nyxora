<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import { apiFetch } from '$lib/utils/api';
  import Dropdown from '../Dropdown.svelte';
  
  let oldPassword = $state('');
  let newPassword = $state('');
  let passSaveStatus = $state('');
  let wipingMemory = $state(false);
  let autoLockTime = $state(parseInt(localStorage.getItem('nyxora_auto_lock') || '0'));
  
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

<div class="space-y-8 w-full">
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Security & Privacy</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Manage application access and sensitive operations.</p>
    
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">App Access</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-4 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Change App Password</div>
          <div class="text-[0.75rem] text-gray-500">Update local application authentication.</div>
          {#if passSaveStatus}
            <div class="text-[0.75rem] mt-1 font-medium {passSaveStatus.includes('success') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">{passSaveStatus}
  

</div>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <input 
            type="password" 
            placeholder="Old Password" 
            bind:value={oldPassword}
            class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[140px]"
          />
          <input 
            type="password" 
            placeholder="New Password" 
            bind:value={newPassword}
            class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[140px]"
          />
          <button 
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-[0.85rem] font-medium disabled:opacity-50 transition-colors"
            onclick={handlePasswordChange}
            disabled={!oldPassword || !newPassword}
          >
            Update
          </button>
        </div>
      </div>

      <div class="flex justify-between items-center py-4 px-4 border-t border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Auto-Lock Session (Idle Timeout)</div>
          <div class="text-[0.75rem] text-gray-500">Automatically lock the app after inactivity.</div>
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
    <div class="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">Danger Zone</div>
    <div class="flex flex-col bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-4 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-red-800 dark:text-red-300">Wipe Episodic Memory</div>
          <div class="text-[0.75rem] text-red-600 dark:text-red-400/80">Permanently delete all learned agent memory. This cannot be undone.</div>
        </div>
        <button 
          onclick={handleWipeMemory}
          disabled={wipingMemory}
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-[0.85rem] font-bold disabled:opacity-50 transition-colors shrink-0"
        >
          {wipingMemory ? 'Wiping...' : 'Wipe All Memory'}
        </button>
      </div>

    </div>
  </div>
</div>
