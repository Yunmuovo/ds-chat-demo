import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import {
  beginSiderDrag,
  drawerEl,
  endSiderDrag,
  maskEl,
  openMobileSider,
  useMobileSider,
} from './mobileSiderState.js'

/** 判定为横向拖动的最小位移，避免和点击、纵向滚动混淆 */
const DRAG_START = 8
/** 水平位移需要明显大于垂直位移，避免和上下滚动打架 */
const HORIZONTAL_RATIO = 1.2
/** 松手时进度超过这个值就吸到打开 */
const SNAP_OPEN = 0.35

const drawerWidth = () => Math.min(300, window.innerWidth - 48)

/** 目标在可横向滚动的容器里（如宽代码块）时不抢手势 */
const insideScrollableX = (element: Element | null) => {
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (/auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth) {
      return true
    }
  }
  return false
}

/** 拖动中直接写样式：不经过 React，画面才跟得上手指 */
const paint = (progress: number) => {
  const drawer = drawerEl.current
  if (drawer) {
    drawer.style.transition = 'none'
    drawer.style.transform = `translateX(${(progress - 1) * 100}%)`
  }
  const mask = maskEl.current
  if (mask) {
    mask.style.transition = 'none'
    mask.style.opacity = String(progress)
  }
}

/**
 * 移动端抽屉手势：
 * - 从左往右拖动：抽屉跟手滑出
 * - 从右往左拖动：抽屉跟手收起
 * 松手按进度吸附（≥35% 打开），250ms 内的快速轻扫直接判定。
 * 输入框、可编辑区、横向可滚动容器上不接管手势。
 */
export const useSiderSwipe = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return
    }
    let startX = 0
    let startY = 0
    let startedOpen = false
    let startedAt = 0
    let mode: 'none' | 'open' | 'close' = 'none'
    let progress = 0
    let lastDx = 0
    let ignored = false

    const onTouchStart = (event: TouchEvent) => {
      mode = 'none'
      ignored = false
      if (event.touches.length !== 1) {
        ignored = true
        return
      }
      const target = event.target instanceof Element ? event.target : null
      if (
        target?.closest('input, textarea, [contenteditable="true"]') ||
        target?.closest('[data-swipe-ignore]') ||
        insideScrollableX(target)
      ) {
        ignored = true
        return
      }
      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      startedAt = performance.now()
      lastDx = 0
      startedOpen = useMobileSider.getState().open
    }

    const onTouchMove = (event: TouchEvent) => {
      if (ignored || event.touches.length !== 1) {
        return
      }
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (mode === 'none') {
        if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) {
          return
        }
        // 已打开时继续右滑、关闭时左滑都不接管
        if (dx > 0 ? startedOpen : !startedOpen) {
          ignored = true
          return
        }
        mode = dx > 0 ? 'open' : 'close'
        // 同步挂载抽屉，随后立刻可以写位置，避免第一帧跳一下
        flushSync(() => beginSiderDrag())
      }
      lastDx = dx
      const width = drawerWidth()
      progress =
        mode === 'open'
          ? Math.min(1, Math.max(0, dx / width))
          : Math.min(1, Math.max(0, 1 + dx / width))
      paint(progress)
      event.preventDefault()
    }

    const finish = () => {
      if (mode === 'none') {
        return
      }
      mode = 'none'
      // 250ms 内的快速轻扫直接吸附到目标状态
      const flick = performance.now() - startedAt < 250 && Math.abs(lastDx) > 45
      const willOpen = flick ? !startedOpen : progress >= SNAP_OPEN
      if (willOpen) {
        openMobileSider()
      } else {
        endSiderDrag(false)
      }
    }

    const onTouchEnd = () => finish()
    const onTouchCancel = () => {
      if (mode !== 'none') {
        mode = 'none'
        endSiderDrag(startedOpen)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled])
}
