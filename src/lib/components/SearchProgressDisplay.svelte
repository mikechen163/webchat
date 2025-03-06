<script lang="ts">
  import { Loader2, ChevronDown, ChevronUp, X } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";

  export let searchProgress: {
    status: "idle" | "analyzing" | "searching" | "fetching" | "complete" | "error";
    query: string;
    searchKeywords: string;
    searchResults: any[] | null;
    analysis: any | null;
    error: string | null;
  };
  
  export let onClose: () => void;

  // Collapsible sections state
  let showKeywords = true;
  let showResults = true;
  let showAnalysis = true;

  // Format timestamp for display
  const formatTime = () => {
    return new Date().toLocaleTimeString();
  };

  // Helper function to truncate long text
  function truncate(text: string, length: number = 100) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
</script>

<div class="bg-gray-50 border rounded-lg p-3 mb-4 relative">
  <div class="absolute top-2 right-2">
    <Button variant="ghost" size="icon" on:click={onClose} class="h-8 w-8">
      <X class="h-4 w-4" />
    </Button>
  </div>

  <h3 class="font-medium text-sm text-gray-700 mb-2">Search Progress</h3>
  
  <!-- Status indicator -->
  <div class="flex items-center gap-2 mb-3 text-sm">
    {#if searchProgress.status === 'idle'}
      <div class="text-gray-500">Waiting to start search...</div>
    {:else if searchProgress.status === 'analyzing'}
      <Loader2 class="h-4 w-4 text-blue-500 animate-spin" />
      <div class="text-blue-600">Analyzing your query...</div>
    {:else if searchProgress.status === 'searching'}
      <Loader2 class="h-4 w-4 text-blue-500 animate-spin" />
      <div class="text-blue-600">Searching the web...</div>
    {:else if searchProgress.status === 'fetching'}
      <Loader2 class="h-4 w-4 text-blue-500 animate-spin" />
      <div class="text-blue-600">Fetching page content...</div>
    {:else if searchProgress.status === 'complete'}
      <div class="text-green-600">Search completed</div>
    {:else if searchProgress.status === 'error'}
      <div class="text-red-600">Error: {searchProgress.error}</div>
    {/if}
    <div class="text-xs text-gray-500">{formatTime()}</div>
  </div>
  
  <!-- Original Query -->
  <div class="mb-2 text-sm">
    <span class="font-semibold">Your query:</span> {searchProgress.query}
  </div>
  
  <!-- Search Keywords -->
  {#if searchProgress.searchKeywords}
    <div class="mb-3 border-t pt-2">
      <button 
        class="flex items-center text-sm font-semibold text-gray-700 w-full justify-between"
        on:click={() => showKeywords = !showKeywords}
      >
        <span>Search Keywords</span>
        {#if showKeywords}
          <ChevronUp class="h-4 w-4" />
        {:else}
          <ChevronDown class="h-4 w-4" />
        {/if}
      </button>
      
      {#if showKeywords}
        <div class="mt-1 p-2 bg-white rounded border text-sm">
          {searchProgress.searchKeywords}
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Search Results -->
  {#if searchProgress.searchResults && searchProgress.searchResults.length > 0}
    <div class="mb-3 border-t pt-2">
      <button 
        class="flex items-center text-sm font-semibold text-gray-700 w-full justify-between"
        on:click={() => showResults = !showResults}
      >
        <span>Search Results ({searchProgress.searchResults.length})</span>
        {#if showResults}
          <ChevronUp class="h-4 w-4" />
        {:else}
          <ChevronDown class="h-4 w-4" />
        {/if}
      </button>
      
      {#if showResults}
        <div class="mt-1 max-h-40 overflow-y-auto">
          {#each searchProgress.searchResults as result, i}
            <div class="p-2 bg-white rounded border mb-1 text-sm">
              <div class="font-medium">{i+1}. {result.title}</div>
              <div class="text-xs text-blue-600">{result.url}</div>
              <div class="text-xs text-gray-600">{truncate(result.description, 150)}</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Analysis -->
  {#if searchProgress.analysis}
    <div class="border-t pt-2">
      <button 
        class="flex items-center text-sm font-semibold text-gray-700 w-full justify-between"
        on:click={() => showAnalysis = !showAnalysis}
      >
        <span>Results Analysis</span>
        {#if showAnalysis}
          <ChevronUp class="h-4 w-4" />
        {:else}
          <ChevronDown class="h-4 w-4" />
        {/if}
      </button>
      
      {#if showAnalysis}
        <div class="mt-1 p-2 bg-white rounded border text-xs">
          <div><span class="font-medium">Completeness:</span> {searchProgress.analysis.completeness}%</div>
          <div><span class="font-medium">Relevance:</span> {searchProgress.analysis.queryMatch}%</div>
          {#if searchProgress.analysis.rationale}
            <div class="mt-1"><span class="font-medium">Analysis:</span> {searchProgress.analysis.rationale}</div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
