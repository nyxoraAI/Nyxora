<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/utils/api';
  import { BookOpen, Workflow, Plus, Save, Trash2, Code, FileText, AlertTriangle, Folder, ChevronDown, ChevronRight } from '@lucide/svelte';

  interface Playbook {
    filename: string;
    content: string;
  }

  let playbooks = $state<Playbook[]>([]);
  let selectedFilename = $state<string | null>(null);
  let editContent = $state<string>('');
  let newFilename = $state<string>('');
  let isCreating = $state(false);
  let isLoading = $state(false);
  let expandedFolders = $state<Record<string, boolean>>({});

  function toggleFolder(folder: string) {
    expandedFolders[folder] = !expandedFolders[folder];
  }

  let groupedPlaybooks = $derived(() => {
    return playbooks.reduce((acc, p) => {
      const parts = p.filename.split(/[/\\]/); // Support both slashes
      const isRoot = parts.length === 1;
      const folder = isRoot ? 'Root' : parts[0];
      const label = isRoot ? parts[0] : parts.slice(1).join('/');
      
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push({ ...p, label });
      return acc;
    }, {} as Record<string, (Playbook & { label: string })[]>);
  });

  // Auto-expand folder of selected file when it changes
  $effect(() => {
    if (selectedFilename && !isCreating) {
      const parts = selectedFilename.split(/[/\\]/);
      if (parts.length > 1 && !expandedFolders[parts[0]]) {
        expandedFolders[parts[0]] = true;
      }
    }
  });

  onMount(() => {
    fetchPlaybooks();
  });

  async function fetchPlaybooks() {
    isLoading = true;
    try {
      const res = await apiFetch('/api/playbooks');
      if (res.ok) {
        const data = await res.json();
        playbooks = data || [];
        if (playbooks.length > 0 && !selectedFilename && !isCreating) {
          handleSelect(playbooks[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch playbooks", err);
    } finally {
      isLoading = false;
    }
  }

  function handleSelect(p: Playbook) {
    selectedFilename = p.filename;
    editContent = p.content;
    isCreating = false;
  }

  function handleCreateNew() {
    isCreating = true;
    selectedFilename = null;
    newFilename = 'my-new-workflow.md';
    editContent = '---\nname: my-new-workflow\ndescription: "Description here"\n---\n\n# Instructions\n\n1. Run command `...`\n';
  }

  async function handleSave() {
    const targetFilename = isCreating ? newFilename : selectedFilename;
    if (!targetFilename) return;
    
    try {
      await apiFetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: targetFilename, content: editContent })
      });
      await fetchPlaybooks();
      if (isCreating) {
        isCreating = false;
        selectedFilename = targetFilename;
      }
    } catch (err) {
      console.error("Failed to save playbook", err);
      alert("Failed to save playbook.");
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await apiFetch(`/api/playbooks?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      selectedFilename = null;
      await fetchPlaybooks();
    } catch (err) {
      console.error("Failed to delete playbook", err);
      alert("Failed to delete playbook.");
    }
  }
</script>

<div class="flex h-[72vh] w-full overflow-hidden rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#222226] shadow-sm">
  <!-- Left Sidebar -->
  <div class="w-[280px] border-r border-gray-200/60 dark:border-white/10 flex flex-col bg-gray-100/60 dark:bg-[#1c1c1e]/60">
    <div class="p-4 border-b border-gray-200/60 dark:border-white/10 flex justify-between items-center">
      <div class="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 text-xs tracking-tight">
        <Workflow size={16} class="text-blue-500" /> Workflows
      </div>
      <button 
        onclick={handleCreateNew} 
        class="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors" 
        title="New Workflow"
      >
        <Plus size={16} />
      </button>
    </div>
    
    <div class="flex-1 overflow-y-auto p-2">
      {#if isLoading && playbooks.length === 0}
        <div class="p-4 text-center text-gray-500 text-xs">Loading...</div>
      {:else}
        {#each Object.entries(groupedPlaybooks()).sort((a, b) => a[0].localeCompare(b[0])) as [folder, items] (folder)}
          {@const isExpanded = expandedFolders[folder] === true}
          <div class="mb-1">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              onclick={() => toggleFolder(folder)}
              class="px-3 py-1.5 cursor-pointer flex items-center gap-2 text-gray-500 dark:text-gray-400 font-bold text-[0.7rem] uppercase tracking-wider hover:bg-gray-200/50 dark:hover:bg-white/5 rounded-lg transition-colors select-none"
            >
              {#if isExpanded}
                <ChevronDown size={13} />
              {:else}
                <ChevronRight size={13} />
              {/if}
              <Folder size={13} class="text-gray-400" />
              <span class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                {folder} ({items.length})
              </span>
            </div>
            
            {#if isExpanded}
              <div class="flex flex-col mt-0.5 space-y-0.5">
                {#each items as p (p.filename)}
                  {@const isSelected = selectedFilename === p.filename && !isCreating}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div 
                    onclick={() => handleSelect(p)}
                    class="pl-9 pr-3 py-1.5 cursor-pointer flex items-center gap-2 text-xs transition-all select-none rounded-lg {isSelected ? 'bg-blue-500 text-white font-medium shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-white/5'}"
                    title={p.filename}
                  >
                    <FileText size={13} class={isSelected ? 'text-white' : 'text-gray-400'} />
                    <span class="whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                      {p.label}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Right Editor -->
  <div class="flex-1 flex flex-col bg-transparent min-h-0">
    {#if selectedFilename || isCreating}
      <div class="px-5 py-3.5 border-b border-gray-200/60 dark:border-white/10 flex justify-between items-center bg-gray-50/40 dark:bg-black/20">
        <div class="flex items-center gap-2.5 flex-1">
          <Code size={16} class="text-gray-400" />
          {#if isCreating}
            <input 
              bind:value={newFilename}
              placeholder="e.g. custom-skill.md"
              class="flex-1 max-w-[300px] px-3 py-1 bg-white dark:bg-[#27272a] border border-gray-200/60 dark:border-white/10 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-xs"
            />
          {:else}
            <span class="font-bold text-gray-800 dark:text-gray-200 text-xs tracking-tight">{selectedFilename}</span>
          {/if}
        </div>
        <div class="flex gap-2">
          {#if !isCreating && selectedFilename}
            <button 
              onclick={() => handleDelete(selectedFilename as string)}
              class="flex items-center gap-1.5 px-3 py-1 bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer text-xs font-medium transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          {/if}
          <button 
            onclick={handleSave}
            class="flex items-center gap-1.5 px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white border-none rounded-lg cursor-pointer text-xs font-medium transition-colors shadow-sm"
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>
      <div class="flex-1 flex flex-col p-5 min-h-0">
        <div class="mb-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/15 px-3 py-2 rounded-xl border border-amber-200/60 dark:border-amber-900/30">
          <AlertTriangle size={14} class="flex-shrink-0" />
          <span>Workflows are written in Markdown. Nyxora reads these instructions to execute terminal commands autonomously.</span>
        </div>
        <textarea
          bind:value={editContent}
          class="flex-1 w-full resize-none p-4 font-mono text-xs leading-relaxed bg-gray-50/50 dark:bg-black/20 text-gray-900 dark:text-gray-100 border border-gray-200/60 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          spellcheck="false"
        ></textarea>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <BookOpen size={40} class="opacity-30 mb-3" />
        <h3 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Select a Playbook</h3>
        <p class="text-xs">Or create a new one to teach Nyxora new skills.</p>
      </div>
    {/if}
  </div>
</div>
