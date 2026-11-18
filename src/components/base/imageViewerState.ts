import { create } from 'zustand'

/**
 * 图片预览：blob 链接在移动端的新标签页里打不开，改成页内全屏查看。
 * src 为已加载原件的 objectURL，name 用于无障碍描述。
 */
type ImageViewerState = {
  src: string | null
  name: string
}

export const useImageViewer = create<ImageViewerState>(() => ({ src: null, name: '' }))

export const openImageViewer = (src: string, name = '') =>
  useImageViewer.setState({ src, name })

export const closeImageViewer = () => useImageViewer.setState({ src: null, name: '' })
