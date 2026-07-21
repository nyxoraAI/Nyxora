<script lang="ts">
  import { onMount } from 'svelte';
  import { Plug, Search } from 'lucide-svelte';
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

  onMount(async () => {
    try {
      const res = await apiFetch('/api/skills/external');
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
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async function handleToggle(skillName: string, currentStatus: boolean) {
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
      console.error('Failed to toggle skill', e);
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
  <div class="text-gray-500 p-8 text-center text-sm">Loading external skills...</div>
{:else}
  <div class="space-y-8 w-full">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">External Skills</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">User-installed third-party agent skills and custom integrations.</p>

      <div class="flex items-center bg-gray-50 dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 mb-6 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
        <Search size={18} class="text-gray-400" />
        <input 
          type="text" 
          placeholder="Filter installed external skills..." 
          bind:value={searchQuery}
          class="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 py-3.5 px-3 text-[0.95rem] placeholder-gray-400"
        />
        <span class="text-gray-500 text-[0.85rem]">{filteredSkills.length} shown</span>
      </div>

      <div class="space-y-2.5">
        {#each filteredSkills as skill (skill.function.name)}
          {@const isActive = skill.isActive !== false}
          {@const formattedName = formatSkillName(skill.function.name)}
          
          <div class="flex items-center justify-between bg-white dark:bg-[#18181b]/50 p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm transition-colors {isActive ? 'border-gray-300 dark:border-white/10' : ''}">
            <div class="flex items-start gap-4 flex-1">
              <div class="mt-0.5">
                <Plug size={20} class={isActive ? 'text-blue-500' : 'text-gray-400'} />
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
{/if}
