import { create } from 'zustand'

/**
 * 移动端侧边栏抽屉。
 * 拖动过程中不写 React 状态：手势直接改 DOM 的 transform/opacity，
 * 避免每帧重渲染；只有开始拖动和松手吸附时才更新这里的 open/dragging。
 */
type MobileSiderState = {
  open: boolean
  dragging: boolean
}

export const useMobileSider = create<MobileSiderState>(() => ({ open: false, dragging: false }))

/** 抽屉与遮罩的 DOM 引用，供手势代码直接写样式 */
export const drawerEl: { current: HTMLDivElement | null } = { current: null }
export const maskEl: { current: HTMLDivElement | null } = { current: null }

/** 最近一次拖动结束的时间，用来忽略拖动后紧跟的点击 */
let lastDragEnd = 0
export const draggedRecently = () => Date.now() - lastDragEnd < 300

/** 松手后立即标记，避免 touchend 之后紧跟的 click 把刚打开的抽屉关掉 */
export const markDragEnded = () => {
  lastDragEnd = Date.now()
}

export const openMobileSider = () => {
  markDragEnded()
  useMobileSider.setState({ open: true, dragging: false })
}

export const closeMobileSider = () => useMobileSider.setState({ open: false, dragging: false })

export const beginSiderDrag = () => useMobileSider.setState({ dragging: true })

export const endSiderDrag = (open: boolean) => {
  markDragEnded()
  useMobileSider.setState({ open, dragging: false })
}
