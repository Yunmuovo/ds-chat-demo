/**
 * 开屏收尾：把开屏 logo 平移到欢迎页 logo 的位置，再整体淡出。
 * 两者位置一致，视觉上就是「重合 → 淡出」，不会出现闪跳。
 */
const SPLASH_ID = 'boot-splash'
const LOGO_ID = 'boot-splash-logo'

const fadeOut = (splash: HTMLElement) => {
  if (!splash.isConnected) {
    return
  }
  splash.classList.add('boot-hide')
  window.setTimeout(() => splash.remove(), 300)
}

export const finishBootSplash = () => {
  const splash = document.getElementById(SPLASH_ID)
  if (!splash) {
    return
  }
  const logo = document.getElementById(LOGO_ID)
  const target = document.querySelector<HTMLElement>('[data-welcome-logo]')
  if (!logo || !target || typeof logo.animate !== 'function') {
    fadeOut(splash)
    return
  }
  const from = logo.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (from.width === 0 || to.width === 0) {
    fadeOut(splash)
    return
  }
  const scale = to.width / from.width
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  // 两者尺寸一致（都是 44px），只需位移 + 等比缩放
  const animation = logo.animate(
    [
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    ],
    { duration: 380, easing: 'cubic-bezier(0.22, 0.68, 0.36, 1)', fill: 'forwards' }
  )
  animation.finished.then(() => fadeOut(splash)).catch(() => fadeOut(splash))
}
