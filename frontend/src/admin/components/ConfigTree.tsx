import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  createKeyword,
  createPage,
  createNode,
  deletePage,
  deleteNode,
  getLayout,
  listKeywords,
  listTags,
  listNodes,
  renameKeyword,
  reorderNodes,
  updatePage,
  updateSite,
  updateNode,
  type Module,
  type Node,
  type NodeStatus,
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
import { ink, paper, sans } from '../../design/tokens'
import { radius } from '../../design/controls'
import { retireKeyword, retireTopic } from '../lib/retire'
import { Switch, desk, frame, DetailHead, ItemList, Row, Section, WHERE_WORDS, type AddSpec, type Crumb, type DetailAction, type ItemDrag, type ListItem } from './Detail'
import { RetireTag, RetireTopic, statusLabel, TopicFields } from './NodeFields'
import { Builder, ContentTab, PRESET_CHOICES, createFromPreset, toSlug, usePortAdmin, useSplit, type PortPart } from './PortEditors'
import { ScaledPreview, useWidth } from './ScaledPreview'
import { SiteTabs, useRememberedTab } from './SiteTabs'
import {
  describePage,
  NavFlags,
  NodePage,
  PageEditor,
  pageDeleteBlocker,
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
 *   card opens it on the right, and that is all a click does;
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
 *
 * Later still that day the owner asked for the values to move out of the
 * tree: the left keeps only the cards, and what a card holds (the topics,
 * the tags, the port's pages) is listed, dragged, added and deleted in the
 * detail on the right, where an item's own children are listed in turn.
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

const posts = (n: number) => `${n} bài`

/** A card of the tree, which the arrow keys walk. */
const ROW = 'data-cfg-row'

function Card({ title, note, on, onClick }: { title: string; note: string; on: boolean; onClick: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        background: on ? desk.soft : desk.panel,
        border: `1px solid ${on ? ink.moss : desk.line}`,
        boxShadow: on ? `inset 3px 0 0 ${ink.moss}` : 'none',
        borderRadius: radius,
      }}
    >
      <button
        type="button"
        {...{ [ROW]: '' }}
        aria-current={on || undefined}
        onClick={onClick}
        style={{ all: 'unset', flex: 1, minWidth: 0, padding: '12px 14px 13px', cursor: 'pointer' }}
      >
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 15, lineHeight: 1.25, color: ink.base }}>{title}</div>
        <div style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.45, color: ink.soft, marginTop: 4 }}>{note}</div>
      </button>
    </div>
  )
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

type MovePlan = Exclude<ReturnType<typeof planMove>, { error: string }>

/** One row of a site's Mục lục; `parent_id` is null on a flat list. */
type TocItem = { id: string; parent_id: string | null; name: string; dot?: string | null; meta?: string; picked: Picked; movable: boolean }

type Toc = NonNullable<SiteSpec['toc']>

/** A card under the home card; what it holds is listed on the right. */
type GroupSpec = { id: Group; title: string; note: string }

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
  // The delete panel is open for one pick, so another pick closes it and a
  // row's "Xoá…" can open its item with the panel already showing.
  const [retiringFor, setRetiringFor] = useState<string | null>(null)
  const retiring = retiringFor === JSON.stringify(picked)
  const retire = (p: Picked) => {
    setPicked(p)
    setRetiringFor(JSON.stringify(p))
  }
  const [round, setRound] = useState(0)
  const [portRound, setPortRound] = useState(0)
  const [undo, setUndo] = useState<{ msg: string; saving: boolean; revert: () => Promise<unknown> } | null>(null)

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
  const loadVocab = () => Promise.all([listNodes('blog'), listKeywords(), listTags()]).then(([topics, keywords, kinds]) => setVocab({ topics, keywords, kinds }))
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
        if (from !== p.parentId) await updateNode(id, { parent_id: p.parentId })
        await reorderNodes(p.order)
      },
      revert: async () => {
        placeLocally(id, from, oldOrder)
        if (from !== p.parentId) await updateNode(id, { parent_id: from })
        await reorderNodes(oldOrder)
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

  /** `shown` is the whole Mục lục in drawn order, even where only one level of it is listed. */
  const dragOf = (toc: Toc, shown: TocItem[], id: string): ItemDrag => {
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

  // ── the arrow keys walk the cards of the tree ──────────────────────────
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
    <div role="alert" style={{ fontFamily: sans, fontSize: 14, fontWeight: 500, color: ink.danger, background: desk.panel, border: `1px solid ${ink.dangerLine}`, borderRadius: radius, padding: '10px 14px', margin: '14px 0 0' }}>
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
  // Every site's rows say the same things the same way: a state other than live first, then where it is.
  const tocMeta = (status: NodeStatus, rest: string, hidden = false) =>
    [status !== 'published' ? statusLabel(status) : hidden ? 'ẩn' : '', rest].filter(Boolean).join(' · ')
  // A port page's dot: its own colour, else the colour of the look it wears.
  const portDot = (pg: Node) => pg.accent ?? port.design.palettes[pg.look ?? 'biz']?.c500 ?? null
  // Tags have no order of their own; by name, so a long list can be scanned.
  const tags = [...vocab.keywords].sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  // The page that wears a module's looks, if any: the one to preview it on.
  const wearer = (id: string) => findPage(pages, id)
  const pick = (p: Picked) => () => setPicked(p)
  const on = (p: Picked) => same(picked, p)
  const blog = `/${activeWords().bean}`

  const moduleRows = flattenTree(buildTree([...modules].sort(bySiteOrder)))

  // ── the sites, each one spec ─────────────────────────────────────────────
  const topicToc: Toc = {
    id: 'topics',
    title: 'Mục lục',
    note: `${shownTopics.filter((t) => t.parent_id === null).length} subject · cây chủ đề, theo thứ tự của thanh bên và trang Mục lục`,
    nest: true,
    move: moveTopic,
    items: shownTopics.map((t) => ({
      id: t.id,
      parent_id: t.parent_id,
      name: t.title,
      dot: t.accent ?? ancestorsOf(sorted, t.id).reverse().find((a) => a.accent)?.accent ?? null,
      meta: tocMeta(t.status, leafMeta('topic', t.id, t.posts)),
      picked: { kind: 'topic', id: t.id },
      movable: true,
    })),
  }

  const blogSite: SiteSpec = {
    id: 'blog',
    path: `${blog}/…`,
    home: { title: 'Trang chủ blog', note: `${toPath({ area: 'public', screen: 'landing' })} · nhãn trên cùng, tên lớn, hai đoạn dẫn`, picked: { kind: 'system', key: 'landing' } },
    toc: topicToc,
    pages: [
      { id: 'tags', title: 'Tag', note: `${vocab.keywords.length} tag, xếp theo tên · mỗi tag là một trang` },
      { id: 'curated', title: 'Trang chọn tay', note: `${curated.length} trang có quy chế riêng, như Ghi` },
    ],
    shared: { id: 'modules', title: 'Phần chung', note: 'Hình trang: dàn trang, ảnh và chữ mà một trang mượn' },
  }

  const portToc: Toc = {
    id: 'port-pages',
    title: 'Mục lục',
    note: `${livePort.length} trang và About, theo thứ tự của thanh trên`,
    nest: false,
    move: movePortLink,
    items: [
      // The top bar's links in its order, then the pages it does not show.
      ...portLinks.flatMap((l): TocItem[] => {
        if (l.key === 'about') return [{ id: l.key, parent_id: null, name: 'About', dot: null, meta: tocMeta('published', '/about', l.hidden), picked: { kind: 'port-part', part: 'about' }, movable: true }]
        const pg = port.pages.find((x) => `page:${x.id}` === l.key)
        return pg ? [{ id: l.key, parent_id: null, name: pg.title, dot: portDot(pg), meta: tocMeta(pg.status, `/${pg.slug}`, l.hidden), picked: { kind: 'port-page', id: pg.id }, movable: true }] : []
      }),
      ...[...port.pages.filter((x) => x.status === 'draft'), ...archivedPort].map(
        (pg): TocItem => ({ id: `page:${pg.id}`, parent_id: null, name: pg.title, dot: portDot(pg), meta: tocMeta(pg.status, `/${pg.slug}`), picked: { kind: 'port-page', id: pg.id }, movable: false }),
      ),
    ],
  }

  const portSite: SiteSpec = {
    id: 'port',
    path: '/',
    home: { title: 'Trang chủ port', note: 'Lời chào và các khối của trang /', picked: { kind: 'port-part', part: 'home' } },
    toc: portToc,
    shared: { id: 'port-parts', title: 'Phần chung', note: 'Signature, thanh trên, chân trang' },
  }

  const practiceSite: SiteSpec = {
    id: 'practice',
    path: toPath({ area: 'practice', screen: 'hours' }),
    home: { title: 'Ghi 02', note: 'Nhật ký giờ luyện, sau đăng nhập', picked: { kind: 'practice' } },
  }

  const spec = { blog: blogSite, port: portSite, practice: practiceSite }[site]

  /** The card a pick belongs to, lit while anything inside it is open on the right. */
  const groupOf = (p: Picked): Group | null => {
    switch (p.kind) {
      case 'group':
        return p.id
      case 'topic':
        return 'topics'
      case 'tag':
        return 'tags'
      case 'curated':
        return 'curated'
      case 'module':
        return 'modules'
      case 'port-page':
        return 'port-pages'
      case 'port-part':
        return p.part === 'home' ? null : p.part === 'about' ? 'port-pages' : 'port-parts'
      default:
        return null
    }
  }

  /** The cards of one site, drawn from its spec: the same cards for every site. */
  const siteTree = ({ id, path, home, toc, pages: others = [], shared }: SiteSpec) => {
    const group = (g: GroupSpec) => <Card key={g.id} title={g.title} note={g.note} on={groupOf(picked) === g.id} onClick={pick({ kind: 'group', id: g.id })} />
    return (
      <section aria-label={SITE_LABELS[id]} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: ink.muted, padding: '0 2px 2px' }}>{path}</div>
        <Card title={home.title} note={home.note} on={on(home.picked)} onClick={pick(home.picked)} />
        {toc && group(toc)}
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
    </nav>
  )

  // ── the right side: one template for every item (`Detail.tsx`) and the public page beside it ──
  let crumbs: Crumb[] = []
  let title = ''
  let rename: ((v: string) => void) | undefined
  let address = ''
  let facts: string[] = []
  let actions: DetailAction[] = []
  let preview = ''
  let previewKey = round
  let body: ReactNode = null

  const fixed = (why: string): DetailAction[] => [{ label: 'Xoá', danger: true, off: why }]
  const undoable = (fn: () => Promise<{ msg: string; revert: () => Promise<unknown> }>, then: () => void) =>
    run(async () => {
      const r = await fn()
      setRetiringFor(null)
      then()
      setUndo({ msg: r.msg, saving: false, revert: r.revert })
    })
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
  const siteCrumb = (id: SiteId): Crumb => ({ label: SITE_LABELS[id], open: pick(homeOf(id)) })
  const groupCrumb = (id: Group, label: string): Crumb => ({ label, open: pick({ kind: 'group', id }) })

  /**
   * How an item is deleted — the same from its own ⋮ and from its row's ⋮ in
   * the list it sits in. Topics and tags first ask where their posts go, so
   * their row opens the item with that panel showing.
   */
  const deleteOf = (p: Picked): DetailAction[] | undefined => {
    switch (p.kind) {
      case 'topic':
        return [{ label: 'Xoá…', danger: true, onPick: () => retire(p) }]
      case 'tag':
        return [{ label: 'Xoá hay gộp…', danger: true, onPick: () => retire(p) }]
      case 'port-page': {
        const pg = port.pages.find((x) => x.id === p.id)
        if (!pg) return undefined
        return [
          {
            label: 'Xoá trang…',
            danger: true,
            onPick: () => {
              if (!window.confirm(`Xoá trang “${pg.title}”? Thao tác này không hoàn tác được.`)) return
              run(async () => {
                await deleteNode(pg.id)
                port.setPages((ps) => ps.filter((x) => x.id !== pg.id))
                setPicked((cur) => (same(cur, p) ? { kind: 'group', id: 'port-pages' } : cur))
              })
            },
          },
        ]
      }
      case 'curated': {
        const record = describePage(p, layout, pages).record
        if (!record) return undefined
        const name = record.title || record.id
        return [
          {
            label: 'Xoá trang…',
            danger: true,
            off: pageDeleteBlocker(p, layout, pages),
            onPick: () =>
              window.confirm(`Xoá trang “${name}”?`) &&
              run(async () => {
                await deletePage(record.id)
                setPicked((cur) => (same(cur, p) ? { kind: 'group', id: 'curated' } : cur))
              }),
          },
        ]
      }
      default:
        return undefined
    }
  }

  /** Rows of a Mục lục as the right-hand list draws them: dragged by their grip, deleted from their ⋮. */
  const tocList = (toc: Toc, rows: TocItem[]): ListItem[] =>
    rows.map((r) => ({ id: r.id, name: r.name, meta: r.meta, dot: r.dot, onOpen: pick(r.picked), drag: r.movable ? dragOf(toc, toc.items, r.id) : undefined, actions: deleteOf(r.picked) }))
  const dragNote = (nest: boolean) => (nest ? 'kéo ⋮⋮ để đổi chỗ hay đưa vào trong' : 'kéo ⋮⋮ để đổi chỗ')
  const newPortPage = async (name: string, key: PresetKey) => {
    const p = await createFromPreset(key, name, port.pages, src.moduleIds)
    port.setPages((ps) => [...ps, p])
    return p
  }
  const addPortPage: AddSpec = {
    label: 'Thêm trang',
    placeholder: 'tên trang mới',
    choose: { label: 'bắt đầu từ', options: PRESET_CHOICES },
    onSave: (name, key) =>
      run(async () => {
        const p = await newPortPage(name, (key ?? 'blank') as PresetKey)
        setPicked({ kind: 'port-page', id: p.id })
      }),
  }
  const addTopic = (parent: Node | null): AddSpec => ({
    label: parent ? 'Thêm mục con' : 'Thêm subject',
    placeholder: parent ? `tên mục mới trong ${parent.title}` : 'tên subject',
    onSave: (name) => run(() => createNode({ site: 'blog', title: name, parent_id: parent?.id ?? null })),
  })

  /**
   * A port page's two switches, named as a blog subject's are: on the top bar
   * (the header link's hidden flag) and on the port home (its feature cards).
   * Only a published page is on either.
   */
  const portFlags = (p: Node): ReactNode => {
    if (p.status === 'archived')
      return (
        <Row label="Hiện trên menu">
          <span style={{ color: ink.soft }}>chỉ trang đã đăng mới lên thanh trên và trang chủ</span>
        </Row>
      )
    const { header, home } = port.content
    const published = port.pages.filter((x) => x.status === 'published')
    const link = portLinks.find((l) => l.key === `page:${p.id}`)
    const features = home.features.length ? home.features : published.map((x) => ({ pageId: x.id, label: '', intro: '', image: '' }))
    const save = (patch: Partial<PortContent>) => {
      port.setContentStored((st) => ({ ...st, ...patch }))
      run(() => updateSite({ portfolio: patch } as never))
    }
    const setMenu = (on: boolean) =>
      save({ header: { ...header, links: portLinks.map((l) => ({ key: l.key, label: l.label, hidden: l.key === `page:${p.id}` ? !on : l.hidden })) } })
    const setHome = (on: boolean) =>
      save({ home: { ...home, features: on ? [...features, { pageId: p.id, label: '', intro: '', image: '' }] : features.filter((f) => f.pageId !== p.id) } })
    // A draft can already hold its home block (added from Trang chủ port's "+ Thêm khối"),
    // so its switch shows the same list; the public home waits for it to be published.
    return (
      <>
        {p.status === 'published' ? (
          <Row label="Hiện trên menu">
            <Switch label="Hiện trên menu" value={!!link && !link.hidden} onChange={setMenu} />
          </Row>
        ) : (
          <Row label="Hiện trên menu">
            <span style={{ color: ink.soft }}>lên thanh trên khi trang được đăng</span>
          </Row>
        )}
        <Row label="Hiện ở trang chủ">
          <Switch label="Hiện ở trang chủ" value={features.some((f) => f.pageId === p.id)} onChange={setHome} />
        </Row>
      </>
    )
  }

  switch (picked.kind) {
    case 'port-part': {
      const part = PORT_PARTS.find((x) => x.part === picked.part)
      title = picked.part === 'home' ? 'Trang chủ port' : part?.title ?? picked.part
      // About is a page of the top bar, so it sits in Mục lục; the rest every page shares.
      crumbs = [siteCrumb('port'), ...(picked.part === 'home' ? [] : [picked.part === 'about' ? groupCrumb('port-pages', 'Mục lục') : groupCrumb('port-parts', 'Phần chung')])]
      preview = toPath({ area: 'public', screen: picked.part === 'about' || picked.part === 'sign' ? 'portfolioAbout' : 'portfolioHome' })
      address = picked.part === 'home' || picked.part === 'about' ? preview : ''
      actions = fixed(picked.part === 'home' || picked.part === 'about' ? 'trang hệ thống, không xoá được' : 'phần chung của mọi trang, không xoá được')
      previewKey = portRound
      body = port.loaded ? (
        <Section title={picked.part === 'home' || picked.part === 'about' ? 'Nội dung trang' : 'Thông tin'}>
          <ContentTab key={picked.part} only={picked.part} content={port.content} setStored={port.setContentStored} pages={port.pages} onNewPage={newPortPage} />
        </Section>
      ) : null
      break
    }
    case 'port-page': {
      const p = port.pages.find((x) => x.id === picked.id)
      if (!p) break
      crumbs = [siteCrumb('port'), groupCrumb('port-pages', 'Mục lục')]
      title = p.title
      rename = (v) => run(async () => {
        const next = await updateNode(p.id, { title: v })
        port.setPages((ps) => ps.map((x) => (x.id === next.id ? next : x)))
      })
      address = p.status === 'published' ? `/${p.slug}` : ''
      facts = [statusLabel(p.status)]
      actions = deleteOf(picked) ?? []
      // The builder draws its own live preview of the unsaved page into the preview column.
      body = (
        <>
          {errorLine}
          <Builder
            key={p.id}
            page={p}
            design={port.design}
            src={src}
            content={port.content}
            pages={port.pages}
            onSaved={(next) => port.setPages((ps) => ps.map((x) => (x.id === next.id ? next : x)))}
            previewSlot={slot}
            flags={portFlags(p)}
          />
        </>
      )
      break
    }
    case 'system':
    case 'curated': {
      const d = describePage(picked, layout, pages)
      const blocker = pageDeleteBlocker(picked, layout, pages)
      crumbs = [siteCrumb('blog'), ...(picked.kind === 'curated' ? [groupCrumb('curated', 'Trang chọn tay')] : [])]
      title = picked.kind === 'system' && picked.key === 'landing' ? 'Trang chủ blog' : d.title
      preview = d.preview
      address = d.preview
      if (picked.kind === 'curated' && d.record) {
        const record = d.record
        rename = (v) => run(() => updatePage(record.id, { title: v }))
        facts = [record.visibility === 'public' ? 'công khai' : 'riêng tư']
        actions = deleteOf(picked) ?? []
      } else actions = fixed(blocker ?? 'trang hệ thống, không xoá được')
      body = page(picked)
      break
    }
    case 'override':
      // Not opened from the tree: a node's own settings show inside its topic or tag.
      break
    case 'topic': {
      const t = vocab.topics.find((x) => x.id === picked.id)
      if (!t) break
      const kids = sorted.filter((x) => x.parent_id === t.id)
      crumbs = [siteCrumb('blog'), groupCrumb('topics', 'Mục lục'), ...ancestorsOf(sorted, t.id).map((x): Crumb => ({ label: x.title, open: pick({ kind: 'topic', id: x.id }) }))]
      title = t.title
      rename = (v) => run(() => updateNode(t.id, { title: v }))
      address = toPath({ area: 'public', screen: 'module', moduleId: t.id })
      preview = address
      facts = [posts(t.posts), statusLabel(t.status)]
      actions = deleteOf(picked) ?? []
      body = (
        <>
          {errorLine}
          {retiring && (
            <RetireTopic
              topic={t}
              tree={shownTopics}
              kids={kids.length}
              count={t.posts}
              onCancel={() => setRetiringFor(null)}
              onRetire={(to) => undoable(() => retireTopic(t, to, vocab.topics), () => setPicked({ kind: 'group', id: 'topics' }))}
            />
          )}
          <Section title="Thông tin">
            <TopicFields
              key={t.id}
              topic={t}
              parent={t.parent_id ? vocab.topics.find((x) => x.id === t.parent_id) : undefined}
              tree={shownTopics}
              used={[...new Set(vocab.topics.map((x) => x.accent).filter((c): c is string => !!c))]}
              save={(patch) => run(() => updateNode(t.id, patch))}
            />
            <NavFlags layout={layout} navRef={`topic:${t.id}`} defaults={{ sidebar: true, home: t.parent_id === null }} run={run} />
          </Section>
          <Section title="Mục con" note={kids.length ? `${kids.length} · ${dragNote(true)}` : undefined}>
            <ItemList label="Mục con" items={tocList(topicToc, topicToc.items.filter((r) => r.parent_id === t.id))} add={addTopic(t)} />
          </Section>
          <Section title="Nội dung trang">{nodePage('topic', t.id)}</Section>
        </>
      )
      break
    }
    case 'tag': {
      const k = vocab.keywords.find((x) => x.id === picked.id)
      if (!k) break
      crumbs = [siteCrumb('blog'), groupCrumb('tags', 'Tag')]
      title = k.label
      rename = (v) => run(() => renameKeyword(k.id, v))
      address = toPath({ area: 'public', screen: 'module', moduleId: `${TAG_PAGE}${k.id}` })
      preview = address
      facts = [posts(k.posts)]
      actions = deleteOf(picked) ?? []
      body = (
        <>
          {errorLine}
          {retiring && (
            <RetireTag
              tag={k}
              others={tags.filter((x) => x.id !== k.id)}
              count={k.posts}
              onCancel={() => setRetiringFor(null)}
              onRetire={(to) => undoable(() => retireKeyword(k, to), () => setPicked({ kind: 'group', id: 'tags' }))}
            />
          )}
          <Section title="Thông tin">
            <NavFlags layout={layout} navRef={`tag:${k.id}`} defaults={{ sidebar: false, home: false }} run={run} />
          </Section>
          <Section title="Nội dung trang">{nodePage('keyword', k.id)}</Section>
        </>
      )
      break
    }
    case 'module': {
      crumbs = [siteCrumb('blog'), groupCrumb('modules', 'Phần chung')]
      title = modules.find((m) => m.id === picked.id)?.title ?? picked.id
      actions = fixed('hình trang chỉ sửa được; trang nào mượn thì đổi ở trang ấy')
      // A module is not a page of its own since the pages moved onto the topic
      // tree; it is previewed on the page that wears it.
      const w = wearer(picked.id)
      if (w) preview = w.screen === 'notes' ? toPath({ area: 'public', screen: 'notes' }) : toPath({ area: 'public', screen: 'module', moduleId: w.id })
      facts = [!w ? 'chưa trang nào mượn' : w.source === 'module' ? 'trang của riêng nó' : `trang ${w.title} đang mượn`]
      body = <Section title="Giao diện">{renderModule(picked.id)}</Section>
      break
    }
    case 'practice':
      crumbs = [siteCrumb('practice')]
      title = 'Ghi 02'
      preview = toPath({ area: 'practice', screen: 'hours' })
      address = preview
      actions = fixed('trang hệ thống, không xoá được')
      body = <Section title="Thông tin">{renderPractice()}</Section>
      break
    case 'group': {
      const g = picked.id
      actions = fixed('nhóm của site, không xoá được; xoá từng mục bên trong')
      if (g === 'port-pages') {
        crumbs = [siteCrumb('port')]
        title = 'Mục lục'
        preview = '/'
        facts = [`${livePort.length} trang`]
        body = (
          <>
            {errorLine}
            <Section title="Các trang" note={`theo thứ tự thanh trên · ${dragNote(false)}`}>
              <ItemList label="Các trang" items={tocList(portToc, portToc.items)} add={addPortPage} />
            </Section>
          </>
        )
      } else if (g === 'topics') {
        crumbs = [siteCrumb('blog')]
        title = 'Mục lục'
        preview = toPath({ area: 'public', screen: 'home' })
        address = preview
        const subjects = sorted.filter((t) => t.parent_id === null)
        facts = [`${subjects.length} subject`]
        body = (
          <>
            {errorLine}
            <Section title="Các subject" note={`theo thứ tự thanh bên · ${dragNote(true)}`}>
              <ItemList label="Các subject" items={tocList(topicToc, topicToc.items.filter((r) => r.parent_id === null))} add={addTopic(null)} />
            </Section>
            <Section title="Chữ cố định">{renderCopy('index')}</Section>
          </>
        )
      } else if (g === 'tags') {
        crumbs = [siteCrumb('blog')]
        title = 'Tag'
        facts = [`${tags.length} tag`]
        body = (
          <>
            {errorLine}
            <Section title="Các tag" note="xếp theo tên · mỗi tag là một trang">
              <ItemList
                label="Các tag"
                items={tags.map((k) => ({ id: k.id, name: k.label, meta: leafMeta('keyword', k.id, k.posts), onOpen: pick({ kind: 'tag', id: k.id }), actions: deleteOf({ kind: 'tag', id: k.id }) }))}
                add={{ label: 'Thêm tag', placeholder: 'tên tag', onSave: (label) => run(() => createKeyword(label)) }}
              />
            </Section>
          </>
        )
      } else if (g === 'curated') {
        crumbs = [siteCrumb('blog')]
        title = 'Trang chọn tay'
        facts = [`${curated.length} trang`]
        body = (
          <>
            {errorLine}
            <Section title="Các trang" note="mỗi trang tự chọn kéo bài nào, xếp ra sao">
              <ItemList
                label="Các trang"
                items={curated.map((p) => ({ id: p.id, name: p.title || p.id, meta: `/${p.id}`, onOpen: pick({ kind: 'curated', id: p.id }), actions: deleteOf({ kind: 'curated', id: p.id }) }))}
                add={{
                  label: 'Thêm trang',
                  placeholder: 'tên trang mới',
                  onSave: (name) => {
                    const id = toSlug(name)
                    if (id) run(async () => (await createPage(id, name), setPicked({ kind: 'curated', id })))
                  },
                }}
              />
            </Section>
          </>
        )
      } else if (g === 'port-parts') {
        crumbs = [siteCrumb('port')]
        title = 'Phần chung'
        body = (
          <Section title="Các phần" note="mọi trang port dùng chung">
            <ItemList label="Các phần" items={PORT_PARTS.filter((x) => x.part !== 'about').map((x) => ({ id: x.part, name: x.title, onOpen: pick({ kind: 'port-part', part: x.part }) }))} />
          </Section>
        )
      } else {
        crumbs = [siteCrumb('blog')]
        title = 'Phần chung'
        body = (
          <Section title="Hình trang" note="dàn trang, ảnh và chữ mà một trang mượn">
            <ItemList label="Hình trang" items={moduleRows.map(({ row, depth }) => ({ id: row.id, name: row.title, depth, dot: row.accent, meta: wearer(row.id) ? undefined : 'chưa dùng', onOpen: pick({ kind: 'module', id: row.id }) }))} />
          </Section>
        )
      }
      break
    }
  }

  const header = <DetailHead crumbs={crumbs} title={title} rename={rename} address={address} facts={facts} actions={actions} />

  // The port builder draws its own preview into the slot; everything else gets the public page.
  const previewPane =
    slot && picked.kind !== 'port-page'
      ? createPortal(
          preview ? (
            <ScaledPreview>
              <iframe key={`${preview}#${previewKey}`} title={`xem trước ${title}`} src={preview} style={{ width: '100%', height: '100%', border: 0 }} />
            </ScaledPreview>
          ) : (
            <div style={{ padding: 24, fontFamily: sans, fontSize: 13, color: ink.muted }}>Mục này không có trang riêng để xem trước.</div>
          ),
          slot,
        )
      : null

  const previewStyle = { background: paper.white, border: `1px solid ${paper.rule}`, borderRadius: radius, overflow: 'hidden', pointerEvents: split.dragging || treeSplit.dragging ? 'none' : undefined } as const

  return (
    // The desk: every panel of the detail and every card of the tree sits on it.
    <div style={{ background: desk.ground }}>
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
      <div style={columns === 2 ? { gridRow: '1 / span 2' } : undefined}>{tree}</div>
      {columns > 1 && <div style={{ alignSelf: 'stretch', ...(columns === 2 ? { gridRow: '1 / span 2' } : {}) }}>{treeSplit.handle}</div>}
      <div ref={editor} className="cfg-detail" style={{ minWidth: 0, scrollMarginTop: 16, ...(columns === 3 ? { position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto', paddingRight: 8 } : {}) }}>
        {header}
        {body}
        {undo && (
          <div role="status" style={{ position: 'sticky', bottom: 0, marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', background: desk.panel, border: `1px solid ${ink.border}`, borderRadius: radius, boxShadow: '0 -6px 18px rgba(35,33,26,.08)', padding: '10px 14px', fontFamily: sans, fontSize: 14, color: ink.base }}>
            <span style={{ flex: 1 }}>
              <span>{undo.msg}</span>
              {undo.saving && <span style={{ color: ink.soft }}> · đang lưu…</span>}
            </span>
            <button
              type="button"
              disabled={undo.saving}
              onClick={() => {
                const u = undo
                setUndo(null)
                run(u.revert)
              }}
              className="cfg-btn"
              style={{ ...frame, height: 32, ...(undo.saving ? { color: ink.muted, borderColor: desk.field, cursor: 'not-allowed' } : {}) }}
            >
              Hoàn tác
            </button>
            <button type="button" aria-label="Đóng" onClick={() => setUndo(null)} className="cfg-btn" style={{ ...frame, height: 32, width: 32, padding: 0, borderColor: 'transparent', color: ink.strong }}>
              ✕
            </button>
          </div>
        )}
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
