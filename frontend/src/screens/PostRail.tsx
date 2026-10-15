import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { useNav, type Nav, type Origin } from '../lib/nav'
import { toPath } from '../lib/routes'
import { openModule } from '../lib/moduleTarget'
import { SITE_CHIPS } from '../components/Byline'
import type { PageRow } from '../data/useModules'
import { sans } from '../design/tokens'

/** The names of biz's and bean's home pages ("strat & ops", "art & culture"), for the way back. */
export type Homes = Partial<Record<'biz' | 'bean', string>>

type Back = { href: string; site: string; home: string; color: string; go?: () => void }

/**
 * Where "Quay lại" leads: the door the post was opened through. A post sits in
 * one store and shows on several homes, so its page cannot lead back to "its"
 * site; it leads back the way the reader came (owner, 2026-10-15).
 */
function backOf(from: Origin, nav: Nav, module: PageRow | undefined, homes: Homes): Back {
  const blog = SITE_CHIPS.blog
  switch (from) {
    case 'biz':
    case 'bean':
      return {
        href: toPath({ area: 'public', screen: 'portfolioPage', site: from }),
        site: SITE_CHIPS[from].name,
        home: homes[from] ?? 'Trang chủ',
        color: SITE_CHIPS[from].color,
      }
    case 'blog':
      return { href: toPath({ area: 'public', screen: 'landing' }), site: blog.name, home: 'Trang chủ', color: blog.color, go: nav.goLanding }
    case 'admin':
      return { href: toPath({ area: 'admin', screen: 'cms', tab: 'posts' }), site: 'Nội dung', home: 'Danh sách bài', color: blog.color, go: () => nav.goCms('posts') }
    case 'archive':
      return { href: toPath({ area: 'admin', screen: 'archive' }), site: 'Nội dung', home: 'Lưu trữ', color: blog.color, go: nav.goArchive }
    default:
      // Through moduleTarget: Ghi 01 and Ghi 02 have their own screens.
      return module
        ? { href: toPath({ area: 'public', screen: 'module', moduleId: module.id }), site: blog.name, home: module.title, color: blog.color, go: () => openModule(nav, module) }
        : { href: toPath({ area: 'public', screen: 'landing' }), site: blog.name, home: 'Trang chủ', color: blog.color, go: nav.goLanding }
  }
}

type Head = { id: string; text: string }

/**
 * The post page's left rail (mock "B + cột trái của C"): the way back, then
 * the post's own headings. On a phone the rail gives way to one back link
 * above the post.
 */
export function PostRail({
  from,
  module,
  homes = {},
  mobile,
  children,
}: {
  from: Origin
  module: PageRow | undefined
  homes?: Homes
  mobile: boolean
  children: ReactNode
}) {
  const nav = useNav()
  const back = backOf(from, nav, module, homes)
  const body = useRef<HTMLDivElement>(null)
  const [heads, setHeads] = useState<Head[]>([])
  const [on, setOn] = useState<string | null>(null)

  // The headings are read off the rendered post rather than its data: six
  // templates store sections six ways, but all of them draw h2/h3. The rail is
  // keyed by post, so reading once on mount is enough.
  useEffect(() => {
    const els = Array.from(body.current?.querySelectorAll<HTMLElement>('h2, h3') ?? []).filter((el) => el.textContent?.trim())
    els.forEach((el, i) => {
      if (!el.id) el.id = `muc-${i + 1}`
    })
    setHeads(els.map((el) => ({ id: el.id, text: el.textContent!.trim() })))
    if (!els.length) return
    const spot = () => {
      let at: string | null = null
      for (const el of els) if (el.getBoundingClientRect().top < 120) at = el.id
      setOn(at)
    }
    spot()
    window.addEventListener('scroll', spot, { passive: true })
    return () => window.removeEventListener('scroll', spot)
  }, [])

  const goBack = (e: MouseEvent) => {
    if (!back.go || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    back.go()
  }
  const jump = (id: string) => (e: MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (mobile)
    return (
      <div>
        <a href={back.href} onClick={goBack} style={{ ...backLine, padding: '12px 16px' }}>
          <i style={{ ...dot, background: back.color }} />← Quay lại <b style={{ fontWeight: 500, color: 'var(--ink)' }}>{back.site}</b>
        </a>
        {children}
      </div>
    )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', columnGap: 32, padding: '0 0 0 32px' }}>
      <aside aria-label="Trong bài này" style={rail}>
        <a href={back.href} onClick={goBack} style={{ ...backBlock, borderLeftColor: back.color }}>
          <small style={{ fontSize: 12 }}>← Quay lại</small>
          <b style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{back.site}</b>
          <small style={{ fontSize: 12 }}>{back.home}</small>
        </a>
        {heads.length > 0 && (
          <>
            <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Trong bài này</span>
            {heads.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                onClick={jump(h.id)}
                aria-current={on === h.id ? 'location' : undefined}
                style={{ ...tocLink, color: on === h.id ? 'var(--ink)' : 'var(--ink-2)', borderLeftColor: on === h.id ? back.color : LINE }}
              >
                {h.text}
              </a>
            ))}
          </>
        )}
      </aside>
      <div ref={body} style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}

const LINE = 'rgba(127,127,127,.3)'

const rail: CSSProperties = {
  position: 'sticky',
  top: 24,
  alignSelf: 'start',
  maxHeight: 'calc(100vh - 48px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '32px 0',
  fontFamily: sans,
  fontSize: 13,
  lineHeight: 1.45,
}

const backBlock: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  marginBottom: 14,
  paddingLeft: 12,
  borderLeft: '2px solid',
  color: 'var(--ink-2)',
  textDecoration: 'none',
}

const tocLink: CSSProperties = { borderLeft: '2px solid', paddingLeft: 10, textDecoration: 'none' }

const backLine: CSSProperties = { fontFamily: sans, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none' }

const dot: CSSProperties = { width: 8, height: 8, borderRadius: 999 }
