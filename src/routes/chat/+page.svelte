<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  
  let messages: Array<{ role: string; content: string }> = [];
  let dirResult: { ok: boolean; text?: string; items?: string[]; error?: string } | null = null;

  async function checkDirectory() {
    dirResult = null;
    try {
      const res = await fetch('/api/mcp/listdir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '.' }) });
      const data = await res.json();
      dirResult = data;
    } catch (e) {
      dirResult = { ok: false, error: String(e) };
    }
  }
</script>

<div class="flex-1 relative flex flex-col h-full">
  <!-- Messages container with improved responsive width -->
  <div class="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-6">
    <div class="w-full max-w-[calc(100vw-20px)] sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] mx-auto py-4 md:py-8">
      {#each messages as message}
        <div class="mb-4">
          <div class="flex items-start gap-2 sm:gap-4">
            <!-- AI or User icon -->
            <div class="flex-shrink-0 mt-1">
              {#if message.role === 'assistant'}
                <BotIcon />
              {:else}
                <UserIcon />
              {/if}
            </div>
            
            <!-- 增强的消息内容容器 -->
            <div class="flex-1 overflow-hidden">
              <div class="prose max-w-none whitespace-pre-wrap break-words overflow-wrap-anywhere text-sm sm:text-base">
                {#if message.content}
                  <SvelteMarkdown source={message.content} />
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Input area with matching responsive width -->
  <div class="border-t p-2.5 sm:p-4">
    <div class="w-full max-w-[calc(100vw-20px)] sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] mx-auto">
      <div class="flex gap-2 items-center mb-2">
        <Button on:click={checkDirectory}>检查当前目录</Button>
      </div>

      {#if dirResult}
        <div class="bg-surface-subtle rounded p-3 text-sm">
          {#if dirResult.ok}
            <div class="font-medium mb-1">目录列表</div>
            <pre class="whitespace-pre-wrap">{dirResult.text}</pre>
          {:else}
            <div class="text-destructive">错误: {dirResult.error}</div>
          {/if}
        </div>
      {/if}

      <!-- ...existing input form code... -->
    </div>
  </div>
</div>

<style>
  /* 确保任何地方都强制换行 */
  :global(.prose *) {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  
  /* 处理代码块的横向滚动 */
  :global(.prose pre) {
    overflow-x: auto;
    white-space: pre;
  }
  
  /* 确保行内代码也能换行 */
  :global(.prose code:not(pre code)) {
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
