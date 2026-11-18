import { useState } from 'react'
import logoMark from '../../assets/logo-mark.png'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './Welcome.module.css'

/** 欢迎语候选：每次进入新对话随机一条，避免每次都是同一句 */
const GREETINGS = [
  'welcomeMessageChat250808',
  'welcomeGreeting2',
  'welcomeGreeting3',
  'welcomeGreeting4',
  'welcomeGreeting5',
] as const

/** 新对话：问候语 + 输入框。桌面端居中；移动端输入框吸底 */
export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.welcome}>
        <div className={styles.hero}>
          <img className={styles.logoMark} src={logoMark} alt='' data-welcome-logo />
          <div className={styles.greeting}>{t(greeting)}</div>
        </div>
        <ChatInput sessionId={null} />
        {isMobile ? <div className={styles.caveat}>{t('contentCaveat')}</div> : null}
      </div>
    </div>
  )
}
