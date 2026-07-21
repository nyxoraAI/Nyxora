<script lang="ts">
  import { LineChart, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-svelte';
</script>

<div class="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900 pb-10">
  <div class="mb-8">
    <h1 class="flex items-center gap-3 text-2xl font-bold mb-2">
      <LineChart class="text-blue-500" size={28} /> Market Dashboard
    </h1>
    <p class="text-gray-500">Real-time crypto prices, trending tokens, and market overview.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
    <div class="bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wider mb-2">Today's PNL</div>
      <div class="text-2xl font-bold text-green-500 mb-1">+$1,240.50</div>
      <div class="text-xs text-gray-500">Total Balance: $24,500.00</div>
    </div>
    
    <div class="bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wider mb-2">Global Market Cap</div>
      <div class="text-2xl font-bold mb-1">$2.4T</div>
      <div class="text-xs text-green-500 flex items-center gap-1">
        <ArrowUpRight size={14} /> +1.2% (24h)
      </div>
    </div>
    
    <div class="bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wider mb-2">24h Volume</div>
      <div class="text-2xl font-bold mb-1">$84B</div>
      <div class="text-xs text-red-500 flex items-center gap-1">
        <ArrowDownRight size={14} /> -4.5% (24h)
      </div>
    </div>
    
    <div class="bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wider mb-2">BTC Dominance</div>
      <div class="text-2xl font-bold mb-1">52.4%</div>
      <div class="text-xs text-green-500 flex items-center gap-1">
        <ArrowUpRight size={14} /> +0.2% (24h)
      </div>
    </div>
    
    <div class="bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wider mb-2">Agent Status</div>
      <div class="flex items-center gap-2 mb-1">
        <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
        <span class="text-sm font-semibold">Scanning Market</span>
      </div>
      <div class="text-xs text-gray-500">80 Active Skills</div>
    </div>
    
    <div class="bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-xl p-5 shadow-sm">
      <div class="text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wider mb-2">API Usage</div>
      <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
        <div class="h-full bg-blue-500 w-[45%]"></div>
      </div>
      <div class="text-xs text-gray-500">45% of Daily Limit</div>
    </div>
  </div>

  <div class="bg-white dark:bg-[#3b4252] border border-gray-200 dark:border-[#4c566a] rounded-xl p-6 shadow-sm">
    <h3 class="flex items-center gap-2 text-lg font-semibold mb-6">
      <Activity size={18} class="text-blue-500" /> Trending Tokens
    </h3>
    
    <div class="flex flex-col items-center justify-center py-12 text-gray-500">
      <LineChart size={48} class="mb-4 opacity-50 text-blue-500" />
      <div class="font-medium text-gray-800 dark:text-[#e5e9f0]">Market data will be populated here.</div>
      <div class="text-sm mt-2">Fetching real-time data from aggregators...</div>
    </div>
  </div>
</div>
