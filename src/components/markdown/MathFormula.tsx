import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ensureKatex, type Katex } from '../../services/markdown/katex.js'

/** renderToString 外层包裹的标签，组件自己渲染外层，这里切掉 */
const KATEX_WRAPPER = {
  inline: ['<span class="katex">', '</span>'],
  display: ['<span class="katex-display"><span class="katex">', '</span></span>'],
} as const

type MathHtmlResult = {
  html: string
  renderMode: 'katex' | 'fallback'
}

const noop = () => {}

/** KaTeX 不支持 \scalebox：按倍数换成等价字号命令，只能近似放大，不改变盒子宽度 */
const SCALEBOX_FONTS: { scale: number; command: string }[] = [
  { scale: 2.2, command: '\\Huge' },
  { scale: 1.6, command: '\\LARGE' },
  { scale: 1.25, command: '\\Large' },
  { scale: 1.02, command: '\\large' },
]

/** 取最接近的字号命令，任意倍数都能落到一个档位 */
const nearestFontCommand = (scale: number) => {
  let best = SCALEBOX_FONTS[0]
  for (const item of SCALEBOX_FONTS) {
    if (Math.abs(item.scale - scale) < Math.abs(best.scale - scale)) {
      best = item
    }
  }
  return best.command
}

/** 从 start（必须是 '{'）开始读一个配平的花括号组，支持嵌套与转义 */
const readGroup = (input: string, start: number) => {
  let depth = 0
  for (let i = start; i < input.length; i += 1) {
    const char = input[i]
    if (char === '\\') {
      i += 1
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return { body: input.slice(start + 1, i), end: i + 1 }
      }
    }
  }
  return null
}

const skipSpaces = (input: string, start: number) => {
  let i = start
  while (i < input.length && /\s/.test(input[i])) {
    i += 1
  }
  return i
}

const SCALEBOX = '\\scalebox'

/** 把 \scalebox{倍数}{内容} 换成字号命令；内容里的嵌套花括号原样保留 */
const expandScalebox = (input: string) => {
  let out = ''
  let i = 0
  while (i < input.length) {
    const index = input.indexOf(SCALEBOX, i)
    if (index === -1) {
      out += input.slice(i)
      break
    }
    out += input.slice(i, index)
    const sizeStart = skipSpaces(input, index + SCALEBOX.length)
    const sizeGroup = input[sizeStart] === '{' ? readGroup(input, sizeStart) : null
    const bodyStart = sizeGroup ? skipSpaces(input, sizeGroup.end) : -1
    const bodyGroup = sizeGroup && input[bodyStart] === '{' ? readGroup(input, bodyStart) : null
    if (!sizeGroup || !bodyGroup) {
      // 写法不完整：原样保留，交给 KaTeX 报错后回退原文
      out += SCALEBOX
      i = index + SCALEBOX.length
      continue
    }
    const scale = Number.parseFloat(sizeGroup.body)
    out += Number.isFinite(scale)
      ? `${nearestFontCommand(scale)}{${bodyGroup.body}}`
      : bodyGroup.body
    i = bodyGroup.end
  }
  return out
}

/** 模型常漏写结尾的右花括号：补齐后再交给 KaTeX，避免整行回退成源码 */
const closeBraces = (input: string) => {
  let depth = 0
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (char === '\\') {
      i += 1
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
    }
  }
  return depth > 0 ? input + '}'.repeat(depth) : input
}

/** 兜底：万一还有漏网的 \scalebox（比如被拆成多次增量），只保留正文 */
const SCALEBOX_MACROS = {
  '\\scalebox': (...args: unknown[]) => String(args.at(-1) ?? ''),
}

/** KaTeX 渲染公式；出错时保留上次成功的结果（流式中公式未写完），没有则展示原文 */
const useMathHtml = (input: string, isInline: boolean): MathHtmlResult => {
  const previousResultRef = useRef<MathHtmlResult | null>(null)
  const katexRef = useRef(ensureKatex())
  const [katex, setKatex] = useState<Katex | null>(
    katexRef.current instanceof Promise ? null : katexRef.current
  )

  useEffect(() => {
    if (katexRef.current instanceof Promise) {
      katexRef.current.then(setKatex, noop)
    }
  }, [])

  return useMemo((): MathHtmlResult => {
    if (!katex) {
      return { html: input, renderMode: 'fallback' }
    }
    try {
      const [prefix, suffix] = KATEX_WRAPPER[isInline ? 'inline' : 'display']
      const html = katex
        .renderToString(expandScalebox(closeBraces(input)), {
          throwOnError: true,
          strict: false,
          displayMode: !isInline,
          macros: SCALEBOX_MACROS,
        })
        .slice(prefix.length, -suffix.length)
      const result = { html, renderMode: 'katex' } as const
      previousResultRef.current = result
      return result
    } catch {
      return previousResultRef.current ?? { html: input, renderMode: 'fallback' }
    }
  }, [input, isInline, katex])
}

export const MathBlock = memo(function MathBlock({ value }: { value: string }) {
  const { html, renderMode } = useMathHtml(value, false)
  if (renderMode === 'fallback') {
    return <p className="ds-markdown-paragraph">{html}</p>
  }
  return (
    <span className="katex-display ds-markdown-math">
      <span className="katex" dangerouslySetInnerHTML={{ __html: html }}></span>
    </span>
  )
})

export const InlineMath = memo(function InlineMath({ value }: { value: string }) {
  const { html, renderMode } = useMathHtml(value, true)
  if (renderMode === 'fallback') {
    return html
  }
  return <span className="katex" dangerouslySetInnerHTML={{ __html: html }}></span>
})
