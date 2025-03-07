<script lang="ts">
  import { Button } from "./ui/button";
  import { marked } from "marked";
  import { createEventDispatcher } from "svelte";

  export let role: "user" | "assistant";
  export let content: string;
  export let timestamp: Date;

  const dispatch = createEventDispatcher();
  let copied = false;

  function copyToClipboard() {
    navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }

  $: formattedTime = new Date(timestamp).toLocaleTimeString();
</script>

<div class="flex gap-4 {role === 'assistant' ? 'bg-gray-50' : ''} p-4 rounded group">
  <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
    {role === 'assistant' ? '🤖' : '👤'}
  </div>
  
  <div class="flex-1 min-w-0">
    <div class="flex items-start justify-between gap-2 md:gap-4">
      <div class="prose w-full md:w-auto max-w-none break-words">
        {@html marked(content)}
      </div>
      
      <div class="flex-shrink-0 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="sm"
          on:click={copyToClipboard}
        >
          {copied ? '✓' : '📋'}
        </Button>
      </div>
    </div>
    
    <div class="mt-2 text-xs text-gray-500 flex items-center justify-between">
      <span>{formattedTime}</span>
      
      <!-- Mobile copy button -->
      <button 
        class="md:hidden text-sm text-gray-500 px-2 py-1"
        on:click={copyToClipboard}
      >
        {copied ? '✓ ' : '📋 '}
      </button>
    </div>
  </div>
</div>

<style>
  /* Style for code blocks with black background */
  :global(.prose pre) {
    background-color: #000 !important;
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
  }
  
  :global(.prose pre code) {
    color: #f8f8f2 !important;
    background-color: transparent !important;
    padding: 0;
  }
  
  /* Style for inline code */
  :global(.prose code:not(pre code)) {
    background-color: #000 !important;
    color: #f8f8f2 !important;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
