<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { marked } from 'marked';
  import { Button } from './ui/button';
  import { ChevronDown, ChevronUp, ClipboardCopy, Check } from 'lucide-svelte';



  export let content: string;
  export let role: 'user' | 'assistant';
  export let timestamp: Date;
  export let modelInfo: string = '';
  export let tokenCount: number = 0;

  const dispatch = createEventDispatcher();
  let copied = false;
  let showReasoning = true;
  let katexLoaded = false;

    // new: per-block copy flags
  let copiedCode = false;
  let copiedResult = false;

  // Function to get the processed content without reasoning sections for copying
  function getProcessedContentForCopy(): string {
    let processed = content;
    
    // Remove reasoning sections if they exist
    if (hasReasoning) {
      processed = content.replace(/<think>[\s\S]*?<\/think>/g, '');
      //processed = content.replace(/<tool_call><tool_call>[\s\S]*?<\/think>/g, '');
    }
    
    // Note: For a more advanced solution, we could also process KaTeX and Markdown here
    // to generate plain text that resembles the rendered HTML more closely.
    // However, for now, removing reasoning sections is the primary goal.
    
    return processed.trim();
  }

  // helper to parse execute_python tool messages
  function parseExecutePython(raw: string) {
    try {
      if (!raw) return null;
      const startMarker = '{"tool":"execute_python"';
      const startIdx = raw.indexOf(startMarker);
      if (startIdx === -1) return null;

      // Extract the code string by finding the "code": "...." value (respecting escaped quotes)
      const codeKey = '"code":';
      const codePos = raw.indexOf(codeKey, startIdx);
      let code = '';
      let endQuoteIndex = -1;
      if (codePos !== -1) {
        // find the first quote after "code":
        let q = raw.indexOf('"', codePos + codeKey.length);
        if (q !== -1) {
          q++; // first char of string
          let sb = '';
          let escaped = false;
          for (let i = q; i < raw.length; i++) {
            const ch = raw[i];
            if (escaped) {
              // keep the escape sequence as-is for now
              sb += ch === 'n' ? '\\n' : ch === 't' ? '\\t' : ch;
              escaped = false;
              continue;
            }
            if (ch === '\\') {
              escaped = true;
              continue;
            }
            if (ch === '"') {
              endQuoteIndex = i;
              break;
            }
            sb += ch;
          }
          // decode common escapes
          code = sb
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim();
        }
      }

      // Try to extract stdout/result. Support multiple marker formats.
      let result = '';
      const stdoutRegex = /(?:--- stdout ---|\[Tool execute_python output\]:)/i;
      const stdoutMatch = raw.match(stdoutRegex);
      if (stdoutMatch) {
        let start = raw.indexOf(stdoutMatch[0]) + stdoutMatch[0].length;
        result = raw.slice(start).trim();
      } else if (endQuoteIndex !== -1) {
        // fallback: take content after the code closing quote (best-effort)
        result = raw.slice(endQuoteIndex + 1).trim();
      } else {
        result = raw.slice(startIdx).trim();
      }

      // Clean result:
      // - Remove leading "RC=0," or "RC=0。" or similar
      result = result.replace(/^\s*RC\s*=?\s*\d+\s*[,，]?\s*/i, '');
      // - Remove trailing --- stderr --- and everything after it
      const stderrIdx = result.indexOf('--- stderr ---');
      if (stderrIdx !== -1) result = result.slice(0, stderrIdx).trim();
      // - Remove leading bracketed labels like "[Tool ...]:" if still present
      result = result.replace(/^\s*\[.*?\]\s*:?\s*/,'').trim();
      // - Strip surrounding quotes if any accidental extra quotes
      if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith('“') && result.endsWith('”'))) {
        result = result.slice(1, -1).trim();
      }

      return { code, result };
    } catch (e) {
      console.error('parseExecutePython error', e);
      return null;
    }
  }

  // reactive parsed tool object
  $: toolParsed = parseExecutePython(content);
  $: isExecutePython = !!toolParsed;

  function copyToClipboard() {
    const contentToCopy = getProcessedContentForCopy();
    navigator.clipboard.writeText(contentToCopy);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }

   // 通用的拷贝到剪贴板并设置状态标记的函数
 function copyTextToClipboard(text: string, setFlag: (v: boolean) => void) {
   if (!text) return;
   // 使用 Promise 接口，成功后设置状态并在 2s 后恢复
   navigator.clipboard.writeText(text).then(() => {
     setFlag(true);
     setTimeout(() => setFlag(false), 2000);
   }).catch((err) => {
     console.error('Clipboard write failed', err);
   });
 }


  //  function copyCode() { if (toolParsed?.code) copyTextToClipboard(toolParsed.code, v => copiedCode = v); }
  //function copyResult() { if (toolParsed?.result) copyTextToClipboard(toolParsed.result, v => copiedResult = v); }
    function copyCode() { if (toolParsed?.code) copyTextToClipboard(toolParsed.code, v => copiedCode = v); }
  function copyResult() { if (toolParsed?.result) copyTextToClipboard(toolParsed.result, v => copiedResult = v); }
  


  function toggleReasoning() {
    showReasoning = !showReasoning;
  }
  
  // Check if the content contains reasoning sections
  $: hasReasoning = role === 'assistant' && content.includes('<think>') && content.includes('</think>');

  onMount(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    
    // Load KaTeX CSS and JS for math rendering
    if (typeof window !== 'undefined') {
      // Load KaTeX CSS
      if (!document.querySelector('link[href*="katex"]')) {
        const katexCSS = document.createElement('link');
        katexCSS.rel = 'stylesheet';
        katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        document.head.appendChild(katexCSS);
      }
      
      // Load KaTeX JS
      if (!(window as any).katex && !document.querySelector('script[src*="katex"]')) {
        const katexJS = document.createElement('script');
        katexJS.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
        katexJS.onload = () => {
          katexLoaded = true;
          console.log('KaTeX loaded successfully');
        };
        katexJS.onerror = () => {
          console.error('Failed to load KaTeX');
        };
        document.head.appendChild(katexJS);
      } else if ((window as any).katex) {
        katexLoaded = true;
      }
    }
  });

  // Process the content to handle reasoning sections and apply markdown
  $: htmlContent = ((katexIsReady) => { // Dependency injection
    if (!katexIsReady) {
      // If KaTeX is not ready, just process markdown without math
      let processed = content;
      if (hasReasoning) {
        if (showReasoning) {
          processed = content.replace(
            /<think>([\s\S]*?)<\/think>/g,
            (match, reasoningContent) => {
              return `<div class="reasoning-section">${reasoningContent}</div>`;
            }
          );
        } else {
          processed = content.replace(/<think>[\s\S]*?<\/think>/g, '');
        }
      }
      return marked(processed) as string;
    }

    let processed = content;
    if (hasReasoning) {
      if (showReasoning) {
        processed = content.replace(
          /<think>([\s\S]*?)<\/think>/g,
          (match, reasoningContent) => {
            return `<div class="reasoning-section">${reasoningContent}</div>`;
          }
        );
      } else {
        processed = content.replace(/<think>[\s\S]*?<\/think>/g, '');
      }
    }
    
    // Process math expressions with KaTeX BEFORE markdown processing
    if (typeof window !== 'undefined' && (window as any).katex) {
     // console.log('Processing math with KaTeX for content:', processed.substring(0, 100));
      
      // Handle display math ($$...$$) first
      processed = processed.replace(/\$\$([^$]+?)\$\$/g, (match: string, math: string) => {
        try {
          const cleanMath = math.trim();
         // console.log('Rendering display math:', cleanMath);
          const rendered = (window as any).katex.renderToString(cleanMath, { 
            displayMode: true,
            throwOnError: false
          });
          return `<div class="katex-display-wrapper">${rendered}</div>`;
        } catch (e) {
          console.warn('KaTeX display math error:', e, 'for:', math);
          return match;
        }
      });
      
      // Handle inline math ($...$) after display math - use simpler regex
      processed = processed.replace(/\$([^$\n]+?)\$/g, (match: string, math: string) => {
        // Skip if this is part of a display math (already processed)
        if (processed.includes(`<div class="katex-display-wrapper">`) && 
            processed.includes(match)) {
          return match;
        }
        try {
          const cleanMath = math.trim();
          console.log('Rendering inline math:', cleanMath);
          const rendered = (window as any).katex.renderToString(cleanMath, { 
            displayMode: false,
            throwOnError: false
          });
          return `<span class="katex-inline-wrapper">${rendered}</span>`;
        } catch (e) {
          console.warn('KaTeX inline math error:', e, 'for:', math);
          return match;
        }
      });
    } else {
      console.log('KaTeX not available, window.katex:', typeof window !== 'undefined' ? !!(window as any).katex : 'no window');
    }
    
    // Apply markdown processing (marked returns string in sync mode)
    let html = marked(processed) as string;
    
    return html;
  })(katexLoaded); // Pass the reactive variable here

  $: formattedTime = (() => {
    try {
      if (!timestamp) return '';
      const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(d.getTime())) return '';
      // Some environments may not support toLocaleTimeString fully; guard it
      try {
        return d.toLocaleTimeString();
      } catch (e) {
        return d.toISOString().split('T')[1].split('.')[0];
      }
    } catch (e) {
      return '';
    }
  })();
</script>

<div class="flex gap-4 {role === 'assistant' ? 'bg-gray-50' : ''} p-4 rounded group">
  <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
    {role === 'assistant' ? '🤖' : '👤'}
  </div>
  
  <div class="flex-1 min-w-0">
    <div class="flex items-start justify-between gap-2 md:gap-4">
      <div class="prose w-full md:w-auto max-w-none break-words">
        {#if hasReasoning}
          <!-- Show reasoning toggle if available -->
          <div class="reasoning-toggle mb-1">
            <button 
              class="text-xs flex items-center gap-1 px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
              on:click={toggleReasoning}
            >
              {#if showReasoning}
                <ChevronUp class="h-3 w-3" />
                <span>Hide reasoning</span>
              {:else}
                <ChevronDown class="h-3 w-3" />
                <span>Show reasoning</span>
              {/if}
            </button>
          </div>
        {/if}
        
         <!-- new: special rendering for execute_python tool messages -->
        {#if isExecutePython}
          <div class="space-y-3">
            <div class="tool-block bg-gray-50 border border-gray-200 rounded p-3 relative">
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs text-gray-600">{'code'}</div>
                <button
                  class="p-1 rounded text-gray-500 hover:text-gray-700 focus:outline-none"
                  on:click={copyCode}
                  aria-label="Copy code"
                >
                  {#if copiedCode}
                    <Check class="h-4 w-4 text-green-500" />
                  {:else}
                    <ClipboardCopy class="h-4 w-4" />
                  {/if}
                </button>
              </div>
              <pre class="whitespace-pre-wrap text-sm"><code>{toolParsed.code}</code></pre>
            </div>

          <div class="tool-block bg-gray-200 border border-gray-200 rounded p-3 relative">
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs text-gray-600">{'result'}</div>


                  <!-- 按钮：提升可读性 -->
                <button
                    class="p-1 rounded text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    on:click={copyResult}
                    aria-label="Copy result"
                  >

                  {#if copiedResult}
                    <Check class="h-4 w-4 text-green-500" />
                  {:else}
                    <ClipboardCopy class="h-4 w-4" />
                  {/if}
                </button>
              </div>
              <pre class="whitespace-pre-wrap text-sm text-gray-900">{toolParsed.result}</pre>
            </div>
          </div>
        {:else}
          {@html htmlContent}
        {/if}




      </div>
      
    </div>
    
    <div class="mt-2 text-xs text-gray-500 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span>{formattedTime}</span>
        {#if role === 'assistant' && modelInfo}
          <span class="text-gray-400">|</span>
          <span class="text-gray-600">{modelInfo}</span>
          {#if tokenCount > 0}
            <span class="text-gray-400">|</span>
            <span class="text-gray-600">{tokenCount} tokens</span>
          {/if}
        {/if}
      </div>
      
      <button 
        class="text-gray-500 hover:text-gray-700 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
        on:click={copyToClipboard}
        aria-label="Copy message"
      >
        {#if copied}
          <Check class="h-4 w-4 text-green-500" />
        {:else}
          <ClipboardCopy class="h-4 w-4" />
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  /* Style for code blocks with light background */
  :global(.prose pre) {
    background-color: #f8f9fa !important;
    border: 1px solid #e9ecef !important;
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
  }
  
  :global(.prose pre code) {
    color: #212529 !important;
    background-color: transparent !important;
    padding: 0;
  }
  
  /* Style for inline code */
  :global(.prose code:not(pre code)) {
    background-color: #f8f9fa !important;
    color: #e83e8c !important;
    border: 1px solid #e9ecef !important;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  /* KaTeX math styling */
  :global(.katex) {
    font-size: 1.1em;
  }
  
  :global(.katex-display) {
    margin: 1em 0;
    text-align: center;
  }
  
  :global(.katex-display-wrapper) {
    margin: 1em 0;
    text-align: center;
    display: block;
  }
  
  :global(.katex-inline-wrapper) {
    display: inline;
  }
  
  /* Prevent markdown from interfering with KaTeX */
  :global(.katex-display-wrapper p) {
    margin: 0;
  }

  .tool-block {
  position: relative;
  font-size: 16px; /* 设置基准字体大小 */
}

.tool-block pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
  /* 继承 16px，也可单独设置 */
}

.tool-block .text-xs {
  font-weight: 600;
  /*color: #4b5563; */
  /* 如果你仍希望 .text-xs 是“小号字体”，可设为 12px 或 0.75rem */
  /* font-size: 0.75rem; */
}

  
  /* Style for reasoning sections */
  :global(.reasoning-section) {
    background-color: #f3f0ff;
    border-left: 3px solid #9f7aea;
    padding: 0.5rem 1rem;
    margin: 0.5rem 0;
    font-size: 0.95em;
    border-radius: 0 0.3rem 0.3rem 0;
    position: relative;
    overflow-wrap: break-word;
  }
  
  /* Add a subtle marker for reasoning sections */
  :global(.reasoning-section::before) {
    content: "Reasoning";
    display: block;
    font-size: 0.75rem;
    color: #7e3af2;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }
</style>
