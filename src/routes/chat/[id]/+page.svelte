<script lang="ts">
  import { page } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { onMount } from "svelte";
  import { marked } from "marked";
  import ChatBubble from "$lib/components/ChatBubble.svelte";
  import { toast } from "$lib/components/ui/toast";
  import { onDestroy } from "svelte";
  import { sessionsStore } from '$lib/stores/sessions';
  import { ArrowUp } from "lucide-svelte";  // 添加这行引入

  export let data;
  let messages = data.messages || [];
  let messageInput = "";
  let messageContainer: HTMLDivElement;
  let sending = false;
  
  let editingTitle = false;
  let newTitle = data.session.title;

  let autoScroll = true;
  let typingTimeout: NodeJS.Timeout;
  let lastTypingUpdate = 0;


  // 添加工具栏状态控制
  let showTools = false;
  
  // 添加工具选项
  const tools = [
    { id: 'thinking', label: 'Thinking ', icon: '🤔' },
    { id: 'websearch', label: 'Web Search', icon: '🌐' }
   // { id: 'tools', label: 'Tools', icon: '🛠' }, 
   // { id: 'image', label: 'Image', icon: '🖼' },
  
  ];

  // 添加工具选择处理函数
  function handleToolSelect(toolId: string) {
    // 根据不同工具实现相应功能
    console.log(`Selected tool: ${toolId}`);
    showTools = false;
  }

  // 定期保存草稿
  $: if (messageInput) {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(saveDraft, 1000);
  }

  async function saveDraft() {
    const now = Date.now();
    if (now - lastTypingUpdate < 5000) return;
    
    lastTypingUpdate = now;
    localStorage.setItem(`draft_${$page.params.id}`, messageInput);
  }

  onMount(() => {
    const draft = localStorage.getItem(`draft_${$page.params.id}`);
    if (draft) messageInput = draft;
  });

  onDestroy(() => {
    clearTimeout(typingTimeout);
  });

  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    const atBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    autoScroll = atBottom;
  }

  $: if (autoScroll && messageContainer) {
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  async function handleSubmit() {
    if (!messageInput.trim() || sending) return;
    
    sending = true;
    const userMessage = messageInput;
    messageInput = "";
    localStorage.removeItem(`draft_${$page.params.id}`);

    try {
      // 生成唯一ID用于消息跟踪
      const tempUserMsgId = Date.now().toString();
      const tempAssistantMsgId = (Date.now() + 1).toString();
      
      // 添加用户消息
      messages = [...messages, { 
        id: tempUserMsgId,
        role: "user", 
        content: userMessage,
        createdAt: new Date()
      }];
      
      const response = await fetch(`/api/chat/${$page.params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // 添加空的助手消息
      messages = [...messages, { 
        id: tempAssistantMsgId,
        role: "assistant", 
        content: "",
        createdAt: new Date()
      }];

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let assistantResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // 轮询检查session更新
          let retries = 0;
          const maxRetries = 5;
          
          while (retries < maxRetries) {
            const sessionResponse = await fetch(`/api/chat/${$page.params.id}/session`);
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              if (sessionData.title !== data.session.title) {
                data.session = sessionData;
                // 触发页面更新
                data = { ...data };
                // 通知sidebar更新
                $sessionsStore.invalidate();
                break;
              }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
          }
          break;
        }
        
        const chunk = new TextDecoder().decode(value);
        assistantResponse += chunk;
        
        // 更新助手消息内容
        messages = messages.map(msg => {
          if (msg.id === tempAssistantMsgId) {
            return { ...msg, content: assistantResponse };
          }
          return msg;
        });
      }

    } catch (e) {
      console.error("Chat error:", e);
      toast({
        title: "Error",
        description: "Failed to send message",
        type: "error"
      });
      // 发生错误时删除助手消息
      messages = messages.slice(0, -1);
    } finally {
      sending = false;
    }
  }

  async function updateTitle() {
    const response = await fetch(`/api/chat/${$page.params.id}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle })
    });
    
    if (response.ok) {
      editingTitle = false;
      data.session.title = newTitle;
    }
  }

  async function clearHistory() {
    if (!confirm("Are you sure you want to clear the chat history?")) return;
    
    const response = await fetch(`/api/chat/${$page.params.id}/messages`, {
      method: "DELETE"
    });
    
    if (response.ok) {
      messages = [];
    }
  }

  async function exportChat() {
    const chatData = {
      title: data.session.title,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt
      }))
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${data.session.title}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  function formatMessage(content: string) {
    return marked(content);
  }
</script>

<div class="w-full h-screen">
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="border-b">
      <div class="max-w-[1000px] mx-auto p-4 flex items-center justify-between">
        {#if editingTitle}
          <form 
            on:submit|preventDefault={updateTitle}
            class="flex items-center gap-2"
          >
            <Input
              bind:value={newTitle}
              class="w-64"
              autofocus
              on:blur={() => editingTitle = false}
            />
          </form>
        {:else}
          <button 
            type="button"
            class="text-xl font-semibold hover:text-gray-600 text-left"
            on:click={() => editingTitle = true}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                editingTitle = true;
              }
            }}
          >
            {data.session.title}
          </button>
        {/if}
        
        <div class="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            on:click={exportChat}
          >
            Export Chat
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            on:click={clearHistory}
          >
            Clear History
          </Button>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div 
      class="flex-1 overflow-y-auto min-h-0"
      bind:this={messageContainer}
      on:scroll={handleScroll}
    >
      <div class="max-w-[1000px] mx-auto p-4 space-y-4">
        {#each messages as message (message.id)}
          <ChatBubble 
            role={message.role}
            content={message.content}
            timestamp={message.createdAt}
          />
        {/each}
      </div>
    </div>

    <!-- Typing Indicator -->
    {#if sending}
      <div class="shrink-0">
        <div class="max-w-[1000px] mx-auto px-4 py-2 text-sm text-gray-500">
          Bot is typing...
        </div>
      </div>
    {/if}

    <!-- 修改 Input 部分 -->
  <div class="border-t shrink-0">
    <div class="max-w-[1000px] mx-auto p-4">
      <!-- 添加工具栏 -->
      <div class="mb-2 flex items-center gap-2 text-sm text-gray-600">
        {#each tools as tool}
          <button
            class="px-3 py-1.5 rounded-full hover:bg-gray-100 flex items-center gap-1.5"
            on:click={() => handleToolSelect(tool.id)}
          >
            <span>{tool.icon}</span>
            <span>{tool.label}</span>
          </button>
        {/each}
      </div>
      
      <!-- 消息输入表单 -->
      <form on:submit|preventDefault={handleSubmit} class="flex items-center gap-2">
        <Input
          type="text"
          bind:value={messageInput}
          placeholder="Send a Message"
          disabled={sending}
          class="flex-1 h-[48px] rounded-[24px] text-lg px-6 bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <Button 
          type="submit" 
          disabled={sending}
          class="h-12 w-12 rounded-full p-0 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          variant="default"
        >
          {#if sending}
            <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          {:else}
            <ArrowUp class="h-6 w-6" />
          {/if}
        </Button>
      </form>

      <!-- 添加提示文本 -->
      <div class="mt-2 text-xs text-gray-400 text-center">
        Thinking (QwQ) is a preview model and is still being updated.
      </div>
    </div>
  </div>

    
  </div>
</div>
