<script lang="ts">
  import { page } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
  import { DropdownMenu } from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { MoreHorizontal } from "lucide-svelte";
  import { sessionsStore } from '$lib/stores/sessions';

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
</script>

<div class="flex h-screen max-h-[95%]">
  <!-- Sidebar -->
  <div class="w-[240px] bg-[#f7f7f7] p-4 flex flex-col"> <!-- 移除了 text-white -->
    <Button variant="outline" class="mb-4 w-full" href="/chat/new">
      New Chat
    </Button>
    
    <nav class="flex-1 overflow-y-auto">
      {#each $page.data.sessions || [] as session}
        <div class="flex items-center justify-between group px-2 py-2 hover:bg-gray-100 rounded {$page.params.id === session.id ? 'bg-gray-200' : ''}">
          {#if editingSessionId === session.id}
            <form 
              on:submit|preventDefault={() => handleRename(session.id)}
              class="flex-1"
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
            <a 
              href="/chat/{session.id}" 
              class="flex-1 truncate text-gray-700 {$page.params.id === session.id ? 'font-medium' : ''}"
            >
              {session.title}
            </a>
            
            <DropdownMenu>
              <div slot="trigger">
                <button
                  type="button"
                  class="p-1 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-500"
                >
                  <MoreHorizontal class="h-4 w-4" />
                </button>
              </div>
              <div slot="content">
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-sm"
                  on:click={() => {
                    editingSessionId = session.id;
                    newTitle = session.title;
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-100 rounded-sm"
                  on:click={() => handleDelete(session.id)}
                >
                  Delete
                </button>
              </div>
            </DropdownMenu>
          {/if}
        </div>
      {/each}
    </nav>

    <div class="mt-auto">
      <Button variant="ghost" class="w-full" href="/settings">
        Settings
      </Button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col">
    <slot />
  </div>
</div>
