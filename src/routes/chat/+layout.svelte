<script lang="ts">
  import { page, navigating } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
  import { DropdownMenu } from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { MoreHorizontal } from "lucide-svelte";
  import { sessionsStore } from '$lib/stores/sessions';
  import { goto, invalidate } from "$app/navigation";
  import ConfirmDialog from "$lib/components/ui/confirm-dialog.svelte";
  import { onMount } from 'svelte';

  let editingSessionId: string | null = null;
  let newTitle = "";

  let contextMenuX = 0;
  let contextMenuY = 0;
  let showContextMenu = false;
  let selectedSessionId: string | null = null;
  let showConfirmDialog = false;
  let confirmDialogPosition = { x: 0, y: 0 };

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
    const response = await fetch(`/api/chat/${id}`, {
      method: "DELETE"
    });

    if (response.ok) {
      $sessionsStore.invalidate();
      if ($page.params.id === id) {
        window.location.href = "/chat";
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

  async function handleSessionClick(event: MouseEvent, sessionId: string) {
    event.preventDefault();
    
    try {
      // 首先导航到新路由
      await goto(`/chat/${sessionId}`);
      // 然后强制重新获取数据
      await invalidate('app:session');
      // 如果是同一会话，强制刷新页面
      if (sessionId === $page.params.id) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  function handleClickDelete() {
    if (!selectedSessionId) return;
    showConfirmDialog = true;
    // 将确认对话框定位在右键菜单位置附近
    confirmDialogPosition = {
      x: contextMenuX,
      y: contextMenuY
    };
    showContextMenu = false; // 隐藏右键菜单
  }

  async function confirmDelete() {
    if (!selectedSessionId) return;
    const sessionToDelete = selectedSessionId; // 保存当前选中的会话ID
    showConfirmDialog = false; // 先隐藏确认对话框
    await handleDelete(sessionToDelete); // 执行删除操作
    selectedSessionId = null; // 重置选中的会话ID
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="h-screen flex">
  <!-- Sidebar -->
  <div class="w-[240px] bg-[#f7f7f7] flex flex-col">
    <div class="p-4">
      <Button variant="outline" class="w-full" href="/chat/new">
        New Chat
      </Button>
    </div>
    
    <nav class="flex-1 overflow-y-auto px-4 min-h-0">
      {#each $page.data.sessions || [] as session}
        <a 
          href="/chat/{session.id}" 
          class="flex items-center px-2 py-2 hover:bg-gray-100 rounded transition-colors duration-200 
            {$page.params.id === session.id ? 'bg-gray-200' : ''}
            {$navigating?.to?.pathname === `/chat/${session.id}` ? 'animate-pulse' : ''}"
          on:click|preventDefault={(e) => handleSessionClick(e, session.id)}
          on:contextmenu|preventDefault={(e) => handleContextMenu(e, session.id)}
        >
          <span class="truncate text-gray-700 {$page.params.id === session.id ? 'font-medium' : ''}">
            {session.title}
          </span>
        </a>
      {/each}
    </nav>

    <div class="p-4">
      <Button variant="ghost" class="w-full" href="/settings">
        Settings
      </Button>
    </div>
  </div>

  <!-- Main Content with loading indicator -->
  <div class="flex-1 flex flex-col relative h-full">
    <!-- 内容部分 (消息和输入区域) 由子页面填充 -->
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
      on:click={handleClickDelete}
    >
      Delete Chat
    </button>
  </div>
{/if}

{#if showConfirmDialog}
  <ConfirmDialog
    x={confirmDialogPosition.x}
    y={confirmDialogPosition.y}
    message="Are you sure you want to delete this chat?"
    onConfirm={confirmDelete}
    onCancel={() => {
      showConfirmDialog = false;
      hideContextMenu();
    }}
  />
{/if}
