<script lang="ts">
  import { configStore } from '$lib/stores/config.svelte';
  import Dropdown from '../Dropdown.svelte';
</script>

{#if configStore.config}
<div class="space-y-8 w-full">
  <div>
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">LLM Engine</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure the primary language model provider and generation parameters.</p>
    
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">Model Settings</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Provider</div>
          <div class="text-[0.75rem] text-gray-500">Select the LLM service provider.</div>
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

      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Model Name</div>
          <div class="text-[0.75rem] text-gray-500">The specific model identifier to use.</div>
        </div>
        <input 
          type="text" 
          bind:value={configStore.config.llm.model}
          onchange={() => configStore.updateConfig({llm: configStore.config.llm})}
          class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[240px] text-right"
        />
      </div>

      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Temperature</div>
          <div class="text-[0.75rem] text-gray-500">Controls randomness ({configStore.config.llm.temperature}).</div>
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

      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Reasoning Effort</div>
          <div class="text-[0.75rem] text-gray-500">For O1/O3 models.</div>
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
      <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">Custom Provider Settings</div>
      <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
        <div class="flex justify-between items-center py-3 px-4">
          <div>
            <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">API Base URL</div>
            <div class="text-[0.75rem] text-gray-500">Base URL for OpenAI-compatible endpoint.</div>
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
            class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[240px] text-right"
          />
        </div>
      </div>
    </div>
  {/if}

  <div>
    <div class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-3">Image Generation</div>
    <div class="flex flex-col bg-white dark:bg-[#27272a]/50 border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-white/10">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Image Provider</div>
          <div class="text-[0.75rem] text-gray-500">Service used for generating images.</div>
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

      <div class="flex justify-between items-center py-3 px-4">
        <div>
          <div class="text-[0.9rem] font-medium text-gray-800 dark:text-gray-200">Image Model</div>
          <div class="text-[0.75rem] text-gray-500">Model name (e.g. dall-e-3).</div>
        </div>
        <input 
          type="text" 
          bind:value={configStore.config.llm.image_model}
          onchange={() => configStore.updateConfig({llm: configStore.config.llm})}
          class="bg-gray-100 dark:bg-[#3f3f46]/50 border border-transparent dark:border-white/5 rounded-lg px-3 py-1.5 text-[0.85rem] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[240px] text-right"
        />
      </div>

    </div>
  </div>

  {#if configStore.config.llm.provider === '9router'}
    <div class="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl flex gap-3 items-start">
      <div class="text-blue-500 mt-0.5">ℹ️</div>
      <div class="text-sm text-gray-700 dark:text-gray-300">
        <strong class="text-blue-700 dark:text-blue-400 font-medium">Local Proxy Required</strong>
        <p class="mt-1">Ensure you have installed and started the 9Router proxy.</p>
        <div class="mt-3 flex flex-col gap-1.5">
          <code class="bg-blue-100/50 dark:bg-black/30 px-2 py-1 rounded text-[0.75rem] font-mono text-gray-600 dark:text-gray-400 border border-blue-200/50 dark:border-white/5 inline-block w-fit">npm install -g 9router</code>
          <code class="bg-blue-100/50 dark:bg-black/30 px-2 py-1 rounded text-[0.75rem] font-mono text-gray-600 dark:text-gray-400 border border-blue-200/50 dark:border-white/5 inline-block w-fit">9router</code>
        </div>
      </div>
    </div>
  {/if}

  

</div>
{/if}
