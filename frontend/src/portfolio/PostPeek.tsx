import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { PostRenderer } from 'post-renderer'
import { supabase } from '../lib/supabaseClient'
import type { PostRow } from '../data/usePublishedPosts'
import { findPage, useModules } from '../data/useModules'
import { toArticleData, toBitesizeData, toCardsData, toLongformData, toMemoData, toReportData } from '../lib/postToRenderer'
import { TagBadges } from '../components/TagBadges'
import type { PortPost } from './blocks'

/**
 * A post's preview card on a port page: the top of the real post, the rest
 * faded out under a "Đọc tiếp" button, Medium-paywall style.
 *
 * A mouse resting on a post for HOVER_MS opens it; a click (and every tap,
 * since touch has no hover) opens it at once and keeps it open until closed.
 */
const HOVER_MS = 3000
/** Grace to cross the gap between the title and the card without it closing. */
const LEAVE_MS = 250
/** Share of the post the card lets a reader see before the fade. */
const SHOWN = 0.3
const CARD_W = 440
const CARD_H = 600
/** Below this the card is centred over a dimmed page instead of beside the post. */
const NARROW = 640

type Peek = { post: PortPost; at: DOMRect; pinned: boolean }

// Bodies are the heaviest column, so they are fetched only when a card is about
// to open, and kept for the visit so a second hover is instant.
const bodies = new Map<string, Promise<PostRow | null>>()
function loadPost(id: string): Promise<PostRow | null> {
  let p = bodies.get(id)
  if (!p) {
    p = Promise.resolve(supabase.from('posts').select('*').eq('id', id).maybeSingle()).then(({ data, error }) => {
      if (error) {
        bodies.delete(id)
        throw error
      }
      return data as PostRow | null
    })
    bodies.set(id, p)
  }
  return p
}

export function usePeek() {
  const [peek, setPeek] = useState<Peek | null>(null)
  const current = useRef<Peek | null>(null)
  current.current = peek
  const opening = useRef<number | undefined>(undefined)
  const closing = useRef<number | undefined>(undefined)

  useEffect(() => () => (clearTimeout(opening.current), clearTimeout(closing.current)), [])

  const leave = () => {
    clearTimeout(opening.current)
    clearTimeout(closing.current)
    closing.current = window.setTimeout(() => setPeek((p) => (p?.pinned ? p : null)), LEAVE_MS)
  }
  const close = () => {
    clearTimeout(opening.current)
    clearTimeout(closing.current)
    setPeek(null)
  }

  const trigger = (post: PortPost) => ({
    onClick: (e: MouseEvent<HTMLElement>) => {
      close()
      setPeek({ post, at: e.currentTarget.getBoundingClientRect(), pinned: true })
    },
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return
      if (current.current?.post.id === post.id) clearTimeout(closing.current)
      void loadPost(post.id).catch(() => {})
      const el = e.currentTarget
      clearTimeout(opening.current)
      opening.current = window.setTimeout(() => {
        clearTimeout(closing.current)
        setPeek((p) => (p?.pinned ? p : { post, at: el.getBoundingClientRect(), pinned: false }))
      }, HOVER_MS)
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') leave()
    },
  })

  const card = {
    onPointerEnter: () => clearTimeout(closing.current),
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') leave()
    },
  }
  return { peek, trigger, card, close }
}

export type PeekTrigger = ReturnType<typeof usePeek>['trigger']

/** Beside the post when there is room, otherwise over it; always inside the window. */
function place(at: DOMRect): CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const h = Math.min(CARD_H, vh - 32)
  if (vw < NARROW) return { left: 16, right: 16, top: (vh - h) / 2, height: h }
  const gap = 12
  const left =
    at.right + gap + CARD_W <= vw - 16 ? at.right + gap : at.left - gap - CARD_W >= 16 ? at.left - gap - CARD_W : (vw - CARD_W) / 2
  const top = Math.min(Math.max(at.top - 16, 16), vh - h - 16)
  return { left, top, width: CARD_W, height: h }
}

export function PostPeek({
  peek,
  vars,
  meta,
  href,
  card,
  onClose,
}: {
  peek: Peek
  vars: CSSProperties
  meta: string
  href: string
  card: ReturnType<typeof usePeek>['card']
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const narrow = window.innerWidth < NARROW

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // A pinned card closes on a click anywhere else, as the old dialog did on its backdrop.
    const onDown = (e: Event) => box.current && !box.current.contains(e.target as Node) && onClose()
    window.addEventListener('keydown', onKey)
    if (peek.pinned) window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [onClose, peek.pinned])

  return createPortal(
    <>
      {narrow && <div className="pf-peek-dim" />}
      <div ref={box} className="pf-peek pf" style={{ ...vars, ...place(peek.at) }} role="dialog" aria-label={peek.post.en} {...card}>
        <div className="head">
          <span className="meta">{meta}</span>
          <TagBadges tags={peek.post.tags ?? []} />
          <button className="close" onClick={onClose} aria-label="đóng">
            ×
          </button>
        </div>
        <PeekBody id={peek.post.id} href={href} />
      </div>
    </>,
    document.body,
  )
}

function PeekBody({ id, href }: { id: string; href: string }) {
  const { data: modules, tagsOf } = useModules()
  const [post, setPost] = useState<PostRow | null | 'error'>(null)
  const view = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ full: 0, view: 0 })

  useEffect(() => {
    let live = true
    setPost(null)
    loadPost(id).then(
      (p) => live && setPost(p ?? 'error'),
      () => live && setPost('error'),
    )
    return () => {
      live = false
    }
  }, [id])

  // Images arrive after the text, so the post keeps growing; the cut follows it.
  useLayoutEffect(() => {
    if (!inner.current || !view.current) return
    const measure = () => setSize({ full: inner.current?.offsetHeight ?? 0, view: view.current?.clientHeight ?? 0 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(inner.current)
    return () => ro.disconnect()
  }, [post])

  if (post === null) return <div className="body note">Đang tải…</div>
  if (post === 'error') return <div className="body note">Không tải được bài.</div>

  // A short post still fills the card; a long one never asks for more than a
  // few screens of scrolling before the fade.
  const cut = Math.min(Math.max(size.full * SHOWN, size.view), size.view * 2.5, size.full)
  const mod = findPage(modules, post.module_id)

  return (
    <div className="body" ref={view}>
      <div className="cut" style={{ height: cut || undefined }}>
        <div className="post" ref={inner}>
          {post.template === 'bitesize' ? (
            <PostRenderer mobile template="bitesize" post={toBitesizeData(post, { mod, tag: tagsOf?.(post.id)[0]?.label })} />
          ) : post.template === 'memo' ? (
            <PostRenderer mobile template="memo" post={toMemoData(post, mod)} />
          ) : post.template === 'longform' ? (
            <PostRenderer mobile template="longform" post={toLongformData(post, mod)} />
          ) : post.template === 'cards' ? (
            <PostRenderer mobile template="cards" post={toCardsData(post, mod)} />
          ) : post.template === 'report' ? (
            <PostRenderer mobile template="report" post={toReportData(post, mod)} />
          ) : (
            <PostRenderer mobile template="article" post={toArticleData(post, mod?.title ?? post.module_id, [], -1, mod)} />
          )}
        </div>
        <div className="fade">
          <a className="more" href={href}>
            Đọc tiếp
          </a>
        </div>
      </div>
    </div>
  )
}
