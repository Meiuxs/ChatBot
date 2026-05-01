import { marked } from 'marked'
import type { Tokens } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
}))

marked.use({ breaks: true, gfm: true })

// Mermaid 流程图扩展
marked.use({
  extensions: [
    {
      name: 'mermaid',
      level: 'block',
      start(src: string) {
        return src.indexOf('```mermaid\n')
      },
      tokenizer(src: string) {
        const match = /^```mermaid\n([\s\S]*?)\n```\n?/.exec(src)
        if (match) {
          return {
            type: 'mermaid',
            raw: match[0],
            text: match[1].trim(),
          }
        }
      },
      renderer(token: Tokens.Generic) {
        return `<div class="mermaid">${(token as unknown as { text: string }).text}</div>\n`
      },
    },
  ],
})

export function renderMarkdown(content: string): string {
  return marked.parse(content) as string
}
