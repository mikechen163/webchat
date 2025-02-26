import { marked } from "marked";
import DOMPurify from "dompurify";

const renderer = new marked.Renderer();

// 自定义代码块渲染
renderer.code = (code, language) => {
  return `<pre><code class="language-${language}">${code}</code></pre>`;
};

// 配置marked选项
marked.setOptions({
  renderer,
  highlight: function(code, lang) {
    try {
      if (window.hljs && lang) {
        return window.hljs.highlight(code, { language: lang }).value;
      }
    } catch (e) {
      console.warn('Failed to highlight code block:', e);
    }
    return code;
  },
  breaks: true,
  gfm: true
});

export function formatMarkdown(content: string): string {
  const html = marked(content);
  return DOMPurify.sanitize(html);
}
