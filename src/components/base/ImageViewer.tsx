import { useEffect, useRef } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { closeImageViewer, useImageViewer } from './imageViewerState.js'
import styles from './ImageViewer.module.css'

const MIN_SCALE = 1
const MAX_SCALE = 5
/** 双击放大的倍数 */
const DOUBLE_TAP_SCALE = 2.5
/** 拖动超过这个距离就不算「点击」，避免拖动时误关 */
const TAP_SLOP = 8

type Point = { x: number; y: number }

/**
 * 全屏图片预览：支持双指缩放、单指拖动、双击放大、滚轮缩放。
 * transform 直接写到 DOM，避免每帧触发 React 重渲染。
 */
export const ImageViewer = () => {
  const t = useTranslate()
  const src = useImageViewer((state) => state.src)
  const name = useImageViewer((state) => state.name)

  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const view = useRef({ scale: 1, tx: 0, ty: 0 })
  const pointers = useRef(new Map<number, Point>())
  const pinch = useRef<{ distance: number; scale: number; tx: number; ty: number; focus: Point } | null>(null)
  const drag = useRef<{ start: Point; tx: number; ty: number; moved: boolean } | null>(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })

  useEffect(() => {
    if (!src) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeImageViewer()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [src])

  // 换图时复位
  useEffect(() => {
    view.current = { scale: 1, tx: 0, ty: 0 }
    pointers.current.clear()
    pinch.current = null
    drag.current = null
    apply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const apply = () => {
    const image = imageRef.current
    if (!image) {
      return
    }
    const { scale, tx, ty } = view.current
    image.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`
    image.style.cursor = scale > MIN_SCALE ? 'grab' : 'zoom-in'
  }

  /** 限制平移范围：放大后不允许把图拖出视野 */
  const clamp = () => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) {
      return
    }
    const { scale } = view.current
    const maxX = Math.max(0, (image.offsetWidth * scale - stage.clientWidth) / 2)
    const maxY = Math.max(0, (image.offsetHeight * scale - stage.clientHeight) / 2)
    view.current.tx = Math.min(maxX, Math.max(-maxX, view.current.tx))
    view.current.ty = Math.min(maxY, Math.max(-maxY, view.current.ty))
  }

  /** 以某个点为中心缩放到目标倍数 */
  const zoomAt = (target: number, point: Point) => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    const rect = stage.getBoundingClientRect()
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, target))
    const ratio = scale / view.current.scale
    const fx = point.x - (rect.left + rect.width / 2)
    const fy = point.y - (rect.top + rect.height / 2)
    view.current.tx = fx - (fx - view.current.tx) * ratio
    view.current.ty = fy - (fy - view.current.ty) * ratio
    view.current.scale = scale
    if (scale === MIN_SCALE) {
      view.current.tx = 0
      view.current.ty = 0
    }
    clamp()
    apply()
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    stage.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: view.current.scale,
        tx: view.current.tx,
        ty: view.current.ty,
        focus: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      }
      drag.current = null
      return
    }
    if (pointers.current.size === 1) {
      drag.current = {
        start: { x: event.clientX, y: event.clientY },
        tx: view.current.tx,
        ty: view.current.ty,
        moved: false,
      }
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) {
      return
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current.distance > 0) {
        const scale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, (pinch.current.scale * distance) / pinch.current.distance)
        )
        const ratio = scale / pinch.current.scale
        const stage = stageRef.current
        const rect = stage?.getBoundingClientRect()
        const fx = pinch.current.focus.x - ((rect?.left ?? 0) + (rect?.width ?? 0) / 2)
        const fy = pinch.current.focus.y - ((rect?.top ?? 0) + (rect?.height ?? 0) / 2)
        view.current.scale = scale
        view.current.tx = fx - (fx - pinch.current.tx) * ratio
        view.current.ty = fy - (fy - pinch.current.ty) * ratio
        if (scale === MIN_SCALE) {
          view.current.tx = 0
          view.current.ty = 0
        }
        clamp()
        apply()
      }
      return
    }

    if (drag.current && view.current.scale > MIN_SCALE) {
      const dx = event.clientX - drag.current.start.x
      const dy = event.clientY - drag.current.start.y
      if (!drag.current.moved && Math.hypot(dx, dy) > TAP_SLOP) {
        drag.current.moved = true
      }
      view.current.tx = drag.current.tx + dx
      view.current.ty = drag.current.ty + dy
      clamp()
      apply()
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasSingle = pointers.current.size === 1
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) {
      pinch.current = null
    }
    if (pointers.current.size === 0) {
      const moved = drag.current?.moved ?? false
      drag.current = null
      if (wasSingle && !moved) {
        // 双击：在 1x 与 2.5x 之间切换，以点击处为中心
        const now = Date.now()
        const last = lastTap.current
        if (now - last.time < 300 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 40) {
          lastTap.current = { time: 0, x: 0, y: 0 }
          zoomAt(
            view.current.scale > MIN_SCALE + 0.01 ? MIN_SCALE : DOUBLE_TAP_SCALE,
            { x: event.clientX, y: event.clientY }
          )
          return
        }
        lastTap.current = { time: now, x: event.clientX, y: event.clientY }
        // 未放大时点一下就关（保持原来的轻点关闭习惯）
        if (view.current.scale === MIN_SCALE) {
          closeImageViewer()
        }
      }
    }
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.0015)
    zoomAt(view.current.scale * factor, { x: event.clientX, y: event.clientY })
  }

  if (!src) {
    return null
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={name || t('close')}
      onClick={closeImageViewer}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClick={(event) => {
          // 点图片本身不关闭；点图片以外的黑色区域关闭（放大时同样有效）
          if (event.target === stageRef.current) {
            closeImageViewer()
          }
          event.stopPropagation()
        }}
      >
        <img
          ref={imageRef}
          className={styles.image}
          src={src}
          alt={name}
          draggable={false}
          onLoad={() => {
            clamp()
            apply()
          }}
        />
      </div>
    </div>
  )
}
