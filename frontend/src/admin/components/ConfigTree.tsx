import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  createKeyword,
  createPage,
  createTopic,
  deletePortPage,
  getLayout,
  listKeywords,
  listTags,
  listTopics,
  renameKeyword,
  reorderTopics,
  updateSite,
  updateTopic,
  type Module,
} from '../lib/apiClient'
import { ancestorsOf, buildTree, flattenTree } from '../../lib/contentTree'
import { planMove, type DropWhere } from '../../lib/treeMove'
import { bySiteOrder } from '../../lib/moduleOrder'
import { activeWords } from '../../lib/routeWords'
import { TAG_PAGE, toPath } from '../../lib/routes'
import { findPage, useModules } from '../../data/useModules'
import { usePortSources } from '../../portfolio/data'
import { navLinks, type PortContent } from '../../portfolio/content'
import type { PresetKey } from '../../portfolio/blocks'
import { ink, paper, sans, serif } from '../../design/tokens'
import { radius } from '../../design/controls'
import { FlatSettings, TopicSettings } from './ContentWorkspace'
import { Builder, ContentTab, createFromPreset, usePortAdmin, useSplit, type PortPart } from './PortEditors'
import { ScaledPreview, useWidth } from './ScaledPreview'
import { SiteTabs, useRememberedTab } from './SiteTabs'
import {
  describePage,
  NavFlags,
  NodePage,
  PageEditor,
  PORT_PARTS,
  type BlogSelected,
  type Layout,
  type SystemPage,
  type Vocab,
} from './PageSettings'

/**
 * Cấu hình — every page of the site and every setting behind it, in one tree.
 *
 * Until 2026-10-08 there were two tabs for this, Quản lý trang and Cấu hình,
 * and the topic tree was in both (and in Nội dung): clicking "roasting"
 * opened its listing rule in one, its name and colour in the other. The owner
 * could not tell what a click acted on. They kept this tab's look and asked
 * for three things, which are the rules of the screen:
 *
 * - the tree only picks. Nothing is typed or saved on the left; a click on a
 *   card or a row opens it on the right, and that is all a click does.
 *   Folding is its own arrow, dragging is its own grip;
 * - everything about one thing sits together on the right — a topic's name,
 *   colour and place in the tree beside the page it gets;
 * - the public page is always previewed beside the fields.
 *
 * Later the same day the owner asked for one order and nothing without a
 * page: Mục lục and the topic tree are one card (Mục lục draws the tree), the
 * Điều hướng screen went (the sidebar follows the tree; its two switches sit
 * on each page), and so did Mẫu and Lưu trữ, which had nothing to see.
 *
 * On 2026-10-13 the owner asked for the sites to stop sharing one scroll and
 * to look and act alike: a tab per site, and every site built from the same
 * `SiteSpec` — a home card, a Mục lục whose order is the site's navigation
 * and which drags the same way, other pages, and Phần chung. A new site is a
 * new spec, not new tree code.
 */

type Group = 'port-pages' | 'port-parts' | 'topics' | 'tags' | 'curated' | 'modules'

const SITES = ['blog', 'port', 'practice'] as const
type SiteId = (typeof SITES)[number]
const SITE_LABELS: Record<SiteId, string> = { blog: 'Personal Blog', port: 'Port', practice: 'Practice' }

type Picked =
  | BlogSelected
  | { kind: 'group'; id: Group }
  | { kind: 'port-part'; part: PortPart }
  | { kind: 'port-page'; id: string }
  | { kind: 'topic'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'module'; id: string }
  | { kind: 'practice' }

const same = (a: Picked, b: Picked) => JSON.stringify(a) === JSON.stringify(b)

/** One gap per level, and the guide line sits in it — as the old module tree drew it. */
const INDENT = 16

const posts = (n: number) => `${n} bài`

/** A row of the tree that the arrow keys walk: every card and every leaf carries it. */
const ROW = 'data-cfg-row'

function FoldButton({ name, open, onToggle }: { name: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${open ? 'Gập' : 'Mở'} ${name}`}
      aria-expanded={open}
      tabIndex={-1}
      onClick={onToggle}
      style={{ all: 'unset', width: 22, textAlign: 'center', fontSize: 10, color: ink.muted, cursor: 'pointer', flex: 'none' }}
    >
      {open ? '▾' : '▸'}
    </button>
  )
}

function Card({ title, note, on, fold, onClick }: { title: string; note: string; on: boolean; fold?: { open: boolean; toggle: () => void }; onClick: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        background: on ? paper.hover : paper.white,
        border: `1px solid ${on ? ink.border : paper.rule}`,
        borderRadius: radius,
      }}
    >
      <button
        type="button"
        {...{ [ROW]: '' }}
        data-fold={fold ? (fold.open ? 'open' : 'closed') : undefined}
        aria-current={on || undefined}
        onClick={onClick}
        onKeyDown={(e) => fold && foldKey(e, fold)}
        style={{ all: 'unset', flex: 1, minWidth: 0, padding: '12px 14px 13px', cursor: 'pointer' }}
      >
        <div style={{ fontFamily: serif, fontSize: 17, lineHeight: 1.15, letterSpacing: '-.02em', color: ink.base }}>{title}</div>
        <div style={{ fontFamily: sans, fontWeight: 300, fontSize: 11.5, lineHeight: 1.4, color: ink.muted, marginTop: 5 }}>{note}</div>
      </button>
      {fold && (
        <div style={{ padding: '12px 6px 0 0' }}>
          <FoldButton name={title} open={fold.open} onToggle={fold.toggle} />
        </div>
      )}
    </div>
  )
}

/** ← folds and → opens the row in focus; ↑↓ are handled once, by the tree. */
function foldKey(e: KeyboardEvent, fold: { open: boolean; toggle: () => void }) {
  if ((e.key === 'ArrowLeft' && fold.open) || (e.key === 'ArrowRight' && !fold.open)) {
    e.preventDefault()
    fold.toggle()
  }
}

type DragProps = {
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  dragging: boolean
  mark: DropWhere | null
}

/**
 * Which part of the row the pointer is on: the top quarter and the bottom
 * quarter mean "beside", the middle half means "inside" — the wider target,
 * because filing something inside is the move this tree exists for. A broken
 * measurement answers "before", never "inside", since inside changes the
 * node's parent and with it every post address under it.
 */
function whereIn(e: { clientY: number; currentTarget: HTMLElement }, nest: boolean): DropWhere {
  const box = e.currentTarget.getBoundingClientRect()
  const part = (e.clientY - box.top) / box.height
  // A flat list has no inside: each half of the row is a side.
  if (!nest) return Number.isFinite(part) && part >= 0.5 ? 'after' : 'before'
  if (!Number.isFinite(part) || part < 0.25) return 'before'
  if (part > 0.75) return 'after'
  return 'inside'
}

const WHERE_WORDS: Record<DropWhere, string> = { before: 'trước', after: 'sau', inside: 'vào trong' }

function Leaf({
  name,
  depth,
  on,
  dot,
  meta,
  fold,
  drag,
  onClick,
}: {
  name: string
  depth: number
  on: boolean
  dot?: string | null
  meta?: string
  /** Present on a row that has children: whether they are shown, and the toggle. */
  fold?: { open: boolean; toggle: () => void }
  /** Present on a row that can be dragged and dropped on. */
  drag?: DragProps
  onClick: () => void
}) {
  const mark = drag?.mark
  return (
    <div
      className="cfg-leaf"
      onDragOver={drag?.onDragOver}
      onDragLeave={drag?.onDragLeave}
      onDrop={drag?.onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        marginLeft: depth * INDENT,
        borderLeft: `1px solid ${paper.rule}`,
        // Where the drop will land: a line above or below, or the whole row lit for "inside".
        boxShadow: mark === 'before' ? `inset 0 2px 0 ${ink.green}` : mark === 'after' ? `inset 0 -2px 0 ${ink.green}` : 'none',
        outline: mark === 'inside' ? `2px solid ${ink.green}` : 'none',
        outlineOffset: -2,
        borderRadius: mark === 'inside' ? radius : 0,
        opacity: drag?.dragging ? 0.45 : 1,
      }}
    >
      {fold ? <FoldButton name={name} open={fold.open} onToggle={fold.toggle} /> : <span style={{ width: 22, flex: 'none' }} />}
      <button
        type="button"
        {...{ [ROW]: '' }}
        data-fold={fold ? (fold.open ? 'open' : 'closed') : undefined}
        aria-current={on || undefined}
        onClick={onClick}
        onKeyDown={(e) => fold && foldKey(e, fold)}
        style={{
          all: 'unset',
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderRadius: radius,
          cursor: 'pointer',
          background: on ? paper.hover : 'transparent',
          boxShadow: on ? `inset 0 0 0 1px ${ink.border}` : 'none',
          fontFamily: sans,
          fontSize: 13,
          color: ink.base,
        }}
      >
        {dot !== undefined && (
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', boxSizing: 'border-box', background: dot ?? 'transparent', border: dot ? 'none' : `1.5px solid ${paper.rule}` }} />
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: on ? 500 : 400 }}>{name}</span>
        {/* While something is held over the row, its count gives way to where the drop will land. */}
        {mark ? (
          <span style={{ fontSize: 11, color: ink.green, whiteSpace: 'nowrap' }}>
            {WHERE_WORDS[mark]} {name}
          </span>
        ) : (
          meta && <span style={{ fontSize: 11, color: ink.faint, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{meta}</span>
        )}
      </button>
      {drag && (
        // Only the grip starts a drag, so a click that slips never moves a node.
        <span
          className="cfg-grip"
          draggable
          role="img"
          aria-label={`Kéo ${name}`}
          title={`Kéo ${name}`}
          onDragStart={drag.onDragStart}
          onDragEnd={drag.onDragEnd}
          style={{ flex: 'none', width: 18, textAlign: 'center', color: ink.faint, fontSize: 11, cursor: 'grab', userSelect: 'none' }}
        >
          ⋮⋮
        </span>
      )}
    </div>
  )
}

/** A name to type and an explicit button — creating something never happens on blur. */
function AddField({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('')
  const go = () => {
    const t = v.trim()
    if (!t) return
    setV('')
    onAdd(t)
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 18px' }}>
      <input
        aria-label={label}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        style={{ flex: 1, maxWidth: 320, boxSizing: 'border-box', border: `1px solid ${ink.border}`, borderRadius: radius, background: paper.white, fontFamily: sans, fontSize: 13, padding: '6px 10px', outline: 'none' }}
      />
      <button
        type="button"
        onClick={go}
        disabled={!v.trim()}
        style={{ border: `1px solid ${ink.border}`, borderRadius: radius, background: paper.white, fontFamily: sans, fontSize: 12.5, padding: '6px 12px', cursor: v.trim() ? 'pointer' : 'default', color: v.trim() ? ink.base : ink.faint }}
      >
        {label}
      </button>
    </div>
  )
}

const sectionHead = { fontFamily: sans, fontSize: 10.5, fontWeight: 500, letterSpacing: '.2em', textTransform: 'uppercase', color: ink.muted, borderBottom: `2px solid ${ink.base}`, paddingBottom: 9, margin: '30px 0 12px' } as const
const hint = { fontFamily: sans, fontSize: 13, lineHeight: 1.55, color: ink.muted, margin: '6px 0 14px', maxWidth: 520 } as const

type MovePlan = Exclude<ReturnType<typeof planMove>, { error: string }>

/** One row of a site's Mục lục; `parent_id` is null on a flat list. */
type TocItem = { id: string; parent_id: string | null; name: string; dot?: string | null; meta?: string; picked: Picked; movable: boolean }

/** A card under the home card, and the rows it folds over. */
type GroupSpec = { id: Group; title: string; note: string; rows?: ReactNode }

/**
 * What a site of the Cấu hình tab is made of — the one shape every site fills
 * in, so the blog and the port read and act alike (the owner's ask of
 * 2026-10-13: same names, same cards, same drag). Each part is optional; a
 * site draws only what it has, never an empty card for symmetry's sake.
 */
type SiteSpec = {
  id: SiteId
  path: string
  home: { title: string; note: string; picked: Picked }
  /**
   * Mục lục: the site's pages in the order its navigation shows them. `move`
   * draws a drop at once and hands back the save and its undo; `nest` says
   * whether a row can be dropped inside another.
   */
  toc?: GroupSpec & { items: TocItem[]; nest: boolean; move: (id: string, plan: MovePlan) => { apply: () => Promise<unknown>; revert: () => Promise<unknown> } }
  /** Pages outside the navigation order, each kind its own card. */
  pages?: GroupSpec[]
  /** Phần chung: what every page of the site shares or borrows. */
  shared?: GroupSpec
}

export function ConfigTree({
  modules,
  renderCopy,
  renderModule,
  renderPractice,
}: {
  modules: Module[]
  /** The fixed copy of a page the site draws with a screen of its own. */
  renderCopy: (key: SystemPage) => ReactNode
  /** The fields of a module a page still takes its looks from. */
  renderModule: (moduleId: string) => ReactNode
  /** Practice's own settings — its name and colour live in site settings, not in the blog's pages. */
  renderPractice: () => ReactNode
}) {
  const { data: pages, postsOf, reload: reloadPages } = useModules()
  const port = usePortAdmin()
  const src = usePortSources()
  const [layout, setLayout] = useState<Layout | null>(null)
  const [vocab, setVocab] = useState<Vocab>({ topics: [], keywords: [], kinds: [] })
  const [site, setSiteTab] = useRememberedTab('beanweirdo.config.site', SITES)
  const homeOf = (id: SiteId): Picked => (id === 'blog' ? { kind: 'system', key: 'landing' } : id === 'port' ? { kind: 'port-part', part: 'home' } : { kind: 'practice' })
  const [picked, setPicked] = useState<Picked>(() => homeOf(site))
  const openSite = (id: SiteId) => {
    setSiteTab(id)
    setPicked(homeOf(id))
    setDragging(null)
    setDropAt(null)
  }
  const [err, setErr] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [portRound, setPortRound] = useState(0)
  const [undo, setUndo] = useState<{ msg: string; saving: boolean; revert: () => Promise<unknown> } | null>(null)
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setFolded((f) => {
      const next = new Set(f)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const fold = (id: string) => ({ open: !folded.has(id), toggle: () => toggle(id) })

  // Both dividers drag, and each width is remembered: the tree for long names, the fields for long forms.
  const treeSplit = useSplit('cfg-tree', 264, 'left', 200, 520)
  const split = useSplit('cfg-v1', 520, 'left', 360, 900)
  const [root, width] = useWidth<HTMLDivElement>()
  // Wide: tree, fields, preview side by side. Narrower: the preview goes under the fields. Phone: one column.
  const columns = width === 0 || width >= 1180 ? 3 : width >= 860 ? 2 : 1
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const editor = useRef<HTMLDivElement>(null)
  // Side by side, the fields scroll on their own; stacked, a pick far down the
  // tree would open its fields out of sight, so bring them into view.
  useEffect(() => {
    const top = editor.current?.getBoundingClientRect().top ?? 0
    if (columns < 3 && (top < 0 || top > window.innerHeight - 80)) editor.current?.scrollIntoView?.({ block: 'start' })
  }, [picked]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Fixed port copy autosaves after typing rests; reload its preview after that, not per keystroke.
    const t = setTimeout(() => setPortRound((r) => r + 1), 1200)
    return () => clearTimeout(t)
  }, [port.content])

  const loadLayout = () => getLayout().then(setLayout)
  const loadVocab = () => Promise.all([listTopics(), listKeywords(), listTags()]).then(([topics, keywords, kinds]) => setVocab({ topics, keywords, kinds }))
  useEffect(() => {
    loadLayout().catch((e: Error) => setErr(e.message))
    loadVocab().catch((e: Error) => setErr(e.message))
  }, [])

  /** Every write: save, then read everything the tree and the preview draw from again. */
  const run = (fn: () => Promise<unknown>) =>
    void fn()
      .then(() => setErr(null))
      .catch((e: Error) => setErr(e.message))
      .finally(() => {
        void loadLayout().catch(() => {})
        void loadVocab().catch(() => {})
        reloadPages()
        setRound((r) => r + 1)
      })

  // ── the Mục lục drag, the same for every site ──────────────────────
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; where: DropWhere } | null>(null)
  const sorted = [...vocab.topics].sort((a, b) => a.sort_order - b.sort_order)
  const topicTree = buildTree(sorted)
  // The order the topic tree is drawn in, which `planMove` keeps for everything it does not move.
  const shownTopics = flattenTree(topicTree).map((n) => n.row)

  /** Draws a topic move before the server has it; the reload after the save replaces this with what was stored. */
  function placeLocally(id: string, parentId: string | null, order: string[]) {
    setVocab((v) => ({
      ...v,
      topics: v.topics.map((t) => {
        const at = order.indexOf(t.id)
        return { ...t, ...(at >= 0 ? { sort_order: at + 1 } : {}), ...(t.id === id ? { parent_id: parentId } : {}) }
      }),
    }))
  }

  // The tree moves the moment a row is dropped. Saving takes calls across the
  // ocean (Vercel in the US, the database in Tokyo) and then a reload; waiting
  // for all that before redrawing made the owner think the drop had failed.
  const moveTopic = (id: string, p: MovePlan) => {
    const from = vocab.topics.find((t) => t.id === id)?.parent_id ?? null
    const oldOrder = shownTopics.map((t) => t.id)
    placeLocally(id, p.parentId, p.order)
    return {
      // Parent first: the order only means anything once the node sits where it is going.
      apply: async () => {
        if (from !== p.parentId) await updateTopic(id, { parent_id: p.parentId })
        await reorderTopics(p.order)
      },
      revert: async () => {
        placeLocally(id, from, oldOrder)
        if (from !== p.parentId) await updateTopic(id, { parent_id: from })
        await reorderTopics(oldOrder)
      },
    }
  }

  // The port's top bar order is its header links (`navLinks`): a drop rewrites
  // that list, keeping each link's own label and hidden flag, and home where it was.
  const portLinks = port.loaded ? navLinks(port.content, port.pages) : []
  const setHeader = (header: PortContent['header']) => port.setContentStored((s) => ({ ...s, header }))
  const movePortLink = (_id: string, p: MovePlan) => {
    const before = port.content.header
    const keys = p.order.filter((k) => k !== 'home' && portLinks.some((l) => l.key === k))
    keys.splice(Math.max(0, portLinks.findIndex((l) => l.key === 'home')), 0, 'home')
    const header = { ...before, links: keys.map((key) => before.links.find((o) => o.key === key) ?? { key }) }
    setHeader(header)
    return {
      apply: () => updateSite({ portfolio: { header } } as never),
      revert: async () => {
        setHeader(before)
        await updateSite({ portfolio: { header: before } } as never)
      },
    }
  }

  const titleOf = (items: TocItem[], id: string | null) => (id ? (items.find((t) => t.id === id)?.name ?? id) : 'tầng trên cùng')

  const dragOf = (toc: NonNullable<SiteSpec['toc']>, shown: TocItem[], id: string): DragProps => {
    const plan = (target: string, where: DropWhere) => (dragging ? planMove(shown, dragging, target, where) : null)
    const drop = (target: string, where: DropWhere) => {
      const moved = dragging
      const p = plan(target, where)
      setDragging(null)
      setDropAt(null)
      if (!moved || !p) return
      if ('error' in p) return setErr(p.error)
      const msg = `Đã chuyển ${titleOf(shown, moved)} ${WHERE_WORDS[where]} ${titleOf(shown, target)}`
      const m = toc.move(moved, p)
      // A drop inside a folded node opens it, so the row does not vanish.
      if (p.parentId)
        setFolded((f) => {
          const next = new Set(f)
          next.delete(`toc:${p.parentId}`)
          return next
        })
      setUndo({ msg, saving: true, revert: m.revert })
      run(async () => {
        await m.apply()
        setUndo((u) => u && { ...u, saving: false })
      })
    }
    return {
      onDragStart: (e) => {
        e.dataTransfer?.setData('text/plain', id)
        setDragging(id)
      },
      onDragOver: (e) => {
        if (!dragging) return
        e.preventDefault()
        const where = whereIn(e, toc.nest)
        const p = plan(id, where)
        if (!p || 'error' in p) return dropAt && setDropAt(null)
        if (dropAt?.id !== id || dropAt.where !== where) setDropAt({ id, where })
      },
      onDragLeave: () => dropAt?.id === id && setDropAt(null),
      onDrop: (e) => {
        e.preventDefault()
        drop(id, whereIn(e, toc.nest))
      },
      onDragEnd: () => (setDragging(null), setDropAt(null)),
      dragging: dragging === id,
      mark: dropAt?.id === id && dragging !== id ? dropAt.where : null,
    }
  }

  // ── the arrow keys walk the rows of the tree ───────────────────────────
  const walk = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>(`[${ROW}]`)]
    const at = rows.indexOf(document.activeElement as HTMLElement)
    const next = rows[at + (e.key === 'ArrowDown' ? 1 : -1)]
    if (!next) return
    e.preventDefault()
    next.focus()
  }

  if (!layout) return <div style={{ padding: '34px 56px', fontFamily: sans, fontSize: 13, color: ink.muted }}>{err ?? 'Đang tải…'}</div>

  const errorLine = err && (
    <div role="alert" style={{ fontFamily: sans, fontSize: 12, color: '#8E1E42', margin: '10px 0' }}>
      {err}
    </div>
  )

  // A page drawn by the practice journal's screen is Practice's, not the blog's.
  const curated = layout.pages.filter((p) => p.kind === 'curated' && p.presentation.screen !== 'hours')
  const livePort = port.pages.filter((p) => p.status !== 'archived')
  const archivedPort = port.pages.filter((p) => p.status === 'archived')
  const overrideOf = (type: 'topic' | 'keyword', id: string) => layout.overrides.find((o) => o.node_type === type && o.node_id === id)
  // One count per node, the one its settings show too: the posts filed under it.
  const leafMeta = (type: 'topic' | 'keyword', id: string, n: number) => `${overrideOf(type, id) ? 'riêng · ' : ''}${posts(n)}`
  // Tags have no order of their own; by name, so a long list can be scanned.
  const tags = [...vocab.keywords].sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  // The page that wears a module's looks, if any: the one to preview it on.
  const wearer = (id: string) => findPage(pages, id)
  const pick = (p: Picked) => () => setPicked(p)
  const on = (p: Picked) => same(picked, p)
  const blog = `/${activeWords().bean}`

  const moduleRows = flattenTree(buildTree([...modules].sort(bySiteOrder)))
  // A module is shown when no ancestor of it is folded.
  const hidden = (id: string): boolean => {
    const parent = modules.find((x) => x.id === id)?.parent_id
    return !!parent && parent !== id && (folded.has(`m:${parent}`) || hidden(parent))
  }

  // ── the sites, each one spec ─────────────────────────────────────────────
  const blogSite: SiteSpec = {
    id: 'blog',
    path: `${blog}/…`,
    home: { title: 'Trang chủ blog', note: `${toPath({ area: 'public', screen: 'landing' })} · nhãn trên cùng, tên lớn, hai đoạn dẫn`, picked: { kind: 'system', key: 'landing' } },
    toc: {
      id: 'topics',
      title: 'Mục lục',
      note: 'Cây chủ đề: thứ tự ở đây là thứ tự của thanh bên và trang Mục lục. Kéo ⋮⋮ để đổi chỗ',
      nest: true,
      move: moveTopic,
      items: shownTopics.map((t) => ({
        id: t.id,
        parent_id: t.parent_id,
        name: t.title,
        dot: t.accent ?? ancestorsOf(sorted, t.id).reverse().find((a) => a.accent)?.accent ?? null,
        meta: leafMeta('topic', t.id, t.posts),
        picked: { kind: 'topic', id: t.id },
        movable: true,
      })),
    },
    pages: [
      {
        id: 'tags',
        title: 'Tag',
        note: `${vocab.keywords.length} tag, xếp theo tên · mỗi tag là một trang`,
        rows: tags.map((k) => <Leaf key={k.id} name={k.label} depth={0} meta={leafMeta('keyword', k.id, k.posts)} on={on({ kind: 'tag', id: k.id })} onClick={pick({ kind: 'tag', id: k.id })} />),
      },
      {
        id: 'curated',
        title: 'Trang chọn tay',
        note: 'Trang có quy chế riêng, như Ghi',
        rows: curated.map((p) => {
          const page = findPage(pages, p.id)
          return <Leaf key={p.id} name={p.title || p.id} depth={0} meta={posts(page ? postsOf(page.id).length : 0)} on={on({ kind: 'curated', id: p.id })} onClick={pick({ kind: 'curated', id: p.id })} />
        }),
      },
    ],
    shared: {
      id: 'modules',
      title: 'Phần chung',
      note: 'Hình trang: dàn trang, ảnh và chữ mà một trang mượn; xem trước trên trang đang mượn',
      rows: moduleRows
        .filter(({ row }) => !hidden(row.id))
        .map(({ row, depth, children }) => (
          <Leaf
            key={row.id}
            name={row.title}
            depth={depth}
            dot={row.accent}
            meta={wearer(row.id) ? undefined : 'chưa dùng'}
            on={on({ kind: 'module', id: row.id })}
            fold={children.length ? fold(`m:${row.id}`) : undefined}
            onClick={pick({ kind: 'module', id: row.id })}
          />
        )),
    },
  }

  const portSite: SiteSpec = {
    id: 'port',
    path: '/',
    home: { title: 'Trang chủ port', note: 'Lời chào và các khối của trang /', picked: { kind: 'port-part', part: 'home' } },
    toc: {
      id: 'port-pages',
      title: 'Mục lục',
      note: `${livePort.length} trang và About: thứ tự ở đây là thứ tự của thanh trên. Kéo ⋮⋮ để đổi chỗ`,
      nest: false,
      move: movePortLink,
      items: [
        // The top bar's links in its order, then the pages it does not show.
        ...portLinks.flatMap((l): TocItem[] => {
          if (l.key === 'about') return [{ id: l.key, parent_id: null, name: 'About', meta: l.hidden ? 'ẩn' : '/about', picked: { kind: 'port-part', part: 'about' }, movable: true }]
          const pg = port.pages.find((x) => `page:${x.id}` === l.key)
          return pg ? [{ id: l.key, parent_id: null, name: pg.title, meta: l.hidden ? 'ẩn' : `/${pg.slug}`, picked: { kind: 'port-page', id: pg.id }, movable: true }] : []
        }),
        ...[...port.pages.filter((x) => x.status === 'draft'), ...archivedPort].map(
          (pg): TocItem => ({ id: `page:${pg.id}`, parent_id: null, name: pg.title, meta: pg.status === 'draft' ? 'nháp' : 'lưu trữ', picked: { kind: 'port-page', id: pg.id }, movable: false }),
        ),
      ],
    },
    shared: {
      id: 'port-parts',
      title: 'Phần chung',
      note: 'Signature, thanh trên, chân trang',
      rows: PORT_PARTS.filter((x) => x.part !== 'about').map((x) => <Leaf key={x.part} name={x.title} depth={0} on={on({ kind: 'port-part', part: x.part })} onClick={pick({ kind: 'port-part', part: x.part })} />),
    },
  }

  const practiceSite: SiteSpec = {
    id: 'practice',
    path: toPath({ area: 'practice', screen: 'hours' }),
    home: { title: 'Ghi 02', note: 'Nhật ký giờ luyện, sau đăng nhập', picked: { kind: 'practice' } },
  }

  const spec = { blog: blogSite, port: portSite, practice: practiceSite }[site]

  /** The tree of one site, drawn from its spec: the same cards and rows, the same drag, for every site. */
  const siteTree = ({ id, path, home, toc, pages: others = [], shared }: SiteSpec) => {
    const group = (g: GroupSpec) => (
      <div key={g.id} style={{ display: 'contents' }}>
        <Card title={g.title} note={g.note} on={on({ kind: 'group', id: g.id })} fold={fold(g.id)} onClick={pick({ kind: 'group', id: g.id })} />
        {!folded.has(g.id) && g.rows}
      </div>
    )
    const tocRows = () => {
      if (!toc) return null
      const nodes = buildTree(toc.items)
      const shown = flattenTree(nodes).map((n) => n.row)
      const node = ({ row, children, depth }: (typeof nodes)[number]): ReactNode => (
        <div key={row.id}>
          <Leaf
            name={row.name}
            depth={depth}
            dot={row.dot}
            meta={row.meta}
            on={on(row.picked)}
            fold={children.length ? fold(`toc:${row.id}`) : undefined}
            drag={row.movable ? dragOf(toc, shown, row.id) : undefined}
            onClick={pick(row.picked)}
          />
          {!folded.has(`toc:${row.id}`) && children.map(node)}
        </div>
      )
      return nodes.map(node)
    }
    return (
      <section aria-label={SITE_LABELS[id]} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: ink.muted, padding: '0 2px 2px' }}>{path}</div>
        <Card title={home.title} note={home.note} on={on(home.picked)} onClick={pick(home.picked)} />
        {toc && group({ ...toc, rows: tocRows() })}
        {others.map(group)}
        {shared && group(shared)}
      </section>
    )
  }

  const tree = (
    <nav
      aria-label="Cây cấu hình"
      onKeyDown={walk}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, ...(columns === 1 ? {} : { position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto' }), padding: '0 4px 24px 0' }}
    >
      {siteTree(spec)}

      {undo && (
        <div role="status" style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 10, alignItems: 'center', background: paper.cream, border: `1px solid ${ink.border}`, borderRadius: radius, padding: '8px 10px', fontFamily: sans, fontSize: 12, color: ink.base }}>
          <span style={{ flex: 1 }}>
            <span>{undo.msg}</span>
            {undo.saving && <span style={{ color: ink.muted }}> · đang lưu…</span>}
          </span>
          <button
            type="button"
            disabled={undo.saving}
            onClick={() => {
              const u = undo
              setUndo(null)
              run(u.revert)
            }}
            style={{ all: 'unset', cursor: undo.saving ? 'default' : 'pointer', color: undo.saving ? ink.faint : ink.green, fontWeight: 500 }}
          >
            Hoàn tác
          </button>
          <button type="button" aria-label="Đóng" onClick={() => setUndo(null)} style={{ all: 'unset', cursor: 'pointer', color: ink.muted }}>
            ✕
          </button>
        </div>
      )}
    </nav>
  )

  // ── the right side: a heading that says what is open, its fields, and its preview ──
  let crumbs: string[] = []
  let address = ''
  let preview = ''
  let previewKey = round
  // A topic or tag opens on its own name field, which is the title; a second one above it would read as two things.
  let named = false
  let body: ReactNode = null

  const page = (sel: BlogSelected) => (
    <PageEditor
      key={JSON.stringify(sel)}
      selected={sel}
      layout={layout}
      pages={pages}
      postsOf={postsOf}
      vocab={vocab}
      error={errorLine}
      run={run}
      onGone={() => setPicked({ kind: 'group', id: 'curated' })}
      renderCopy={renderCopy}
      renderModule={renderModule}
    />
  )
  const nodePage = (type: 'topic' | 'keyword', node: string) => (
    <NodePage
      type={type}
      node={node}
      layout={layout}
      pages={pages}
      postsOf={postsOf}
      vocab={vocab}
      error={errorLine}
      run={run}
      renderCopy={renderCopy}
      renderModule={renderModule}
    />
  )

  switch (picked.kind) {
    case 'port-part': {
      const title = picked.part === 'home' ? 'Trang chủ port' : PORT_PARTS.find((x) => x.part === picked.part)?.title ?? picked.part
      // About is a page of the top bar, so it sits in Mục lục; the rest every page shares.
      crumbs = ['Port', ...(picked.part === 'home' ? [] : [picked.part === 'about' ? 'Mục lục' : 'Phần chung']), title]
      preview = toPath({ area: 'public', screen: picked.part === 'about' || picked.part === 'sign' ? 'portfolioAbout' : 'portfolioHome' })
      address = preview
      previewKey = portRound
      body = port.loaded ? <ContentTab key={picked.part} only={picked.part} content={port.content} setStored={port.setContentStored} pages={port.pages} /> : null
      break
    }
    case 'port-page': {
      const p = port.pages.find((x) => x.id === picked.id)
      crumbs = ['Port', 'Mục lục', p?.title ?? picked.id]
      address = p ? `/${p.slug}` : ''
      // The builder draws its own live preview of the unsaved page into the preview column.
      body = p ? (
        <Builder
          key={p.id}
          page={p}
          design={port.design}
          src={src}
          content={port.content}
          pages={port.pages}
          onSaved={(next) => port.setPages((ps) => ps.map((x) => (x.id === next.id ? next : x)))}
          previewSlot={slot}
          onDelete={() => {
            if (!window.confirm(`Xoá trang “${p.title}”? Thao tác này không hoàn tác được.`)) return
            run(async () => {
              await deletePortPage(p.id)
              port.setPages((ps) => ps.filter((x) => x.id !== p.id))
              setPicked({ kind: 'group', id: 'port-pages' })
            })
          }}
        />
      ) : null
      break
    }
    case 'system':
    case 'curated': {
      const d = describePage(picked, layout, pages)
      const where = picked.kind === 'curated' ? 'Trang chọn tay' : null
      crumbs = ['Personal Blog', ...(where ? [where] : []), picked.kind === 'system' && picked.key === 'landing' ? 'Trang chủ blog' : d.title]
      preview = d.preview
      address = d.preview
      body = page(picked)
      break
    }
    case 'override':
      // Not opened from the tree: a node's own settings show inside its topic or tag.
      break
    case 'topic': {
      const t = vocab.topics.find((x) => x.id === picked.id)
      if (!t) break
      const path = [...ancestorsOf(sorted, t.id), t].map((x) => x.title)
      crumbs = ['Personal Blog', 'Mục lục', ...path]
      named = true
      address = toPath({ area: 'public', screen: 'module', moduleId: t.id })
      preview = address
      body = (
        <>
          {errorLine}
          <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
            <TopicSettings
              key={t.id}
              topic={t}
              parent={t.parent_id ? vocab.topics.find((x) => x.id === t.parent_id) : undefined}
              tree={shownTopics}
              count={t.posts}
              used={[...new Set(vocab.topics.map((x) => x.accent).filter((c): c is string => !!c))]}
              save={(patch) => run(() => updateTopic(t.id, patch))}
            />
            <NavFlags layout={layout} navRef={`topic:${t.id}`} defaults={{ sidebar: true, home: t.parent_id === null }} run={run} />
          </div>
          <div style={sectionHead}>Mục con</div>
          <AddField
            label="Thêm mục"
            placeholder={`tên mục mới trong ${t.title}`}
            onAdd={(title) =>
              run(async () => {
                await createTopic(title, t.id)
                setFolded((f) => {
                  const next = new Set(f)
                  next.delete(`t:${t.id}`)
                  return next
                })
              })
            }
          />
          <div style={sectionHead}>Trang</div>
          {nodePage('topic', t.id)}
        </>
      )
      break
    }
    case 'tag': {
      const k = vocab.keywords.find((x) => x.id === picked.id)
      if (!k) break
      crumbs = ['Personal Blog', 'Tag', k.label]
      named = true
      address = toPath({ area: 'public', screen: 'module', moduleId: `${TAG_PAGE}${k.id}` })
      preview = address
      body = (
        <>
          {errorLine}
          <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
            <FlatSettings key={k.id} kind="Tag" entry={k} count={k.posts} onRename={(label) => run(() => renameKeyword(k.id, label))} />
            <NavFlags layout={layout} navRef={`tag:${k.id}`} defaults={{ sidebar: false, home: false }} run={run} />
          </div>
          <div style={sectionHead}>Trang</div>
          {nodePage('keyword', k.id)}
        </>
      )
      break
    }
    case 'module': {
      crumbs = ['Personal Blog', 'Phần chung', modules.find((m) => m.id === picked.id)?.title ?? picked.id]
      // A module is not a page of its own since the pages moved onto the topic
      // tree; it is previewed on the page that wears it.
      const w = wearer(picked.id)
      if (w) preview = w.screen === 'notes' ? toPath({ area: 'public', screen: 'notes' }) : toPath({ area: 'public', screen: 'module', moduleId: w.id })
      address = preview
      body = (
        <>
          <p style={hint}>{!w ? 'Chưa trang nào mượn hình này, nên không có gì để xem trước.' : w.source === 'module' ? 'Chưa trang nào mượn hình này; nó vẫn là một trang của riêng nó, xem ở khung bên cạnh.' : `Trang ${w.title} đang mượn hình này; khung bên cạnh là trang ấy.`}</p>
          {renderModule(picked.id)}
        </>
      )
      break
    }
    case 'practice':
      crumbs = ['Practice', 'Ghi 02']
      preview = toPath({ area: 'practice', screen: 'hours' })
      address = preview
      body = renderPractice()
      break
    case 'group': {
      const g = picked.id
      if (g === 'port-pages') {
        crumbs = ['Port', 'Mục lục']
        preview = '/'
        const add = (key: PresetKey) =>
          run(async () => {
            const p = await createFromPreset(key, port.pages, src.moduleIds)
            port.setPages((ps) => [...ps, p])
            setPicked({ kind: 'port-page', id: p.id })
          })
        body = (
          <>
            {errorLine}
            <p style={hint}>Thanh trên của port vẽ đúng thứ tự này. Chọn một trang ở bên trái để sửa; muốn đổi chỗ thì nắm ⋮⋮ ở cuối dòng và kéo lên hay xuống. Trang nháp và trang lưu trữ không lên thanh trên nên đứng cuối, không kéo được.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(
                [
                  ['bibi', 'từ mẫu bibi'],
                  ['bibe', 'từ mẫu bibe'],
                  ['blank', 'trang trống'],
                ] as const
              ).map(([key, text]) => (
                <button key={key} type="button" onClick={() => add(key)} style={{ border: `1px solid ${ink.border}`, borderRadius: radius, background: paper.white, fontFamily: sans, fontSize: 12.5, padding: '6px 12px', cursor: 'pointer' }}>
                  + Thêm trang {text}
                </button>
              ))}
            </div>
          </>
        )
      } else if (g === 'topics') {
        crumbs = ['Personal Blog', 'Mục lục']
        preview = toPath({ area: 'public', screen: 'home' })
        address = preview
        body = (
          <>
            {errorLine}
            <p style={hint}>
              Trang Mục lục và thanh bên vẽ đúng cây này, theo đúng thứ tự này. Chọn một mục ở bên trái để sửa tên, màu, lời dẫn và trang của nó. Muốn đổi chỗ thì nắm ⋮⋮ ở cuối dòng và kéo: thả vào giữa một dòng là cho vào trong mục đó, thả vào mép trên hay mép dưới là đặt trước hay sau.
            </p>
            <div style={sectionHead}>Subject mới</div>
            <AddField label="Thêm subject" placeholder="tên subject" onAdd={(title) => run(() => createTopic(title, null))} />
            {renderCopy('index')}
          </>
        )
      } else if (g === 'tags') {
        crumbs = ['Personal Blog', 'Tag']
        body = (
          <>
            {errorLine}
            <p style={hint}>Chọn một tag ở bên trái để đổi tên hay chỉnh trang của nó. Gộp và xoá tag ở tab Nội dung, nơi thấy bài nào sẽ bị đổi.</p>
            <div style={sectionHead}>Tag mới</div>
            <AddField label="Thêm tag" placeholder="tên tag" onAdd={(label) => run(() => createKeyword(label))} />
          </>
        )
      } else if (g === 'curated') {
        crumbs = ['Personal Blog', 'Trang chọn tay']
        body = (
          <>
            {errorLine}
            <p style={hint}>Một trang chọn tay có quy chế riêng: kéo bài từ chủ đề, tag hay khuôn bài nào, xếp ra sao.</p>
            <div style={sectionHead}>Trang mới</div>
            <AddField
              label="Thêm trang"
              placeholder="địa chỉ, ví dụ doc-cham"
              onAdd={(v) => {
                const id = v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
                run(async () => {
                  await createPage(id, id)
                  setPicked({ kind: 'curated', id })
                })
              }}
            />
          </>
        )
      } else {
        crumbs = [g === 'port-parts' ? 'Port' : 'Personal Blog', 'Phần chung']
        body = <p style={hint}>Chọn một mục ở cây bên trái để sửa.</p>
      }
      break
    }
  }

  const header = (
    <div style={{ margin: '4px 0 18px' }}>
      <div aria-label="Đang sửa" style={{ fontFamily: sans, fontSize: 11.5, color: ink.muted }}>
        {crumbs.slice(0, -1).join(' › ')}
      </div>
      {!named && <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 26, letterSpacing: '-.02em', margin: '2px 0 4px', color: ink.base }}>{crumbs[crumbs.length - 1]}</h2>}
      {address && (
        <a href={address} target="_blank" rel="noreferrer" style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: ink.soft }}>
          {address} ↗
        </a>
      )}
    </div>
  )

  // The port builder draws its own preview into the slot; everything else gets the public page.
  const previewPane =
    slot && picked.kind !== 'port-page'
      ? createPortal(
          preview ? (
            <ScaledPreview>
              <iframe key={`${preview}#${previewKey}`} title={`xem trước ${crumbs[crumbs.length - 1] ?? ''}`} src={preview} style={{ width: '100%', height: '100%', border: 0 }} />
            </ScaledPreview>
          ) : (
            <div style={{ padding: 24, fontFamily: sans, fontSize: 13, color: ink.muted }}>Mục này không có trang riêng để xem trước.</div>
          ),
          slot,
        )
      : null

  const previewStyle = { background: paper.white, border: `1px solid ${paper.rule}`, borderRadius: radius, overflow: 'hidden', pointerEvents: split.dragging || treeSplit.dragging ? 'none' : undefined } as const

  return (
    <div>
      <div style={{ padding: columns === 1 ? '24px 16px 0' : '28px 32px 0' }}>
        <SiteTabs tabs={SITES} labels={SITE_LABELS} value={site} onChange={openSite} />
      </div>
      <div
      ref={root}
      style={{
        display: 'grid',
        gridTemplateColumns: columns === 3 ? `${treeSplit.size}px 7px ${split.columns}` : columns === 2 ? treeSplit.columns : 'minmax(0, 1fr)',
        // Each cell keeps its own height, which is what lets the tree and the preview stick.
        alignItems: 'start',
        columnGap: 12,
        rowGap: 20,
        padding: columns === 1 ? '16px 16px 90px' : '20px 32px 120px',
      }}
    >
      <style>{'.cfg-leaf .cfg-grip{opacity:0}.cfg-leaf:hover .cfg-grip,.cfg-leaf:focus-within .cfg-grip{opacity:1}'}</style>
      <div style={columns === 2 ? { gridRow: '1 / span 2' } : undefined}>{tree}</div>
      {columns > 1 && <div style={{ alignSelf: 'stretch', ...(columns === 2 ? { gridRow: '1 / span 2' } : {}) }}>{treeSplit.handle}</div>}
      <div ref={editor} style={{ minWidth: 0, scrollMarginTop: 16, ...(columns === 3 ? { position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto', paddingRight: 8 } : {}) }}>
        {header}
        {body}
      </div>
      {columns === 3 && split.handle}
      <div
        ref={setSlot}
        aria-label="Xem trước"
        style={{
          ...previewStyle,
          ...(columns === 3 ? { position: 'sticky', top: 0, height: 'calc(100vh - 40px)' } : { height: '70vh' }),
          ...(columns === 2 ? { gridColumn: 3 } : {}),
        }}
      />
      {previewPane}
      </div>
    </div>
  )
}
