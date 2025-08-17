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
      if (!raw || !raw.trim().startsWith('{"tool":"execute_python"')) return null;

      const marker = '--- stdout ---';
      const idx = raw.indexOf(marker);
      let head = raw;
      let result = '';
      if (idx !== -1) {
        head = raw.slice(0, idx);
        result = raw.slice(idx + marker.length).trim();
      }

      // Try to extract the "code" field content from the JSON-ish prefix.
      // Handle common JSON escapes.
      let code = '';
      const codeMatch = head.match(/"code"\s*:\s*"([\s\S]*)"\s*\}\s*$/) || head.match(/"code"\s*:\s*"([\s\S]*)"\s*$/);
      if (codeMatch && codeMatch[1]) {
        code = codeMatch[1];
      } else {
        const pos = head.indexOf('"code":');
        if (pos !== -1) {
          code = head.slice(pos + 7).trim();
          // strip leading colon/quotes/braces
          code = code.replace(/^\s*:\s*"/, '');
          code = code.replace(/"\s*$/, '');
        } else {
          // fallback: take everything after first newline (best-effort)
          const nl = head.indexOf('\n');
          code = nl !== -1 ? head.slice(nl + 1).trim() : '';
        }
      }

      // unescape common JSON escapes so code appears natural
      code = code
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .trim();

      return { code, result };
    } catch (e) {
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
                <div class="text-xs text-gray-600">{'{"tool":"execute_python"} — code'}</div>
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

            <div class="tool-block bg-gray-100 border border-gray-200 rounded p-3 relative">
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs text-gray-600">Result</div>
                <button
                  class="p-1 rounded text-gray-500 hover:text-gray-700 focus:outline-none"
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
              <pre class="whitespace-pre-wrap text-sm">{toolParsed.result}</pre>
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

  /* Styles for the tool blocks and copy buttons */
  .tool-block { position: relative; }
  .tool-block pre { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace; }
  .tool-block .text-xs { font-weight: 600; color: #4b5563; }

  
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
