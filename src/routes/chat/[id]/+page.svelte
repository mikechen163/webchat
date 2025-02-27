<script lang="ts">
  import { page } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { onMount } from "svelte";
  import { marked } from "marked";
  import ChatBubble from "$lib/components/ChatBubble.svelte";
  import { toast } from "$lib/components/ui/toast";
  import { onDestroy } from "svelte";

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
      // Add user message to the UI
      messages = [...messages, { role: "user", content: userMessage }];
      
      // Call the server endpoint
      const response = await fetch(`/api/chat/${$page.params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Add empty assistant message
      messages = [...messages, { role: "assistant", content: "" }];

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let assistantResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        assistantResponse += chunk;
        
        // Update the last message (assistant's response)
        messages = messages.map((msg, i) => {
          if (i === messages.length - 1) {
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
      // Remove the assistant message if there was an error
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

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="border-b p-4 flex items-center justify-between">
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
      <h1 
        class="text-xl font-semibold cursor-pointer hover:text-gray-600"
        on:click={() => editingTitle = true}
      >
        {data.session.title}
      </h1>
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

  <!-- Messages -->
  <div 
    class="flex-1 overflow-y-auto p-4 space-y-4"
    bind:this={messageContainer}
    on:scroll={handleScroll}
  >
    {#each messages as message (message.id)}
      <ChatBubble 
        role={message.role}
        content={message.content}
        timestamp={message.createdAt}
      />
    {/each}
  </div>

  <!-- Typing Indicator -->
  {#if sending}
    <div class="px-4 py-2 text-sm text-gray-500">
      Bot is typing...
    </div>
  {/if}

  <!-- Input -->
  <div class="border-t p-4">
    <form on:submit|preventDefault={handleSubmit} class="flex gap-2">
      <Input
        type="text"
        bind:value={messageInput}
        placeholder="Type a message..."
        disabled={sending}
        class="flex-1"
      />
      <Button type="submit" disabled={sending}>
        {sending ? "Sending..." : "Send"}
      </Button>
    </form>
  </div>
</div>
