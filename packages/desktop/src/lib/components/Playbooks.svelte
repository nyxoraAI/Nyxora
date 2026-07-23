<script lang="ts">
  import { onMount } from 'svelte';
  import { BookOpen, Plus, Save, Trash2, Code, FileText, AlertTriangle, Folder, ChevronDown, ChevronRight } from 'lucide-svelte';
  import { playbooksStore, type Playbook } from '$lib/stores/playbooks';
  import { apiFetch } from '$lib/utils/api';

  let playbooks = $derived($playbooksStore.playbooks);
  let isLoading = $derived($playbooksStore.isLoading);

  let selectedFilename = $state<string | null>(null);
  let editContent = $state('');
  let newFilename = $state('');
  let isCreating = $state(false);
  let expandedFolders = $state<Record<string, boolean>>({});

  onMount(() => {
    playbooksStore.fetchPlaybooks();
  });

  $effect(() => {
    if (playbooks.length > 0 && !selectedFilename && !isCreating) {
      handleSelect(playbooks[0]);
    }
  });

  $effect(() => {
    if (selectedFilename && !isCreating) {
      const parts = selectedFilename.split(/[/\\]/);
      if (parts.length > 1 && !expandedFolders[parts[0]]) {
        expandedFolders[parts[0]] = true;
      }
    }
  });

  let groupedPlaybooks = $derived.by(() => {
    return playbooks.reduce((acc, p) => {
      const parts = p.filename.split(/[/\\]/);
      const isRoot = parts.length === 1;
      const folder = isRoot ? 'Root' : parts[0];
      const label = isRoot ? parts[0] : parts.slice(1).join('/');
      
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push({ ...p, label });
      return acc;
    }, {} as Record<string, (Playbook & { label: string })[]>);
  });

  function toggleFolder(folder: string) {
    expandedFolders[folder] = !expandedFolders[folder];
  }

  function handleSelect(p: Playbook) {
    selectedFilename = p.filename;
    editContent = p.content;
    isCreating = false;
  }

  function handleCreateNew() {
    isCreating = true;
    selectedFilename = null;
    newFilename = 'my-new-skill.md';
    editContent = '---\nname: my-new-skill\ndescription: "Description here"\n---\n\n# Instructions\n\n1. Run command `...`\n';
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
      await playbooksStore.fetchPlaybooks();
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
      await playbooksStore.fetchPlaybooks();
    } catch (err) {
      console.error("Failed to delete playbook", err);
      alert("Failed to delete playbook.");
    }
  }
</script>

<div class="flex h-full w-full overflow-hidden bg-white dark:bg-gray-900">
  <!-- Left Sidebar -->
  <div class="w-72 border-r border-gray-200 dark:border-[#3a3a3c] flex flex-col bg-gray-50 dark:bg-gray-950">
    <div class="p-4 border-b border-gray-200 dark:border-[#3a3a3c] flex justify-between items-center bg-gray-50 dark:bg-gray-950">
      <div class="flex items-center gap-2 font-semibold">
        <BookOpen size={18} /> Skill Store
      </div>
      <button onclick={handleCreateNew} class="text-blue-500 hover:text-blue-600 p-1" title="New Playbook">
        <Plus size={18} />
      </button>
    </div>
    
    <div class="flex-1 overflow-y-auto py-2">
      {#if isLoading && playbooks.length === 0}
        <div class="p-4 text-center text-gray-500 opacity-50">Loading...</div>
      {:else}
        {#each Object.entries(groupedPlaybooks).sort((a, b) => a[0].localeCompare(b[0])) as [folder, items]}
          {@const isExpanded = expandedFolders[folder] === true}
          <div class="mb-0.5">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              onclick={() => toggleFolder(folder)}
              class="px-4 py-2 cursor-pointer flex items-center gap-2 text-gray-500 font-semibold text-xs uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-[#3a3a3c] transition-colors"
            >
              {#if isExpanded}
                <ChevronDown size={14} />
              {:else}
                <ChevronRight size={14} />
              {/if}
              <Folder size={14} />
              <span class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                {folder} ({items.length})
              </span>
            </div>
            
            {#if isExpanded}
              <div class="flex flex-col">
                {#each items as p}
                  {@const isSelected = selectedFilename === p.filename && !isCreating}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div 
                    onclick={() => handleSelect(p)}
                    class="pl-10 pr-4 py-2 cursor-pointer flex items-center gap-2 text-sm transition-colors border-l-4 {isSelected ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500 text-gray-900 dark:text-[#ffffff] font-medium' : 'border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-[#3a3a3c]'}"
                    title={p.filename}
                  >
                    <FileText size={14} class={isSelected ? 'opacity-100 text-blue-500' : 'opacity-60'} />
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
  <div class="flex-1 flex flex-col bg-white dark:bg-gray-900">
    {#if selectedFilename || isCreating}
      <div class="px-6 py-4 border-b border-gray-200 dark:border-[#3a3a3c] flex justify-between items-center">
        <div class="flex items-center gap-3 flex-1">
          <Code size={18} class="text-gray-400" />
          {#if isCreating}
            <input 
              bind:value={newFilename}
              placeholder="e.g. custom-skill.md"
              class="max-w-[300px] w-full px-3 py-1.5 bg-gray-50 dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] rounded-lg outline-none focus:border-blue-500 transition-colors font-mono text-sm"
            />
          {:else}
            <span class="font-semibold text-gray-800 dark:text-[#f5f5f7] font-mono text-sm">{selectedFilename}</span>
          {/if}
        </div>
        
        <div class="flex gap-2">
          {#if !isCreating && selectedFilename}
            <button 
              onclick={() => handleDelete(selectedFilename as string)}
              class="flex items-center gap-1.5 px-3 py-1.5 border border-red-500 text-red-500 rounded-lg hover:bg-red-500/10 transition-colors font-medium text-sm"
            >
              <Trash2 size={14} /> Delete
            </button>
          {/if}
          <button 
            onclick={handleSave}
            class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm"
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>
      
      <div class="flex-1 p-6 flex flex-col">
        <div class="mb-4 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 rounded-lg border border-yellow-200 dark:border-yellow-700/50">
          <AlertTriangle size={16} />
          Playbooks are written in Markdown. Nyxora reads these instructions to execute terminal commands autonomously.
        </div>
        
        <textarea
          bind:value={editContent}
          class="flex-1 w-full resize-none p-4 font-mono text-sm leading-relaxed bg-gray-50 dark:bg-[#1d1d1f] border border-gray-200 dark:border-[#48484a] rounded-xl outline-none focus:border-blue-500 transition-colors"
        ></textarea>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center text-gray-400">
        <BookOpen size={48} class="mb-4 opacity-20" />
        <h3 class="text-xl font-medium text-gray-600 dark:text-[#e5e5ea]">Select a Playbook</h3>
        <p class="mt-2 text-sm">Or create a new one to teach Nyxora new skills.</p>
      </div>
    {/if}
  </div>
</div>
