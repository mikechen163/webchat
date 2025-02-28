<script lang="ts">
  import { page, navigating } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
  import { DropdownMenu } from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { MoreHorizontal, Menu, Settings, LogOut } from "lucide-svelte";
  import { sessionsStore } from '$lib/stores/sessions';
  import { goto, invalidate } from "$app/navigation";
  import ConfirmDialog from "$lib/components/ui/confirm-dialog.svelte";
  import { onMount } from 'svelte';
  import { sidebarOpen } from '$lib/stores/sidebar';

  let editingSessionId: string | null = null;
  let newTitle = "";

  let contextMenuX = 0;
  let contextMenuY = 0;
  let showContextMenu = false;
  let selectedSessionId: string | null = null;
  let showConfirmDialog = false;
  let confirmDialogPosition = { x: 0, y: 0 };

  // 添加响应式处理
  let innerWidth: number;

  let dropdownOpen = false;

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
  function handleGlobalClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown')) {
      dropdownOpen = false;
    }
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
      // 在移动端自动隐藏侧边栏
      if (innerWidth < 768) {
        $sidebarOpen = false;
      }
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

  // 切换侧边栏
  function toggleSidebar() {
    $sidebarOpen = !$sidebarOpen;
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
  }

  async function handleLogout() {
    const response = await fetch('/auth/logout', { method: 'POST' });
    if (response.ok) {
      window.location.href = '/auth/login';
    }
  }

  function getInitial(email: string) {
    return email.charAt(0).toUpperCase();
  }

  // Add export function
  async function handleExport(sessionId: string) {
    try {
      const response = await fetch(`/api/chat/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch chat data');
      
      const data = await response.json();
      const chatData = {
        title: data.session.title,
        messages: data.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt
        }))
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      // 添加安全的文件名处理
      const safeTitle = (data.session.title || 'Untitled Chat')
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `chat-${safeTitle}-${timestamp}.json`;
      
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(url);
      hideContextMenu();
      
      toast({
        title: "Success",
        description: `Chat exported as ${filename}`,
        type: "success"
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export chat",
        type: "error"
      });
    }
  }
</script>

<svelte:window 
  bind:innerWidth
  on:click={handleGlobalClick} 
/>

<div class="h-screen flex">
  <!-- 移动端顶部菜单按钮 -->
  {#if innerWidth < 768}
    <button
      class="md:hidden fixed top-2 left-2 z-50 p-2 bg-white rounded-md shadow-md"
      on:click={toggleSidebar}
    >
      <Menu size={24} />
    </button>
  {/if}

  <!-- Sidebar with responsive classes -->
  <div class="
    {$sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    md:translate-x-0
    transition-transform duration-200
    fixed md:relative
    z-40 md:z-auto
    w-[240px]
    bg-[#f7f7f7]
    flex flex-col
    h-full
    {innerWidth < 768 && $sidebarOpen ? 'shadow-lg' : ''}
  ">
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

    <!-- Replace the settings button with user profile dropdown -->
    <div class="p-4 border-t user-dropdown">
      <div class="relative">
        <button
          on:click={toggleDropdown}
          class="w-full flex items-center gap-3 hover:bg-gray-100 p-2 rounded-md"
        >
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
            {getInitial($page.data.user?.email || '')}
          </div>
          <span class="flex-1 truncate text-sm">
            {$page.data.user?.email}
          </span>
        </button>

        {#if dropdownOpen}
          <div 
            class="absolute bottom-full left-0 w-full mb-1 bg-white rounded-md shadow-lg border py-1"
          >
            <a 
              href="/settings"
              class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
            >
              <Settings size={16} />
              <span>Settings</span>
            </a>
            <button
              on:click={handleLogout}
              class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer text-red-500"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Overlay for mobile -->
  {#if innerWidth < 768 && $sidebarOpen}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 z-30"
      on:click={() => $sidebarOpen = false}
    ></div>
  {/if}

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
      class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
      on:click={() => selectedSessionId && handleExport(selectedSessionId)}
    >
      Export Chat
    </button>
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
