<script lang="ts">
  import { onMount } from 'svelte';
  import { Clock, Plus, Trash2, TrendingUp, RefreshCw, Bell, Scale, Fuel, Zap, Send, CheckCircle2, AlertCircle, Loader2 } from '@lucide/svelte';
  import { apiFetch } from '$lib/utils/api';

  interface CronJob {
    id: string;
    expression: string;
    prompt: string;
    createdAt: number;
  }

  interface Template {
    icon: any;
    label: string;
    description: string;
    expression: string;
    prompt: string;
    color: string;
    bgClass: string;
    borderClass: string;
    textClass: string;
  }

  const TEMPLATES: Template[] = [
    {
      icon: TrendingUp,
      label: 'Daily Market Report',
      description: 'Analyze top coins and summarize market sentiment every morning.',
      expression: '0 8 * * *',
      prompt: 'Generate a daily market report: analyze BTC, ETH, and top trending tokens. Summarize price movements, key news, and your recommendation for the day.',
      color: '#3b82f6',
      bgClass: 'bg-blue-500/10 dark:bg-blue-500/15',
      borderClass: 'border-blue-500/30 hover:border-blue-500',
      textClass: 'text-blue-500 dark:text-blue-400'
    },
    {
      icon: RefreshCw,
      label: 'DCA Schedule',
      description: 'Dollar-cost average into ETH every Monday.',
      expression: '0 9 * * 1',
      prompt: 'Execute a DCA buy: swap $50 worth of USDC to ETH on the default chain using the best available route.',
      color: '#10b981',
      bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      borderClass: 'border-emerald-500/30 hover:border-emerald-500',
      textClass: 'text-emerald-500 dark:text-emerald-400'
    },
    {
      icon: Bell,
      label: 'Price Alert Check',
      description: 'Check BTC price every hour and alert if major move detected.',
      expression: '0 * * * *',
      prompt: 'Check the current BTC price. If it has moved more than 3% in the last hour, send a detailed alert with analysis.',
      color: '#f59e0b',
      bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
      borderClass: 'border-amber-500/30 hover:border-amber-500',
      textClass: 'text-amber-500 dark:text-amber-400'
    },
    {
      icon: Scale,
      label: 'Portfolio Rebalancer',
      description: 'Review and suggest portfolio rebalancing every Sunday.',
      expression: '0 10 * * 0',
      prompt: 'Analyze my current portfolio balance across all chains. Compare against a 60/30/10 ETH/BTC/stables target allocation. Suggest and execute rebalancing trades if deviation exceeds 5%.',
      color: '#8b5cf6',
      bgClass: 'bg-purple-500/10 dark:bg-purple-500/15',
      borderClass: 'border-purple-500/30 hover:border-purple-500',
      textClass: 'text-purple-500 dark:text-purple-400'
    },
    {
      icon: Fuel,
      label: 'Gas Watcher',
      description: 'Check gas every 30 mins and execute pending tasks when low.',
      expression: '*/30 * * * *',
      prompt: 'Check current Ethereum mainnet gas price. If base fee is below 15 gwei, report it as a good window for executing pending transactions.',
      color: '#ef4444',
      bgClass: 'bg-red-500/10 dark:bg-red-500/15',
      borderClass: 'border-red-500/30 hover:border-red-500',
      textClass: 'text-red-500 dark:text-red-400'
    },
    {
      icon: Zap,
      label: 'Weekly Summary',
      description: 'Full portfolio + market summary every Friday evening.',
      expression: '0 18 * * 5',
      prompt: 'Generate a comprehensive weekly summary: portfolio performance this week, major market events, gains/losses, and strategic recommendations for next week.',
      color: '#06b6d4',
      bgClass: 'bg-cyan-500/10 dark:bg-cyan-500/15',
      borderClass: 'border-cyan-500/30 hover:border-cyan-500',
      textClass: 'text-cyan-500 dark:text-cyan-400'
    }
  ];

  function parseCronHuman(expr: string): string {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return expr;
    const [min, hour, dom, month, dow] = parts;

    if (expr === '* * * * *') return 'Every minute';
    if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} minutes`;
    if (hour.startsWith('*/') && min === '0') return `Every ${hour.slice(2)} hours`;

    const days: Record<string, string> = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };
    const time = hour !== '*' && min !== '*' ? `at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}` : '';

    if (dom === '*' && month === '*') {
      if (dow !== '*') return `Every ${days[dow] || `day ${dow}`} ${time}`.trim();
      return `Daily ${time}`.trim();
    }
    if (dom !== '*' && dow === '*') return `Monthly on day ${dom} ${time}`.trim();
    return expr;
  }

  let jobs = $state<CronJob[]>([]);
  let loading = $state(true);
  let nlInput = $state('');
  let cronExpr = $state('0 8 * * *');
  let promptInput = $state('');
  let mode = $state<'natural' | 'manual'>('natural');
  let isCreating = $state(false);
  let createStatus = $state<{ type: 'success' | 'error'; msg: string } | null>(null);
  let deletingId = $state<string | null>(null);
  let selectedTemplate = $state<string | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await apiFetch('/api/cron');
      if (res.ok) {
        const data = await res.json();
        jobs = data.jobs || [];
      }
    } catch (e) {
      console.error('Failed to fetch cron jobs', e);
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  });

  const handleCreateFromNL = async () => {
    if (!nlInput.trim()) return;
    isCreating = true;
    createStatus = null;

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Schedule a cron job for me: ${nlInput}. Use the schedule_task tool to create this as a recurring job.`,
          session_id: 'cron-setup'
        })
      });

      if (res.ok) {
        createStatus = { type: 'success', msg: 'Instruction sent to agent. The agent will configure the schedule.' };
        nlInput = '';
        setTimeout(fetchJobs, 3000);
      } else {
        createStatus = { type: 'error', msg: 'Failed to send instruction to agent.' };
      }
    } catch (e) {
      createStatus = { type: 'error', msg: 'Connection error.' };
    } finally {
      isCreating = false;
    }
  };

  const handleCreateManual = async () => {
    if (!cronExpr.trim() || !promptInput.trim()) return;
    isCreating = true;
    createStatus = null;

    try {
      const res = await apiFetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: cronExpr.trim(), prompt: promptInput.trim() })
      });

      if (res.ok) {
        createStatus = { type: 'success', msg: 'Cron job created successfully!' };
        cronExpr = '0 8 * * *';
        promptInput = '';
        fetchJobs();
      } else {
        const err = await res.json();
        createStatus = { type: 'error', msg: err.error || 'Failed to create job.' };
      }
    } catch (e) {
      createStatus = { type: 'error', msg: 'Connection error.' };
    } finally {
      isCreating = false;
    }
  };

  const handleDelete = async (id: string) => {
    deletingId = id;
    try {
      const res = await apiFetch(`/api/cron/${id}`, { method: 'DELETE' });
      if (res.ok) {
        jobs = jobs.filter(j => j.id !== id);
      }
    } catch (e) {
      console.error('Failed to delete job', e);
    } finally {
      deletingId = null;
    }
  };

  const applyTemplate = (t: Template) => {
    selectedTemplate = t.label;
    mode = 'manual';
    cronExpr = t.expression;
    promptInput = t.prompt;
    setTimeout(() => {
      document.getElementById('cron-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
</script>

<div class="h-full w-full overflow-y-auto bg-gray-50 dark:bg-[#1c1c1e] text-gray-900 dark:text-[#ffffff] p-8">
  <div class="max-w-[1100px] mx-auto space-y-8 pb-12">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <div class="p-3 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 rounded-2xl">
        <Clock size={28} class="text-blue-500 dark:text-blue-400" />
      </div>
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">CRON Automations</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {jobs.length} active job{jobs.length !== 1 ? 's' : ''} — Agent executes tasks on your schedule
        </p>
      </div>
    </div>

    <!-- Quick Templates -->
    <div>
      <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
        QUICK TEMPLATES
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each TEMPLATES as t}
          {@const IconComp = t.icon}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => applyTemplate(t)}
            class="p-4 rounded-xl border transition-all cursor-pointer {selectedTemplate === t.label ? t.bgClass + ' ' + t.borderClass : 'bg-white dark:bg-[#222226] border-gray-200/80 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}"
          >
            <div class="flex items-center gap-2.5 mb-2">
              <span class={t.textClass}><IconComp size={18} /></span>
              <span class="font-semibold text-sm text-gray-900 dark:text-gray-100">{t.label}</span>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed min-h-[36px]">
              {t.description}
            </p>
            <div class="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium border {t.textClass} border-current/20 bg-current/5">
              {t.expression} — {parseCronHuman(t.expression)}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Create New Job Form -->
    <div id="cron-form" class="bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl p-6 shadow-sm">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <Plus size={18} class="text-blue-500" />
          <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">Create New Job</h3>
        </div>

        <!-- Mode Toggle -->
        <div class="flex bg-gray-100 dark:bg-[#1c1c1e] border border-gray-200/80 dark:border-white/10 rounded-lg p-0.5">
          <button
            onclick={() => mode = 'natural'}
            class="px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all {mode === 'natural' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
          >
            Natural Language
          </button>
          <button
            onclick={() => mode = 'manual'}
            class="px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all {mode === 'manual' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
          >
            Manual
          </button>
        </div>
      </div>

      {#if mode === 'natural'}
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Describe what you want the agent to do and when. The agent will parse and schedule it automatically.
          </p>
          <div class="flex gap-2.5">
            <input
              type="text"
              bind:value={nlInput}
              onkeydown={e => e.key === 'Enter' && handleCreateFromNL()}
              placeholder='e.g. "Check my portfolio every Monday morning and send a summary"'
              class="flex-1 bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200/80 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              onclick={handleCreateFromNL}
              disabled={isCreating || !nlInput.trim()}
              class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
            >
              {#if isCreating}
                <Loader2 size={15} class="animate-spin" />
              {:else}
                <Send size={15} />
              {/if}
              Schedule
            </button>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-1">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                CRON EXPRESSION
              </label>
              <input
                type="text"
                bind:value={cronExpr}
                placeholder="0 8 * * *"
                class="w-full bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm font-mono text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                → {parseCronHuman(cronExpr)}
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                AGENT INSTRUCTION
              </label>
              <textarea
                bind:value={promptInput}
                placeholder="What should the agent do when this job runs?"
                rows="3"
                class="w-full bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200/80 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 resize-none outline-none focus:ring-2 focus:ring-blue-500/40 leading-relaxed"
              ></textarea>
            </div>
          </div>
          <div class="flex justify-end">
            <button
              onclick={handleCreateManual}
              disabled={isCreating || !cronExpr.trim() || !promptInput.trim()}
              class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
            >
              {#if isCreating}
                <Loader2 size={15} class="animate-spin" />
              {:else}
                <Plus size={15} />
              {/if}
              Create Job
            </button>
          </div>
        </div>
      {/if}

      {#if createStatus}
        <div class="flex items-center gap-2.5 mt-4 px-4 py-3 rounded-xl border {createStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}">
          {#if createStatus.type === 'success'}
            <CheckCircle2 size={16} class="shrink-0" />
          {:else}
            <AlertCircle size={16} class="shrink-0" />
          {/if}
          <span class="text-xs font-medium">{createStatus.msg}</span>
        </div>
      {/if}
    </div>

    <!-- Active Jobs -->
    <div>
      <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
        ACTIVE JOBS ({jobs.length})
      </h3>

      {#if loading}
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 p-6">
          <Loader2 size={18} class="animate-spin" /> Loading jobs...
        </div>
      {:else if jobs.length === 0}
        <div class="bg-white dark:bg-[#222226] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-10 text-center">
          <Clock size={40} class="mx-auto mb-3 text-gray-400 dark:text-gray-500 opacity-40" />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No scheduled jobs yet.</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 opacity-80">Pick a template above or create a custom job.</p>
        </div>
      {:else}
        <div class="space-y-2.5">
          {#each jobs as job}
            <div class="flex items-center gap-4 bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 hover:border-blue-500/50 rounded-xl px-5 py-4 transition-all shadow-sm">
              <!-- Status dot -->
              <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] shrink-0"></div>

              <!-- Cron expression -->
              <code class="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0 min-w-[90px]">
                {job.expression}
              </code>

              <!-- Human readable -->
              <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0 min-w-[130px]">
                {parseCronHuman(job.expression)}
              </span>

              <!-- Prompt -->
              <span class="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
                {job.prompt}
              </span>

              <!-- Created at -->
              <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {new Date(job.createdAt).toLocaleDateString()}
              </span>

              <!-- Delete button -->
              <button
                onclick={() => handleDelete(job.id)}
                disabled={deletingId === job.id}
                class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                title="Delete Job"
              >
                {#if deletingId === job.id}
                  <Loader2 size={15} class="animate-spin" />
                {:else}
                  <Trash2 size={15} />
                {/if}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Cron Expression Cheatsheet -->
    <div class="bg-white dark:bg-[#222226] border border-gray-200/80 dark:border-white/10 rounded-2xl p-6 shadow-sm">
      <h4 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
        CRON EXPRESSION CHEATSHEET
      </h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {#each [
          ['* * * * *', 'Every minute'],
          ['0 * * * *', 'Every hour'],
          ['0 8 * * *', 'Daily at 8:00 AM'],
          ['0 8 * * 1', 'Every Monday 8 AM'],
          ['0 0 * * 0', 'Every Sunday midnight'],
          ['*/30 * * * *', 'Every 30 minutes']
        ] as [expr, desc]}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => { mode = 'manual'; cronExpr = expr; document.getElementById('cron-form')?.scrollIntoView({ behavior: 'smooth' }); }}
            class="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <code class="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0">
              {expr}
            </code>
            <span class="text-xs text-gray-500 dark:text-gray-400">→ {desc}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
