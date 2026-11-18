import clsx from 'clsx'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCloseOutline16,
  IconPanelLeftOutline16,
  IconPinOutline16,
  IconSearchOutline16,
  IconSettingsOutline16,
  IconTrashOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import {
  newChat,
  removeSession,
  setSessionPinned,
  useChatStore,
} from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, draggedRecently, drawerEl, maskEl, useMobileSider } from './mobileSiderState.js'
import logoMark from '../../assets/logo-mark.png'
import { SessionItem } from './SessionItem.js'
import styles from './Sider.module.css'

/** 展开的侧边栏：名称与收起按钮、开启新对话、按时间分组的会话列表、底部设置；移动端放在抽屉里，收起按钮关闭抽屉 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const [now, setNow] = useState(Date.now)
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteMany, setDeleteMany] = useState(false)
  const [deleteManyPending, setDeleteManyPending] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return sessions
    }
    return sessions.filter((session) =>
      (session.title || t('untitledChat')).toLowerCase().includes(q)
    )
  }, [sessions, query, t])
  const groups = useMemo(() => groupSessions(filtered, now, t), [filtered, now, t])

  const enterSelect = useCallback((id: string) => {
    setSelecting(true)
    setSelected((prev) => new Set(prev).add(id))
  }, [])

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const ids = filtered.map((session) => session.id)
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        for (const id of ids) {
          next.delete(id)
        }
        return next
      }
      return new Set([...prev, ...ids])
    })
  }, [filtered])

  const cancelSelecting = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selected.has(session.id)),
    [sessions, selected]
  )
  const allPinned =
    selectedSessions.length > 0 && selectedSessions.every((session) => session.pinned)

  const pinSelected = useCallback(() => {
    if (selected.size === 0) {
      return
    }
    const target = !allPinned
    for (const id of selected) {
      setSessionPinned(id, target)
    }
    showToast(target ? t('sessionPinDone', { count: selected.size }) : t('sessionUnpinDone', { count: selected.size }))
    setSelecting(false)
    setSelected(new Set())
  }, [selected, allPinned, t])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile)}>
      {selecting ? (
        <div className={styles.selectHeader}>
          <span className={styles.selectTitle}>
            {t('sessionSelectedCount', { count: selected.size })}
          </span>
          <button type="button" className={styles.selectHeaderAction} onClick={toggleSelectAll}>
            {t('sessionSelectAll')}
          </button>
          <IconButton
            size="m"
            icon={<IconCloseOutline16 />}
            aria-label={t('close')}
            onClick={cancelSelecting}
          />
        </div>
      ) : (
        <div className={styles.top}>
          <div className={styles.brand}>
            <img className={styles.logoMark} src={logoMark} alt='' />
            <div className={styles.appName}>{t('appName')}</div>
          </div>
          <IconButton
            size="m"
            icon={<IconPanelLeftOutline16 />}
            tooltip={t('collapseSiderbarButton')}
            tooltipPlacement="bottom"
            onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
          />
        </div>
      )}
      {selecting ? null : (
        <>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>
          <IconSearchOutline16 />
        </span>
        <input
          ref={searchRef}
          className={styles.search}
          type="search"
          placeholder={t('sessionSearchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button
            type="button"
            className={styles.searchClear}
            aria-label={t('close')}
            onClick={() => {
              setQuery('')
              searchRef.current?.focus()
            }}
          >
            <IconCloseOutline16 />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className={styles.newChat}
        onClick={() => {
          newChat()
          closeMobileSider()
        }}
      >
        <span className={styles.newChatIcon}>
          <NewChatIcon />
        </span>
        {t('newChat')}
      </button>
        </>
      )}
      <div className={styles.listWrap}>
        <div className={styles.list}>
          {groups.length === 0 ? (
            <div className={styles.empty}>{t('sessionSearchEmpty')}</div>
          ) : (
            groups.map((group) => (
              <div key={group.key} className={styles.section}>
                <div className={styles.sectionHeader}>{group.label}</div>
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={session.id === activeId}
                    selecting={selecting}
                    checked={selected.has(session.id)}
                    onDelete={() => setDeleting(session)}
                    onToggle={() => toggleSelected(session.id)}
                    onEnterSelect={() => enterSelect(session.id)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      <div className={styles.bottom}>
        {selecting ? (
          <div className={styles.selectBar}>
            <button
              type="button"
              className={styles.selectBarAction}
              disabled={selected.size === 0}
              onClick={pinSelected}
            >
              <IconPinOutline16 />
              {allPinned ? t('sessionItemMenuUnpinOption') : t('sessionItemMenuPinOption')}
            </button>
            <span className={styles.selectDivider} />
            <button
              type="button"
              className={clsx(styles.selectBarAction, styles.selectBarActionDanger)}
              disabled={selected.size === 0}
              onClick={() => setDeleteMany(true)}
            >
              <IconTrashOutline16 />
              {t('delete')}
            </button>
          </div>
        ) : (
          <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
            <span className={styles.settingsIcon}>
              <IconSettingsOutline16 />
            </span>
            <span className={styles.settingsLabel}>{t('settings')}</span>
          </button>
        )}
      </div>
      {deleteMany ? (
        <Modal
          title={t('sessionDeleteSelectedTitle')}
          onClose={() => {
            if (!deleteManyPending) {
              setDeleteMany(false)
            }
          }}
          footer={
            <>
              <Button
                variant="outlined"
                disabled={deleteManyPending}
                onClick={() => setDeleteMany(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deleteManyPending}
                onClick={async () => {
                  setDeleteManyPending(true)
                  try {
                    let ok = true
                    for (const id of selected) {
                      if (!(await removeSession(id))) {
                        ok = false
                      }
                    }
                    if (ok) {
                      setDeleteMany(false)
                      setSelected(new Set())
                      setSelecting(false)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeleteManyPending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('sessionDeleteSelectedDescription', { count: selected.size })}
        </Modal>
      ) : null}
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
/** 抽屉内容单独缓存：拖动时只动 DOM，列表不参与重渲染 */
const DrawerContent = memo(function DrawerContent() {
  return <Sider mobile />
})

const DRAWER_TRANSITION = 'transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1)'
const MASK_TRANSITION = 'opacity 140ms ease'

export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  const dragging = useMobileSider((state) => state.dragging)
  const active = open || dragging
  const [render, setRender] = useState(active)

  useEffect(() => {
    if (active) {
      setRender(true)
      return
    }
    // 收起时等过渡结束再卸载
    const timer = window.setTimeout(() => setRender(false), 150)
    return () => window.clearTimeout(timer)
  }, [active])

  // 非拖动状态：把抽屉放到开/关的终点（拖动时的位置由手势直接写）
  useEffect(() => {
    if (!render || dragging) {
      return
    }
    const drawer = drawerEl.current
    const mask = maskEl.current
    if (drawer) {
      drawer.style.transition = DRAWER_TRANSITION
      drawer.style.transform = open ? 'translateX(0)' : 'translateX(-100%)'
    }
    if (mask) {
      mask.style.transition = MASK_TRANSITION
      mask.style.opacity = open ? '1' : '0'
    }
  }, [render, open, dragging])

  const setDrawer = useCallback((el: HTMLDivElement | null) => {
    drawerEl.current = el
    if (el) {
      el.style.transform = 'translateX(-100%)'
    }
  }, [])

  const setMask = useCallback((el: HTMLDivElement | null) => {
    maskEl.current = el
    if (el) {
      el.style.opacity = '0'
    }
  }, [])

  if (!active && !render) {
    return null
  }
  return (
    <>
      <div
        ref={setMask}
        className={styles.drawerMask}
        onClick={() => {
          if (!draggedRecently()) {
            closeMobileSider()
          }
        }}
      />
      <div ref={setDrawer} className={styles.drawer}>
        <DrawerContent />
      </div>
    </>
  )
}
