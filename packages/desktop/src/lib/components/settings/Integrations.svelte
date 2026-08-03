<script lang="ts">
  import { onMount } from 'svelte';
  import { Key } from '@lucide/svelte';
  import { apiFetch } from '$lib/utils/api';
  import GoogleAuthWizard from './GoogleAuthWizard.svelte';

  let googleConnected = $state(false);
  let showGoogleWizard = $state(false);
  let authUrlInput = $state('');

  onMount(async () => {
    try {
      const res = await apiFetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        googleConnected = data.connected;
      }
    } catch (e) {
      console.error(e);
    }
  });

  async function handleDisconnect() {
    try {
      const res = await apiFetch('/api/auth/google', { method: 'DELETE' });
      if (res.ok) googleConnected = false;
    } catch (e) {
      alert('Failed to disconnect.');
    }
  }

  async function handleSignIn() {
    try {
      const res = await apiFetch('/api/auth/google/url');
      const data = await res.json();
      if (res.ok) {
        window.open(data.url, '_blank', 'width=600,height=700');
      } else {
        alert('Setup Required: Please upload Client Secret first.');
      }
    } catch (e) {
      alert('Failed to initiate Google Auth.');
    }
  }

  async function handleVerifyUrl() {
    try {
      const res = await apiFetch('/api/auth/google/submit-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authUrlInput.trim() })
      });
      if (res.ok) {
        googleConnected = true;
        authUrlInput = '';
      } else {
        const err = await res.json();
        alert('Verification failed: ' + err.error);
      }
    } catch (e) {
      alert('Network error.');
    }
  }
</script>

<div class="space-y-7 w-full">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Integrations</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Connect Nyxora to external services to expand its capabilities.</p>

    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Connected Apps</div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden p-5">
      <div class="flex items-start justify-between">
        <div>
          <h4 class="text-gray-900 dark:text-white font-semibold text-sm m-0 mb-1">Google Workspace</h4>
          <p class="text-gray-500 dark:text-gray-400 text-xs m-0 leading-relaxed max-w-[420px]">Allow Nyxora to securely manage emails, calendar, docs, and drive locally.</p>
        </div>
        
        <div class="flex gap-2.5 items-center">
          <button 
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            onclick={() => showGoogleWizard = true}
          >
            <Key size={13} /> Config
          </button>
          
          {#if googleConnected}
            <div class="flex items-center gap-2.5">
              <div class="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-xl font-semibold text-xs border border-green-500/20">
                <span class="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
                Connected
              </div>
              <button
                onclick={handleDisconnect}
                class="bg-transparent text-red-500 border border-red-500/40 hover:bg-red-500/10 px-3.5 py-1.5 rounded-xl font-semibold cursor-pointer text-xs transition-colors"
              >
                Disconnect
              </button>
            </div>
          {:else}
            <button 
              onclick={handleSignIn}
              class="bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-none px-4 py-1.5 rounded-xl font-semibold cursor-pointer flex items-center gap-2 text-xs hover:opacity-90 transition-opacity shadow-sm"
            >
              Sign in with Google
            </button>
          {/if}
        </div>
      </div>

      {#if !googleConnected}
        <div class="mt-4 pt-4 border-t border-dashed border-gray-200/60 dark:border-white/10">
          <p class="m-0 mb-2.5 text-xs text-gray-500 dark:text-gray-400">
            Used a <strong>Desktop App</strong> credential and got a "Connection Refused" error? Paste the broken URL here:
          </p>
          <div class="flex gap-2">
            <input 
              type="text" 
              placeholder="http://localhost/?state=..."
              bind:value={authUrlInput}
              class="flex-1 bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 text-gray-900 dark:text-gray-100 px-3 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 text-xs transition-all"
            />
            <button 
              class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
              disabled={!authUrlInput.trim()}
              onclick={handleVerifyUrl}
            >
              Verify
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showGoogleWizard}
  <GoogleAuthWizard onClose={() => showGoogleWizard = false} />
{/if}

