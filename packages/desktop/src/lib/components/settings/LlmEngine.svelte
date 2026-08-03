<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import Dropdown from '../Dropdown.svelte';
</script>

{#if configStore.config}
<div class="space-y-7 w-full">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">LLM Engine</h2>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Configure the primary language model provider and generation parameters.</p>
    
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Model Settings</div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Provider</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Select the LLM service provider.</div>
        </div>
        <Dropdown 
          bind:value={configStore.config.llm.provider} 
          onchange={(val) => {
            if (val !== 'custom_provider') {
              configStore.config!.llm.base_url = '';
            }
            configStore.updateConfig({llm: configStore.config!.llm});
          }}
          options={[
            {value: 'gemini', label: 'Google Gemini'},
            {value: 'anthropic', label: 'Anthropic (Claude)'},
            {value: 'openai', label: 'OpenAI'},
            {value: 'nvidia', label: 'NVIDIA (NIM)'},
            {value: 'openrouter', label: 'OpenRouter'},
            {value: '9router', label: '9Router (Local)'},
            {value: 'ollama', label: 'Ollama (Local)'},
            {value: 'groq', label: 'Groq'},
            {value: 'mistral', label: 'Mistral AI'},
            {value: 'xai', label: 'xAI (Grok)'},
            {value: 'deepseek', label: 'DeepSeek'},
            {value: 'custom_provider', label: 'Custom Provider'}
          ]}
          className="min-w-[180px]"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Model Name</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">The specific model identifier to use.</div>
        </div>
        <input 
          type="text" 
          bind:value={configStore.config.llm.model}
          onchange={() => configStore.updateConfig({llm: configStore.config.llm})}
          class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[240px] text-right transition-all"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Temperature</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Controls randomness ({configStore.config.llm.temperature}).</div>
        </div>
        <input 
          type="range" min="0" max="1" step="0.1" 
          bind:value={configStore.config.llm.temperature}
          onchange={(e) => {
            const val = parseFloat(e.currentTarget.value);
            configStore.config!.llm.temperature = val;
            configStore.updateConfig({llm: configStore.config!.llm});
          }}
          class="w-[180px] accent-blue-500"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Frequency Penalty</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Controls word frequency ({configStore.config.llm.frequency_penalty ?? 0.6}).</div>
        </div>
        <input 
          type="range" min="-2" max="2" step="0.1" 
          value={configStore.config.llm.frequency_penalty ?? 0.6}
          oninput={(e) => {
            const val = parseFloat(e.currentTarget.value);
            configStore.config!.llm.frequency_penalty = val;
            configStore.updateConfig({llm: configStore.config!.llm});
          }}
          class="w-[180px] accent-blue-500"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Presence Penalty</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Controls new topic introduction ({configStore.config.llm.presence_penalty ?? 0.3}).</div>
        </div>
        <input 
          type="range" min="-2" max="2" step="0.1" 
          value={configStore.config.llm.presence_penalty ?? 0.3}
          oninput={(e) => {
            const val = parseFloat(e.currentTarget.value);
            configStore.config!.llm.presence_penalty = val;
            configStore.updateConfig({llm: configStore.config!.llm});
          }}
          class="w-[180px] accent-blue-500"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Repetition Penalty</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Controls phrase repetition ({configStore.config.llm.repetition_penalty ?? 1.0}).</div>
        </div>
        <input 
          type="range" min="0" max="2" step="0.05" 
          value={configStore.config.llm.repetition_penalty ?? 1.0}
          oninput={(e) => {
            const val = parseFloat(e.currentTarget.value);
            configStore.config!.llm.repetition_penalty = val;
            configStore.updateConfig({llm: configStore.config!.llm});
          }}
          class="w-[180px] accent-blue-500"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Reasoning Effort</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">For O1/O3 models.</div>
        </div>
        <Dropdown 
          bind:value={configStore.config.llm.reasoning_effort}
          onchange={() => configStore.updateConfig({llm: configStore.config.llm})}
          options={[
            {value: 'low', label: 'Low'},
            {value: 'medium', label: 'Medium'},
            {value: 'high', label: 'High'},
            {value: 'none', label: 'None'}
          ]}
          className="min-w-[140px]"
        />
      </div>

    </div>
  </div>

  {#if configStore.config.llm.provider === 'custom_provider'}
    <div>
      <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Custom Provider Settings</div>
      <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible">
        <div class="flex justify-between items-center py-3.5 px-5">
          <div>
            <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">API Base URL</div>
            <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Base URL for OpenAI-compatible endpoint.</div>
          </div>
          <input 
            type="text" 
            placeholder="http://localhost:1234/v1"
            bind:value={configStore.config.llm.base_url}
            onchange={(e) => {
              const val = e.currentTarget.value;
              configStore.config!.llm.base_url = val;
              configStore.updateConfig({llm: configStore.config!.llm});
            }}
            class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[240px] text-right transition-all"
          />
        </div>
      </div>
    </div>
  {/if}

  <div>
    <div class="text-[0.75rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Image Generation</div>
    <div class="flex flex-col bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-visible">
      
      <div class="flex justify-between items-center py-3.5 px-5 border-b border-gray-200/60 dark:border-white/10">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Image Provider</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Service used for generating images.</div>
        </div>
        <Dropdown 
          bind:value={configStore.config.llm.image_provider}
          onchange={() => configStore.updateConfig({llm: configStore.config.llm})}
          options={[
            {value: 'openai', label: 'OpenAI (DALL-E)'},
            {value: 'gemini', label: 'Google Gemini'}
          ]}
          className="min-w-[180px]"
        />
      </div>

      <div class="flex justify-between items-center py-3.5 px-5">
        <div>
          <div class="text-[0.875rem] font-medium text-gray-900 dark:text-gray-100">Image Model</div>
          <div class="text-[0.75rem] text-gray-500 dark:text-gray-400">Model name (e.g. dall-e-3).</div>
        </div>
        <input 
          type="text" 
          bind:value={configStore.config.llm.image_model}
          onchange={() => configStore.updateConfig({llm: configStore.config.llm})}
          class="bg-gray-100/80 dark:bg-black/30 border border-gray-200/50 dark:border-white/10 rounded-xl px-3.5 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-[240px] text-right transition-all"
        />
      </div>

    </div>
  </div>

  {#if configStore.config.llm.provider === '9router'}
    <div class="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200/80 dark:border-blue-800/50 p-4 rounded-2xl flex gap-3 items-start">
      <div class="text-blue-500 mt-0.5">ℹ️</div>
      <div class="text-xs text-gray-700 dark:text-gray-300">
        <strong class="text-blue-700 dark:text-blue-400 font-medium">Local Proxy Required</strong>
        <p class="mt-1">Ensure you have installed and started the 9Router proxy.</p>
        <div class="mt-3 flex flex-col gap-1.5">
          <code class="bg-blue-100/60 dark:bg-black/30 px-2 py-1 rounded text-[0.75rem] font-mono text-gray-600 dark:text-gray-400 border border-blue-200/50 dark:border-white/5 inline-block w-fit">npm install -g 9router</code>
          <code class="bg-blue-100/60 dark:bg-black/30 px-2 py-1 rounded text-[0.75rem] font-mono text-gray-600 dark:text-gray-400 border border-blue-200/50 dark:border-white/5 inline-block w-fit">9router</code>
        </div>
      </div>
    </div>
  {/if}

</div>
{/if}
