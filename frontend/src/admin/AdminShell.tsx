import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react'
import { useNav } from '../lib/nav'
import { useAuth } from '../lib/auth'
import { goToArea } from '../lib/area'
import { useIsMobile } from '../lib/useIsMobile'
import { sans, serif } from '../design/tokens'
import { useRememberedTab } from './components/SiteTabs'

/** The four sites Cấu hình edits, in the order the sidebar lists them. */
export const CONFIG_SITES = ['root', 'biz', 'bean', 'blog'] as const
export type ConfigSite = (typeof CONFIG_SITES)[number]
export const CONFIG_SITE_LABELS: Record<ConfigSite, string> = { root: 'beanweirdo', biz: 'biz', bean: 'bean', blog: 'personal blog' }

/**
 * The admin's colours, in one place so a palette is one edit (owner picked
 * frame B, a Notion sidebar, 2026-10-15). `on` is a picked row in the sidebar.
 */
const SHELL = {
  side: '#23262B',
  sideInk: '#ECEAE3',
  sideMuted: '#9A9C9F',
  sideOn: '#363A41',
  sideHover: '#2D3036',
  accent: '#7FB08A',
  main: '#FBFAF7',
  line: '#E3DFD3',
  ink: '#23211A',
  muted: '#8C8674',
} as const

type Frame = {
  site: ConfigSite
  openSite: (s: ConfigSite) => void
  /** Where Cấu hình draws the open site's cards, under that site in the sidebar. */
  slot: HTMLElement | null
}

const FrameContext = createContext<Frame | null>(null)

export function useAdminFrame(): Frame {
  const f = useContext(FrameContext)
  if (!f) throw new Error('useAdminFrame outside AdminShell')
  return f
}

const SIDE_W = 248

/**
 * The back office's one frame: a sidebar holding every place to work
 * (Nội dung, the four sites of Cấu hình with the open one's cards, Cài đặt
 * hiển thị), and the work itself on the right. It replaces the public site's
 * rail and the old blue "Content" band.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const nav = useNav()
  const mobile = useIsMobile()
  const { signOut } = useAuth()
  const [site, setSite] = useRememberedTab('beanweirdo.config.tab', CONFIG_SITES)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const tab = nav.cmsTab
  const config = tab === 'pages' || tab === 'authors'
  const openSite = (s: ConfigSite) => {
    setSite(s)
    if (!config) nav.goCms('pages')
  }
  const where = tab === 'posts' ? 'Nội dung' : tab === 'display' ? 'Cài đặt hiển thị' : `Cấu hình › ${CONFIG_SITE_LABELS[site]}`

  const side = (
    <aside
      aria-label="Quản trị"
      style={{
        background: SHELL.side,
        color: SHELL.sideInk,
        fontFamily: sans,
        fontSize: 13.5,
        fontWeight: 400,
        padding: '18px 12px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...(mobile ? {} : { position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }),
      }}
    >
      <a href="/" style={{ fontFamily: serif, fontSize: 20, color: SHELL.sideInk, textDecoration: 'none', padding: '2px 10px 16px' }}>
        bæn. <span style={{ fontFamily: sans, fontSize: 13, color: SHELL.sideMuted }}>quản trị</span>
      </a>
      <Item on={tab === 'posts'} onClick={() => nav.goCms('posts')}>
        Nội dung
      </Item>

      <Heading>Cấu hình</Heading>
      {CONFIG_SITES.map((s) => {
        const open = config && s === site
        return (
          <div key={s}>
            {/* Open, the site lights none of itself: the card picked under it does. */}
            <Item onClick={() => openSite(s)}>
              <span aria-hidden style={{ width: 10, color: SHELL.sideMuted }}>{open ? '▾' : '▸'}</span>
              <span style={{ fontWeight: open ? 500 : 400 }}>{CONFIG_SITE_LABELS[s]}</span>
            </Item>
            {open && <div ref={setSlot} />}
          </div>
        )
      })}

      <Heading>Hiển thị</Heading>
      <Item on={tab === 'display'} onClick={() => nav.goCms('display')}>
        Cài đặt hiển thị
      </Item>

      <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Item onClick={() => goToArea('practice', 'hours')}>Mở nhật ký Ghi 02 ↗</Item>
        <Item
          onClick={() => {
            signOut()
            goToArea('public')
          }}
        >
          Đăng xuất
        </Item>
      </div>
    </aside>
  )

  return (
    <FrameContext.Provider value={{ site, openSite, slot }}>
      <div style={mobile ? undefined : { display: 'grid', gridTemplateColumns: `${SIDE_W}px minmax(0, 1fr)`, minHeight: '100vh' }}>
        {side}
        <main style={{ background: SHELL.main, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 28px', fontFamily: sans, fontSize: 12.5, color: SHELL.muted }}>
            <span>Quản trị › {where}</span>
            <a href="/" target="_blank" rel="noreferrer" style={{ color: SHELL.muted }}>
              Xem site ↗
            </a>
          </div>
          {children}
        </main>
      </div>
    </FrameContext.Provider>
  )
}

/** A row of the sidebar. Cấu hình's cards use it too, so every row in it looks alike. */
export function Item({ on = false, onClick, depth = 0, children, ...rest }: { on?: boolean; onClick: () => void; depth?: number; children: ReactNode } & Record<`data-${string}`, string>) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      {...rest}
      aria-current={on || undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...row,
        paddingLeft: 10 + depth * 18,
        background: on ? SHELL.sideOn : hover ? SHELL.sideHover : 'transparent',
        boxShadow: on ? `inset 2px 0 0 ${SHELL.accent}` : 'none',
        fontWeight: on ? 500 : 400,
      }}
    >
      {children}
    </button>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: SHELL.sideMuted, margin: '16px 10px 4px' }}>{children}</div>
}

const row: CSSProperties = {
  all: 'unset',
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  color: SHELL.sideInk,
  fontFamily: sans,
  fontSize: 13.5,
  lineHeight: 1.35,
}
