<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
  import { DropdownMenu } from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { MoreHorizontal } from "lucide-svelte";
  import { sessionsStore } from '$lib/stores/sessions';

  export let data;
  let editingSessionId: string | null = null;
  let newTitle = "";

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    const response = await fetch(`/api/chat/${id}`, {
      method: "DELETE"
    });

    if (response.ok) {
      $sessionsStore.invalidate();
      if ($page.params.id === id) {
        window.location.href = "/";
      }
    }
  }

  async function handleRename(id: string) {
    if (!newTitle.trim()) return;
    
    const response = await fetch(`/api/chat/${id}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle })
    });
    
    if (response.ok) {
      $sessionsStore.invalidate();
      editingSessionId = null;
      newTitle = "";
    }
  }

  onMount(() => {
    if (browser) {
      goto("/auth/login", { replaceState: true });
    }
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
</div>

<div class="overflow-y-auto flex-1">
  {#each data.sessions as session (session.id)}
    <div class="flex items-center group px-2 py-2 hover:bg-muted/50 {$page.params.id === session.id ? 'bg-muted' : ''}">
      <a 
        href="/chat/{session.id}" 
        class="flex-1 truncate {$page.params.id === session.id ? 'font-medium' : ''}"
      >
        {#if editingSessionId === session.id}
          <form 
            on:submit|preventDefault={() => handleRename(session.id)}
            class="flex items-center pr-2"
          >
            <Input
              bind:value={newTitle}
              class="h-7"
              placeholder="Enter new title..."
              autofocus
              on:blur={() => editingSessionId = null}
            />
          </form>
        {:else}
          {session.title}
        {/if}
      </a>
      
      <DropdownMenu>
        <div slot="trigger">
          <Button 
            variant="ghost" 
            size="icon" 
            class="h-8 w-8 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal class="h-4 w-4" />
          </Button>
        </div>
        <div slot="content">
          <button
            class="w-full text-left px-2 py-1.5 text-sm hover:bg-muted"
            on:click={() => {
              editingSessionId = session.id;
              newTitle = session.title;
            }}
          >
            Rename
          </button>
          <button
            class="w-full text-left px-2 py-1.5 text-sm text-red-500 hover:bg-muted"
            on:click={() => handleDelete(session.id)}
          >
            Delete
          </button>
        </div>
      </DropdownMenu>
    </div>
  {/each}
</div>
