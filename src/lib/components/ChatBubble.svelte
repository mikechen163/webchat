<script lang="ts">
  import { Button } from "./ui/button";
  import { marked } from "marked";
  import { createEventDispatcher, onMount } from "svelte";
  import { ChevronDown, ChevronUp, ClipboardCopy, Check } from "lucide-svelte";

  onMount(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  });

  export let role: "user" | "assistant";
  export let content: string;
  export let timestamp: Date;
  export let modelInfo: string = "";  // 新增：模型信息
  export let tokenCount: number = 0;  // 新增：token计数

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
  $: hasReasoning = role === 'assistant' && content.includes('<think>') && content.includes('</think>');

  // Process the content to handle reasoning sections and apply markdown
  $: htmlContent = (() => {
    let processed = content;
    if (hasReasoning) {
      if (showReasoning) {
        processed = content.replace(
          /<think>([\s\S]*?)<\/think>/g,
          (match, reasoningContent) => {
            return `<div class="reasoning-section">${reasoningContent}</div>`;
          }
        );
      } else {
        processed = content.replace(/<think>[\s\S]*?<\/think>/g, '');
      }
    }
    return marked(processed);
  })();

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
        
        {@html htmlContent}
      </div>
      
    </div>
    
    <div class="mt-2 text-xs text-gray-500 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span>{formattedTime}</span>
        {#if role === 'assistant' && modelInfo}
          <span class="text-gray-400">|</span>
          <span class="text-gray-600">{modelInfo}</span>
          {#if tokenCount > 0}
            <span class="text-gray-400">|</span>
            <span class="text-gray-600">{tokenCount} tokens</span>
          {/if}
        {/if}
      </div>
      
      <button 
        class="text-gray-500 hover:text-gray-700 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        on:click={copyToClipboard}
        aria-label="Copy message"
      >
        {#if copied}
          <Check class="h-4 w-4 text-green-500" />
        {:else}
          <ClipboardCopy class="h-4 w-4" />
        {/if}
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
