<script lang="ts">
  import "../app.css";
  import { toast } from "$lib/components/ui/toast";
  import { sessionsStore } from '$lib/stores/sessions';
  import { invalidate } from '$app/navigation';
  
  // 提供invalidate方法给store
  $sessionsStore.invalidate = () => {
    invalidate('chats:list');
  };
</script>



<div class="h-[100vh] overflow-hidden bg-background font-sans antialiased">
  <slot />
</div>

{#if $toast}
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
    {#each $toast as t}
      <div class="bg-white shadow-lg rounded-lg p-4 {t.type === 'error' ? 'bg-red-50' : ''} animate-in fade-in">
        {t.message}
      </div>
    {/each}
  </div>
{/if}
