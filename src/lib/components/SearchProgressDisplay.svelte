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
  export let isSidebar: boolean = false;

  // Collapsible sections state
  let showKeywords = true;
  let showResults = true;
  // Removing showAnalysis as we won't be displaying that section

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

<div class="{isSidebar ? 'h-full flex flex-col' : 'bg-gray-50 border rounded-lg mb-4'} relative">
  <div class="sticky top-0 z-10 flex items-center justify-between p-3 bg-gray-100 border-b shrink-0">
    <h3 class="font-medium text-sm text-gray-700">Search Progress</h3>
    <Button variant="ghost" size="icon" on:click={onClose} class="h-8 w-8">
      <X class="h-4 w-4" />
    </Button>
  </div>

  <div class="p-3 {isSidebar ? 'flex flex-col flex-1 overflow-hidden' : ''}">
    <!-- Status indicator -->
    <div class="flex items-center gap-2 mb-3 text-sm shrink-0">
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
    <div class="mb-2 text-sm shrink-0">
      <span class="font-semibold">Your query:</span> {searchProgress.query}
    </div>
    
    <!-- Search Keywords -->
    {#if searchProgress.searchKeywords}
      <div class="mb-3 border-t pt-2 shrink-0">
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
    
    <!-- Search Results - Modified to take up full available height -->
    {#if searchProgress.searchResults && searchProgress.searchResults.length > 0}
      <div class="{isSidebar ? 'flex-1 flex flex-col min-h-0' : ''} border-t pt-2">
        <button 
          class="flex items-center text-sm font-semibold text-gray-700 w-full justify-between shrink-0"
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
          <div class="{isSidebar ? 'flex-1 overflow-y-auto' : 'max-h-60 overflow-y-auto'} mt-1">
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
    
    <!-- Results Analysis section removed as requested -->
  </div>
</div>
