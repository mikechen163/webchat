<script lang="ts">
  import { Button } from "./ui/button";
  import { marked } from "marked";
  import { createEventDispatcher } from "svelte";
  import { ChevronDown, ChevronUp } from "lucide-svelte";

  export let role: "user" | "assistant";
  export let content: string;
  export let timestamp: Date;

  const dispatch = createEventDispatcher();
  let copied = false;
  let showReasoning = true;

  function copyToClipboard() {
    navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }

  function toggleReasoning() {
    showReasoning = !showReasoning;
  }
  
  // Check if the content contains reasoning sections
  $: hasReasoning = content.includes('<think>') && content.includes('</think>');

  // Process the content to handle reasoning sections
  $: processedContent = hasReasoning 
    ? content.replace(
        /<think>([\s\S]*?)<\/think>/g, 
        (match, reasoningContent) => {
          if (showReasoning) {
            return `<div class="reasoning-section">${reasoningContent}</div>`;
          } else {
            return '';
          }
        }
      )
    : content;

  // Remove reasoning sections for display when collapsed
  $: displayContent = hasReasoning && !showReasoning
    ? content.replace(/<think>[\s\S]*?<\/think>/g, '')
    : content;

  $: formattedTime = new Date(timestamp).toLocaleTimeString();
</script>

<div class="flex gap-4 {role === 'assistant' ? 'bg-gray-50' : ''} p-4 rounded group">
  <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
    {role === 'assistant' ? '🤖' : '👤'}
  </div>
  
  <div class="flex-1 min-w-0">
    <div class="flex items-start justify-between gap-2 md:gap-4">
      <div class="prose w-full md:w-auto max-w-none break-words">
        {#if hasReasoning}
          <!-- Show reasoning toggle if available -->
          <div class="reasoning-toggle mb-1">
            <button 
              class="text-xs flex items-center gap-1 px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
              on:click={toggleReasoning}
            >
              {#if showReasoning}
                <ChevronUp class="h-3 w-3" />
                <span>Hide reasoning</span>
              {:else}
                <ChevronDown class="h-3 w-3" />
                <span>Show reasoning</span>
              {/if}
            </button>
          </div>
        {/if}
        
        {@html marked(showReasoning ? processedContent : displayContent)}
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
  
  /* Style for reasoning sections */
  :global(.reasoning-section) {
    background-color: #f3f0ff;
    border-left: 3px solid #9f7aea;
    padding: 0.5rem 1rem;
    margin: 0.5rem 0;
    font-size: 0.95em;
    border-radius: 0 0.3rem 0.3rem 0;
    position: relative;
    overflow-wrap: break-word;
  }
  
  /* Add a subtle marker for reasoning sections */
  :global(.reasoning-section::before) {
    content: "Reasoning";
    display: block;
    font-size: 0.75rem;
    color: #7e3af2;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }
</style>
