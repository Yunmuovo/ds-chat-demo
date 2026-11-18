import { useEffect } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { closeImageViewer, useImageViewer } from './imageViewerState.js'
import { IconCloseFill14 } from './icons.js'
import styles from './ImageViewer.module.css'

/** 全屏图片预览：点背景或按 Esc 关闭，图片本身不拦截关闭 */
export const ImageViewer = () => {
  const t = useTranslate()
  const src = useImageViewer((state) => state.src)
  const name = useImageViewer((state) => state.name)

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
      <button type="button" className={styles.close} aria-label={t('close')}>
        <IconCloseFill14 />
      </button>
      <img className={styles.image} src={src} alt={name} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
