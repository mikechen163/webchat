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
    <div class="flex items-start justify-between gap-4">
      <div class="prose max-w-none break-words">
        {@html marked(content)}
      </div>
      
      <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="sm"
          on:click={copyToClipboard}
        >
          {copied ? '✓' : '📋'}
        </Button>
      </div>
    </div>
    
    <div class="mt-2 text-xs text-gray-500">
      {formattedTime}
    </div>
  </div>
</div>
