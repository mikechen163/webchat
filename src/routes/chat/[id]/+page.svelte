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
  import { ArrowUp, Trash2, Search, X } from "lucide-svelte";
  import ModelSelector from "$lib/components/ModelSelector.svelte";
  import { selectedModel } from "$lib/stores/selectedModel";
  import { browser } from "$app/environment";

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

  let viewportHeight = 0;
  
  function updateViewportHeight() {
    if (browser) {
      viewportHeight = window.innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);
    }
  }

  onMount(() => {
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure the orientation change completes
      setTimeout(updateViewportHeight, 100);
    });

    // On mobile browsers, address bar can appear/disappear causing height changes
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    
    const draft = localStorage.getItem(`draft_${$page.params.id}`);
    if (draft) messageInput = draft;
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    }
    clearTimeout(typingTimeout);
  });

  // 修改工具栏状态控制
  let showTools = false;
  let webSearchMode = false;

  // 修改工具选项, 直接使用let声明以确保状态变化会触发响应
  let tools = [
    {
      id: 'websearch',
      label: 'Web Search',
      icon: Search,
      toggle: () => {
        webSearchMode = !webSearchMode;
        console.log('Toggled web search mode:', webSearchMode); // Debug log
        return webSearchMode;
      }
    }
  ];

  $: console.log('Current webSearchMode:', webSearchMode); // 响应式调试日志

  async function performWebSearch(query: string) {
    console.log('[Chat] Performing web search:', { query });
    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const response = await fetch(`/api/search?q=${encodedQuery}`);
      
      console.log('[Chat] Search response status:', response.status);
      
      if (!response.ok) {
        console.error('[Chat] Search request failed:', response.status, response.statusText);
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      console.log('[Chat] Search results received:', {
        query,
        resultsCount: data.results?.length || 0,
        timestamp: data.timestamp
      });
      
      return data;
    } catch (error) {
      console.error('[Chat] Web search error:', error);
      throw error;
    }
  }

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

  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    const atBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    autoScroll = atBottom;
  }

  $: if (autoScroll && messageContainer) {
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  let abortController: AbortController | null = null;

  async function handleSubmit() {
    if (!messageInput.trim() || sending) return;
    
    sending = true;
    abortController = new AbortController();
    const userMessage = messageInput;
    messageInput = "";
    localStorage.removeItem(`draft_${$page.params.id}`);

    try {
      const tempUserMsgId = Date.now().toString();
      const tempAssistantMsgId = (Date.now() + 1).toString();
      
      messages = [...messages, { 
        id: tempUserMsgId,
        role: "user", 
        content: userMessage,
        createdAt: new Date()
      }];

      messages = [...messages, { 
        id: tempAssistantMsgId,
        role: "assistant", 
        content: "",
        createdAt: new Date()
      }];

      let content = userMessage;
      
      if (webSearchMode) {
        try {
          const searchResults = await performWebSearch(userMessage);
          
          const formattedResults = searchResults.results.map((r: any, index: number) => 
            `[${index + 1}] ${r.title}\n` +
            `URL: ${r.url}\n` +
            `${r.description}\n`
          ).join('\n');

          // 调试用户语言信息
          //console.log('[Chat] Session data:', data.session);
          //console.log('[Chat] User data:', data.session.user);
          
          const userLang = data.session.user?.language || 'en';
          console.log('[Chat] Detected user language:', userLang);

          const promptTemplate = {
            zh: `你是一个有帮助的助手，可以访问最新的网络搜索结果。
请根据以下搜索结果，提供一个全面但简洁的回答,输出语言为中文。
重点关注最相关和最新的信息。在适当的时候包含具体细节。
使用markdown格式以提高可读性。

要求：
1. 综合这些搜索结果的信息
2. 提供准确和最新的信息
3. 使用markdown格式以提高可读性
4. 如果搜索结果看起来过时或不相关，请说明
5. 引用具体信息时包含相关带有来源(可点击)编号 [1], [2] 等`,

            en: `You are a helpful assistant with access to recent web search results. 
Based on the following search results, provide a comprehensive but concise response.
Focus on the most relevant and recent information. Include specific details when appropriate.
Format your response using markdown for better readability.

Instructions:
1. Synthesize the information from these search results
2. Provide accurate and up-to-date information
3. Use markdown formatting for better readability
4. If search results seem outdated or irrelevant, mention this
5. Include relevant clickable source  numbers [1], [2], etc. when citing specific information`
          };

          content = `${promptTemplate[userLang] || promptTemplate.en}

<results>
${formattedResults}
</results>`;

        } catch (error) {
          console.error('[Chat] Web search flow error:', error);
          messages = messages.map(msg => 
            msg.id === tempAssistantMsgId 
              ? { ...msg, content: "I apologize, but I was unable to perform the web search. Please try again later." }
              : msg
          );
          sending = false;
          return;
        }
      }

      const response = await fetch(`/api/chat/${$page.params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content,
          modelId: $selectedModel?.id,
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let assistantResponse = "";
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = new TextDecoder().decode(value);
          assistantResponse += chunk;
          
          messages = messages.map(msg => {
            if (msg.id === tempAssistantMsgId) {
              return { ...msg, content: assistantResponse };
            }
            return msg;
          });
        }
      } catch (readError) {
        if (readError.name === 'AbortError') {
          throw readError; // Re-throw abort errors to be handled in the main catch block
        }
        throw new Error('Error reading response stream');
      }

      await checkAndUpdateSessionTitle();
      webSearchMode = false;

    } catch (e) {
      if (e.name === 'AbortError') {
        console.log("[Chat] Request cancelled by user");
        // Don't show toast here as it's handled in handleStop
        return;
      } else {
        console.error("[Chat] Submit error:", e);
        toast({
          title: "Error",
          description: "Failed to send message",
          type: "error"
        });
        messages = messages.slice(0, -1);
        messageInput = userMessage; // Restore the user's input on error
      }
    } finally {
      if (abortController) { // Only reset if not already handled by handleStop
        sending = false;
        abortController = null;
      }
    }
  }

  function handleStop() {
    if (abortController) {
      abortController.abort();
      abortController = null;
      // Remove the last assistant message when stopping
      messages = messages.slice(0, -1);
      // Reset sending state
      sending = false;
      // Restore the user's input
      messageInput = messages[messages.length - 1]?.content || "";
      toast({
        title: "Cancelled",
        description: "Message generation stopped",
        type: "info"
      });
    }
  }

  async function checkAndUpdateSessionTitle() {
    let retries = 0;
    const maxRetries = 1;
    while (retries < maxRetries) {
      const sessionResponse = await fetch(`/api/chat/${$page.params.id}/session`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        if (sessionData.title !== data.session.title) {
          data.session = sessionData;
          data = { ...data };
          $sessionsStore.invalidate();
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
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

  function formatMessage(content: string) {
    return marked(content);
  }
</script>

<svelte:head>
  <style>
    :root {
      --viewport-height: 100vh;
    }
    @supports (height: 100dvh) {
      :root {
        --viewport-height: 100dvh;
      }
    }
  </style>
</svelte:head>

<div class="w-full h-[var(--viewport-height)] flex flex-col">
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- Header -->
    <div class="border-b flex-shrink-0">
      <div class="w-full px-2 md:px-4 py-3 md:py-4 flex items-center justify-center">
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
            class="text-lg md:text-xl font-semibold hover:text-gray-600 text-center truncate max-w-[80%]"
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
        <div class="absolute right-2 md:right-4">
          <Button 
            variant="ghost" 
            size="icon"
            title="Clear History"
            on:click={clearHistory}
            class="h-9 w-9"
          >
            <Trash2 class="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
    <!-- Messages -->
    <div 
      class="flex-1 overflow-y-auto overscroll-contain"
      bind:this={messageContainer}
      on:scroll={handleScroll}
    >
      <div class="w-full md:max-w-3xl lg:max-w-4xl mx-auto px-3 md:px-4 py-3 md:py-4 space-y-4">
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
        <div class="w-full px-3 md:px-4 py-2 text-sm text-gray-500">
          Bot is typing...
        </div>
      </div>
    {/if}
    <!-- Input part - Fixed position on mobile -->
    <div class="border-t flex-shrink-0 bg-white sticky bottom-0 left-0 right-0 z-10">
      <div class="w-full md:max-w-3xl lg:max-w-4xl mx-auto px-3 md:px-4 py-3 md:py-4">
        <!-- Tool bar -->
        <div class="mb-2 flex items-center gap-2 text-sm text-gray-600 overflow-x-auto pb-1">
          {#each tools as tool}
            <button 
              class="px-2 md:px-3 py-1 md:py-1.5 rounded-full 
                {tool.id === 'websearch' && webSearchMode ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'} 
                flex items-center gap-1 md:gap-1.5 whitespace-nowrap"
              on:click={() => {
                console.log('Button clicked'); // Debug log
                tool.toggle();
              }}
            >
              <svelte:component this={tool.icon} class="h-4 w-4" />
              <span class="text-xs md:text-sm">{tool.label}</span>
            </button>
          {/each}
          <div class="h-5 border-l border-gray-200 mx-1"></div>
          <ModelSelector showFullName={true} />
        </div>
        <!-- Message input form -->
        <form on:submit|preventDefault={handleSubmit} class="flex items-center gap-2 max-w-full">
          <Input
            type="text"
            bind:value={messageInput}
            placeholder="Send a Message"
            disabled={sending}
            class="flex-1 h-[40px] md:h-[48px] rounded-[24px] text-sm md:text-base px-4 md:px-6 bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div class="flex gap-2">
            {#if sending}
              <Button 
                type="button"
                class="h-10 w-10 md:h-12 md:w-12 rounded-full p-0 flex items-center justify-center bg-red-500 hover:bg-red-600"
                variant="destructive"
                on:click={handleStop}
              >
                <X class="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            {/if}
            <Button 
              type="submit"
              disabled={sending}
              class="h-10 w-10 md:h-12 md:w-12 rounded-full p-0 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              variant="default"
            >
              {#if sending}
                <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              {:else}
                <ArrowUp class="h-5 w-5 md:h-6 md:w-6" />
              {/if}
            </Button>
          </div>
        </form>
        <!-- Bottom padding to ensure content isn't hidden behind keyboard on mobile -->
        <div class="h-2 md:hidden flex-shrink-0"></div>
      </div>
    </div>
  </div>
</div>