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

  let contextMenuX = 0;
  let contextMenuY = 0;
  let showContextMenu = false;
  let selectedSessionId: string | null = null;

  function handleContextMenu(event: MouseEvent, sessionId: string) {
    event.preventDefault();
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    selectedSessionId = sessionId;
    showContextMenu = true;
  }

  function hideContextMenu() {
    showContextMenu = false;
    selectedSessionId = null;
  }

  // 点击页面任意位置关闭菜单
  function handleClickOutside(event: MouseEvent) {
    if (showContextMenu) {
      hideContextMenu();
    }
  }

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

<svelte:window on:click={handleClickOutside} />

<div class="flex h-screen max-h-[95%]">
  <!-- Sidebar -->
  <div class="w-[240px] bg-[#f7f7f7] p-4 flex flex-col"> <!-- 移除了 text-white -->
    <Button variant="outline" class="mb-4 w-full" href="/chat/new">
      New Chat
    </Button>
    
    <nav class="flex-1 overflow-y-auto">
      {#each $page.data.sessions || [] as session}
        <a 
          href="/chat/{session.id}" 
          class="flex items-center px-2 py-2 hover:bg-gray-100 rounded {$page.params.id === session.id ? 'bg-gray-200' : ''}"
          on:contextmenu|preventDefault={(e) => handleContextMenu(e, session.id)}
        >
          <span class="truncate text-gray-700 {$page.params.id === session.id ? 'font-medium' : ''}">
            {session.title}
          </span>
        </a>
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

{#if showContextMenu}
  <div 
    class="fixed z-50 bg-white rounded-md shadow-lg border py-1 min-w-[160px]"
    style="left: {contextMenuX}px; top: {contextMenuY}px"
  >
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-gray-100"
      on:click={() => {
        if (selectedSessionId && confirm("Are you sure you want to delete this chat?")) {
          handleDelete(selectedSessionId);
        }
        hideContextMenu();
      }}
    >
      Delete Chat
    </button>
  </div>
{/if}
