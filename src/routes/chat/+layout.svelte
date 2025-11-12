<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { sidebarOpen } from '$lib/stores/layout';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import ConfirmDialog from '$lib/components/ui/confirm-dialog.svelte';
  import { createChatStore } from '$lib/stores/chat';
  import { get } from 'svelte/store';
  import { 
    Settings, 
    MessageSquare, 
    Plus, 
    Trash2, 
    Download,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
    X
  } from 'lucide-svelte';

  let innerWidth = 0;
  let showContextMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let selectedSessionId: string | null = null;
  let showConfirmDialog = false;
  let confirmDialogPosition = { x: 0, y: 0 };
  let chatStore: any = null;
  let sessions = [];
  let currentSessionId = '';
  let sidebarCollapsed = false;

  $: if (innerWidth >= 768) {
    $sidebarOpen = true;
  }

  onMount(async () => {
    // 初始化聊天存储
    if (browser) {
      chatStore = createChatStore();
      sessions = get(chatStore.sessions);
      currentSessionId = get(chatStore.currentSessionId);
      
      // 监听存储变化
      chatStore.sessions.subscribe((value) => {
        sessions = value;
      });
      chatStore.currentSessionId.subscribe((value) => {
        currentSessionId = value;
      });
    }
  });

  function handleNewChat() {
    if (chatStore) {
      chatStore.createNewSession();
      goto('/chat');
    }
  }

  function handleSelectSession(sessionId: string) {
    if (chatStore) {
      chatStore.setCurrentSession(sessionId);
      goto('/chat');
    }
  }

  function handleRightClick(event: MouseEvent, sessionId: string) {
    event.preventDefault();
    selectedSessionId = sessionId;
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    showContextMenu = true;
  }

  function hideContextMenu() {
    showContextMenu = false;
    selectedSessionId = null;
  }

  function handleClickDelete() {
    if (selectedSessionId) {
      showConfirmDialog = true;
      confirmDialogPosition = { x: contextMenuX, y: contextMenuY };
      hideContextMenu();
    }
  }

  async function confirmDelete() {
    if (selectedSessionId && chatStore) {
      try {
        await chatStore.deleteSession(selectedSessionId);
        toast.success('Chat session deleted successfully');
        if (currentSessionId === selectedSessionId) {
          goto('/chat');
        }
      } catch (error) {
        toast.error('Failed to delete chat session');
      }
    }
    showConfirmDialog = false;
    selectedSessionId = null;
  }

  async function handleExport(sessionId: string) {
    if (!chatStore) return;
    
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const messages = session.messages || [];
      const exportData = {
        sessionId: session.id,
        title: session.title,
        timestamp: new Date().toISOString(),
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${session.title || 'untitled'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Chat exported successfully');
      hideContextMenu();
    } catch (error) {
      toast.error('Failed to export chat');
      console.error('Export error:', error);
    }
  }

  function handleLogout() {
    goto('/logout');
  }

  function handleKeyDown(event: KeyboardEvent, sessionId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectSession(sessionId);
    }
  }

  function handleOverlayKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      $sidebarOpen = false;
    }
  }

  function toggleSidebar() {
    $sidebarOpen = !$sidebarOpen;
  }

  function formatSessionTime(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function truncateTitle(title: string, maxLength: number = 25) {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  }

  function handleCollapseToggle() {
    sidebarCollapsed = !sidebarCollapsed;
  }

  import { browser } from '$app/environment';
</script>

<svelte:window bind:innerWidth />

<div class="flex h-screen bg-slate-50 dark:bg-slate-900">
  <!-- Sidebar -->
  <div 
    class="flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out {sidebarCollapsed ? 'w-16' : 'w-80'}"
    class:hidden={innerWidth < 768 && !$sidebarOpen}
  >
    <!-- Header -->
    <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
      {#if !sidebarCollapsed}
        <h1 class="text-lg font-semibold text-slate-900 dark:text-white">WebChat</h1>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            on:click={handleCollapseToggle}
            class="h-8 w-8"
          >
            {#if sidebarCollapsed}
              <ChevronRight class="h-4 w-4" />
            {:else}
              <ChevronLeft class="h-4 w-4" />
            {/if}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            on:click={toggleSidebar}
            class="md:hidden h-8 w-8"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      {:else}
        <div class="flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            on:click={handleCollapseToggle}
            class="h-8 w-8"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            on:click={toggleSidebar}
            class="md:hidden h-8 w-8"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      {/if}
    </div>

    <!-- New Chat Button -->
    <div class="p-4">
      <Button 
        on:click={handleNewChat} 
        class="w-full justify-start"
        variant="outline"
      >
        <Plus class="h-4 w-4 mr-2" />
        {#if !sidebarCollapsed}New Chat{/if}
      </Button>
    </div>

    <!-- Chat Sessions -->
    <div class="flex-1 overflow-y-auto">
      {#if sessions.length > 0}
        <div class="px-2 space-y-1">
          {#each sessions as session (session.id)}
            <div
              role="button"
              tabindex="0"
              class="group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors text-sm {currentSessionId === session.id ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}"
              on:click={() => handleSelectSession(session.id)}
              on:keydown={(e) => handleKeyDown(e, session.id)}
              on:contextmenu={(e) => handleRightClick(e, session.id)}
              title={session.title || 'Untitled Chat'}
            >
              <div class="flex items-center flex-1 min-w-0">
                <MessageSquare class="h-4 w-4 mr-3 flex-shrink-0" />
                {#if !sidebarCollapsed}
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">
                      {truncateTitle(session.title || 'Untitled Chat')}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      {formatSessionTime(session.updatedAt)}
                    </div>
                  </div>
                {/if}
              </div>
              {#if !sidebarCollapsed && currentSessionId === session.id}
                <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6"
                    on:click={(e) => {
                      e.stopPropagation();
                      handleRightClick(e, session.id);
                    }}
                  >
                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </Button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="p-4 text-center text-slate-500 dark:text-slate-400">
          <p class="text-sm">No chat sessions yet</p>
          <p class="text-xs mt-1">Start a new conversation</p>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="p-4 border-t border-slate-200 dark:border-slate-700">
      <div class="flex items-center justify-between">
        {#if !sidebarCollapsed}
          <div class="flex items-center space-x-3">
            <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
              {$page.data.user?.name?.charAt(0) || 'U'}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
                {$page.data.user?.name || 'User'}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                {$page.data.user?.email}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              href="/admin/settings"
              class="h-8 w-8"
              title="Settings"
            >
              <Settings class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              on:click={handleLogout}
              class="h-8 w-8 text-red-500 hover:text-red-600"
              title="Logout"
            >
              <LogOut class="h-4 w-4" />
            </Button>
          </div>
        {:else}
          <div class="flex flex-col items-center gap-2 w-full">
            <Button
              variant="ghost"
              size="icon"
              href="/admin/settings"
              class="h-8 w-8"
              title="Settings"
            >
              <Settings class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              on:click={handleLogout}
              class="h-8 w-8 text-red-500 hover:text-red-600"
              title="Logout"
            >
              <LogOut class="h-4 w-4" />
            </Button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Overlay for mobile -->
  {#if innerWidth < 768 && $sidebarOpen}
    <div
      role="button"
      tabindex="0"
      class="fixed inset-0 bg-black bg-opacity-50 z-30"
      on:click={() => $sidebarOpen = false}
      on:keydown={handleOverlayKeyDown}
      aria-label="Close sidebar"
    ></div>
  {/if}

  <!-- Main Content with loading indicator -->
  <div class="flex-1 flex flex-col relative h-full w-full overflow-hidden">
    <!-- 内容部分 (消息和输入区域) 由子页面填充 -->
    <slot />
  </div>
</div>

{#if showContextMenu}
  <div 
    class="fixed z-50 bg-white rounded-md shadow-lg border py-1 min-w-[180px]"
    style="left: {contextMenuX}px; top: {contextMenuY}px"
  >
    <button
      type="button"
      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center"
      on:click={() => selectedSessionId && handleExport(selectedSessionId)}
    >
      <span class="mr-2">📥</span> Export Chat
    </button>
    <button
      type="button"
      class="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-100 flex items-center"
      on:click={handleClickDelete}
    >
      <span class="mr-2">🗑️</span> Delete Chat
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