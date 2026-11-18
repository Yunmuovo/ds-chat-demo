/**
 * 开屏收尾（原位淡入 + 呼吸停留）：
 * 1. 等欢迎页渲染好，量出它 logo 的真实位置
 * 2. 把开屏 logo 直接放到同一个位置（不做位移动画，避免「滑过去」的观感）
 * 3. 淡入 + 轻微呼吸停留后，整层淡出
 */
const SPLASH_ID = 'boot-splash'
const LOGO_ID = 'boot-splash-logo'
/** 呼吸动画 0.9s；留一点余量再淡出 */
const HOLD_MS = 900

const fadeOut = (splash: HTMLElement) => {
  if (!splash.isConnected) {
    return
  }
  splash.classList.add('boot-hide')
  window.setTimeout(() => splash.remove(), 320)
}

export const finishBootSplash = () => {
  const splash = document.getElementById(SPLASH_ID)
  if (!splash) {
    return
  }
  const logo = document.getElementById(LOGO_ID)
  const target = document.querySelector<HTMLElement>('[data-welcome-logo]')
  if (!logo || !target) {
    // 打开的是已有对话，没有欢迎页 logo：直接淡出
    fadeOut(splash)
    return
  }
  const from = logo.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (from.width === 0 || to.width === 0) {
    fadeOut(splash)
    return
  }
  // 直接落到目标位置（无过渡）
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  logo.style.transform = `translate(${dx}px, ${dy}px)`
  if (to.width !== from.width) {
    logo.style.width = `${to.width}px`
    logo.style.height = `${to.height}px`
  }
  // 下一帧再淡入，确保浏览器已应用上面的定位
  requestAnimationFrame(() => {
    logo.classList.add('boot-visible')
    window.setTimeout(() => fadeOut(splash), HOLD_MS)
  })
}
