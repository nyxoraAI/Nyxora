<script lang="ts">
  import { onMount } from 'svelte';
  import { Compass, Search, Terminal, FileText, FileEdit, Globe, ShieldAlert, AlertTriangle, FileSearch, Search as SearchIcon, Mail, Calendar, FileSpreadsheet, BookOpen, ClipboardList, GitBranch, MessageCircle, Layout, Mic, AlignLeft, Scissors } from 'lucide-svelte';
  import { apiFetch } from '$lib/utils/api';

  interface SkillParam {
    type: string;
    description?: string;
    enum?: string[];
  }

  interface SkillDefinition {
    type: string;
    isActive?: boolean;
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, SkillParam>;
        required: string[];
      };
    };
  }

  let skills = $state<SkillDefinition[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(true);
  let pendingToggle = $state<{skillName: string, currentStatus: boolean} | null>(null);

  onMount(async () => {
    try {
      const res = await apiFetch('/api/skills/system');
      if (res.ok) {
        skills = await res.json();
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  });

  function formatSkillName(name: string) {
    let formatted = name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    if (name === 'run_terminal_command') {
      formatted += ' (UNSAFE)';
    }
    return formatted;
  }

  const iconMap: Record<string, any> = {
    'run terminal command (unsafe)': Terminal,
    'read local file': FileText,
    'write local file': FileEdit,
    'browse website': Globe,
    'update security policy': ShieldAlert,
    'analyze document': FileSearch,
    'search web': SearchIcon,
    'read gmail inbox': Mail,
    'list calendar events': Calendar,
    'append row to sheets': FileSpreadsheet,
    'read google docs': BookOpen,
    'read google form responses': ClipboardList,
    'edit local file': Scissors,
    'execute git command': GitBranch,
    'manage twitter': MessageCircle,
    'manage notion': Layout,
    'transcribe audio': Mic,
    'summarize text': AlignLeft
  };

  async function handleToggle(skillName: string, currentStatus: boolean) {
    if (skillName === 'run_terminal_command' && !currentStatus) {
      pendingToggle = { skillName, currentStatus };
      return;
    }
    await executeToggle(skillName, currentStatus);
  }

  async function executeToggle(skillName: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    
    // Optimistic UI update
    skills = skills.map(s => 
      s.function.name === skillName ? { ...s, isActive: newStatus } : s
    );

    try {
      await apiFetch('/api/skills/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName, active: newStatus })
      });
    } catch (e) {
      // Revert on error
      skills = skills.map(s => 
        s.function.name === skillName ? { ...s, isActive: currentStatus } : s
      );
      console.error('Failed to toggle OS skill', e);
    }
  }

  let filteredSkills = $derived(
    skills.filter(skill => 
      skill.function.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.function.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
</script>

{#if isLoading}
  <div class="text-gray-500 p-8 text-center text-sm">Loading OS skills...</div>
{:else}
  <div class="space-y-8 w-full">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">OS Skills</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">System-level capabilities for the agent OS.</p>

      <div class="flex items-center bg-gray-50 dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 mb-6 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
        <Search size={18} class="text-gray-400" />
        <input 
          type="text" 
          placeholder="Filter OS skills..." 
          bind:value={searchQuery}
          class="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 py-3.5 px-3 text-[0.95rem] placeholder-gray-400"
        />
        <span class="text-gray-500 text-[0.85rem]">{filteredSkills.length} shown</span>
      </div>

      <div class="space-y-2.5">
        {#each filteredSkills as skill (skill.function.name)}
          {@const isActive = skill.isActive !== false}
          {@const formattedName = formatSkillName(skill.function.name)}
          {@const IconComponent = iconMap[formattedName.toLowerCase()] || Compass}
          
          <div class="flex items-center justify-between bg-white dark:bg-[#18181b]/50 p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm transition-colors {isActive ? 'border-gray-300 dark:border-white/10' : ''}">
            <div class="flex items-start gap-4 flex-1">
              <div class="mt-0.5">
                <IconComponent size={20} class={isActive ? 'text-blue-500' : 'text-gray-400'} />
              </div>
              <div>
                <h3 class="m-0 mb-1.5 text-[1rem] font-semibold {isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}">
                  {formattedName}
                </h3>
                <p class="m-0 text-gray-500 dark:text-gray-400 text-[0.85rem] leading-relaxed max-w-[800px]">
                  {skill.function.description}
                </p>
              </div>
            </div>
            
            <div class="ml-6 flex-shrink-0">
              <button 
                onclick={() => handleToggle(skill.function.name, isActive)}
                class="relative w-10 h-5.5 rounded-full border-none cursor-pointer transition-colors duration-300 p-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#18181b] {isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}"
              >
                <div class="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] {isActive ? 'left-[20px]' : 'left-[2px]'}"></div>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  {#if pendingToggle}
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div class="bg-white dark:bg-[#18181b] border border-red-500/40 rounded-xl p-8 max-w-lg w-full shadow-2xl">
        <div class="flex items-center gap-4 mb-4">
          <div class="bg-red-500/10 p-3 rounded-full">
            <AlertTriangle size={32} class="text-red-500" />
          </div>
          <h2 class="m-0 text-gray-900 dark:text-white text-xl font-semibold">DANGER ZONE: System Access</h2>
        </div>
        
        <p class="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
          You are about to enable <strong>Terminal Execution</strong>. This grants the AI agent 
          <strong> full, unrestrained access</strong> to execute arbitrary shell scripts on your host operating system.
        </p>
        <p class="text-red-600 dark:text-red-400 font-bold text-[0.9rem] mb-8">
          ⚠️ The agent could read sensitive files, modify your system, or execute harmful commands if prompted maliciously.
        </p>

        <div class="flex justify-end gap-3">
          <button 
            onclick={() => pendingToggle = null}
            class="px-5 py-2.5 bg-transparent border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button 
            onclick={() => {
              if (pendingToggle) executeToggle(pendingToggle.skillName, pendingToggle.currentStatus);
              pendingToggle = null;
            }}
            class="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white border-none rounded-lg font-semibold transition-colors"
          >
            I Understand the Risks, Enable
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
