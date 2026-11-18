import type { Node as MdAstNode, Nodes, Parent, RootContent, Root, Text } from 'mdast'
import { findAndReplace } from 'mdast-util-find-and-replace'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-llm-math'
import type { Source } from '../chat/view.js'

/** 正文里的 [citation:N]，已换成对应来源 */
export interface CitationNode extends MdAstNode {
  type: 'citation'
  source: Source
}

declare module 'mdast' {
  interface RootContentMap {
    citation: CitationNode
  }

  interface PhrasingContentMap {
    citation: CitationNode
  }
}

const text = (value: string): Text => ({ type: 'text', value })

/** 整行以 LaTeX 命令开头（模型偶尔漏掉 $$，会整段显示成源码） */
const LATEX_LINE = /^\\[A-Za-z]{2,}[\s{[]/

/**
 * 给整行裸 LaTeX 补上 $$ 定界符：只处理独立成行、不带 $ 的命令行，
 * 代码块内跳过；万一不是合法公式，KaTeX 渲染失败会回退成原文，不会丢内容。
 */
const wrapBareLatex = (input: string) => {
  const lines = input.split('\n')
  const output: string[] = []
  let inFence = false
  let inMath = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence
      output.push(line)
      continue
    }
    if (inFence) {
      output.push(line)
      continue
    }
    const delimiters = (trimmed.match(/\$\$/g) ?? []).length
    const wasInMath = inMath
    if (delimiters % 2 === 1) {
      inMath = !inMath
    }
    if (
      wasInMath ||
      delimiters > 0 ||
      trimmed.includes('$') ||
      !LATEX_LINE.test(trimmed)
    ) {
      output.push(line)
      continue
    }
    // 裸 LaTeX 常被模型折行、并漏写结尾的右花括号：接上后续行，直到配平或遇到空行
    // 模型常把一条公式折成两行，续行以 { 开头：接上后续续行，最多 4 行
    let block = trimmed
    let next = index + 1
    while (next < lines.length && next - index < 4) {
      const following = lines[next].trim()
      if (!following.startsWith('{') || following.includes('$$')) {
        break
      }
      block += following
      next += 1
    }
    index = next - 1
    output.push(`$$${block}$$`)
  }
  return output.join('\n')
}

/**
 * 解析正文，并把渲染器不单独处理的节点提前换掉，渲染时无需再读原文：
 * - 传入 sources 时，[citation:N] 换成角标节点，找不到来源的直接去掉
 * - disableLink 时链接只保留文字
 * - 删除线保留原样的 ~ 定界符，脚注、引用式链接与定义显示原文
 */
export function toMdAst(
  input: string,
  { sources, disableLink }: { sources: Source[] | undefined; disableLink: boolean }
): Root {
  const source = wrapBareLatex(input)
  const ast = fromMarkdown(source, {
    extensions: [
      // codeIndented 语法导致有前导空格的列表无法正常渲染
      { ...gfm(), disable: { null: ['codeIndented'] } },
      math({ singleDollarTextMath: true }),
    ],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  })
  if (sources) {
    const sourcesByIndex = new Map(sources.map((source) => [source.index, source]))
    findAndReplace(
      ast,
      [
        /\[citation:(\d+)\]/g,
        (_: string, index: string): CitationNode | '' => {
          const source = sourcesByIndex.get(Number(index))
          return source ? { type: 'citation', source } : ''
        },
      ],
      { ignore: ['linkReference'] }
    )
  }
  const raw = (node: Nodes) => source.slice(node.position?.start.offset, node.position?.end.offset)
  // 先处理子节点，再按需把当前节点换成若干节点
  const simplify = (node: Nodes): Nodes[] => {
    if ('children' in node) {
      ;(node as Parent).children = node.children.flatMap(simplify) as RootContent[]
    }
    switch (node.type) {
      case 'link':
        return disableLink ? node.children : [node]
      case 'delete': {
        // 解析器保证首尾定界符等长
        const delimiter = raw(node).match(/^~+/)?.[0] ?? ''
        return [text(delimiter), ...node.children, text(delimiter)]
      }
      case 'footnoteReference':
      case 'imageReference':
      case 'linkReference':
        return [text(raw(node))]
      case 'footnoteDefinition':
      case 'definition':
        return [{ type: 'paragraph', children: [text(raw(node))] }]
      default:
        return [node]
    }
  }
  simplify(ast)
  return ast
}
