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
import type { PresetKey } from '../../portfolio/blocks'
import { ink, paper, sans, serif } from '../../design/tokens'
import { radius } from '../../design/controls'
import { FlatSettings, TopicSettings } from './ContentWorkspace'
import { Builder, ContentTab, createFromPreset, usePortAdmin, useSplit, type PortPart } from './PortEditors'
import { ScaledPreview, useWidth } from './ScaledPreview'
import {
  describePage,
  NavEditor,
  navItemsOf,
  NodePage,
  PageEditor,
  PORT_PARTS,
  TEMPLATE_TITLES,
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
 */

type Group = 'port-pages' | 'port-parts' | 'topics' | 'tags' | 'curated' | 'templates' | 'modules'

type Picked =
  | BlogSelected
  | { kind: 'group'; id: Group }
  | { kind: 'port-part'; part: PortPart }
  | { kind: 'port-page'; id: string }
  | { kind: 'nav' }
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
function whereIn(e: { clientY: number; currentTarget: HTMLElement }): DropWhere {
  const box = e.currentTarget.getBoundingClientRect()
  const part = (e.clientY - box.top) / box.height
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

function SiteLabel({ name, path }: { name: string; path: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: sans, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: ink.faint, margin: '14px 2px 2px' }}>
      {name}
      <span style={{ letterSpacing: 0, textTransform: 'none', fontFamily: 'ui-monospace, Menlo, monospace' }}>{path}</span>
    </div>
  )
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
  const [picked, setPicked] = useState<Picked>({ kind: 'system', key: 'landing' })
  const [err, setErr] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [portRound, setPortRound] = useState(0)
  const [undo, setUndo] = useState<{ msg: string; revert: () => Promise<unknown> } | null>(null)
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setFolded((f) => {
      const next = new Set(f)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const fold = (id: string) => ({ open: !folded.has(id), toggle: () => toggle(id) })

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

  // ── the topic tree's drag ──────────────────────────────────────────────
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; where: DropWhere } | null>(null)
  const sorted = [...vocab.topics].sort((a, b) => a.sort_order - b.sort_order)
  const topicTree = buildTree(sorted)
  // The order the tree is drawn in, which `planMove` keeps for everything it does not move.
  const shown = flattenTree(topicTree).map((n) => n.row)
  const plan = (target: string, where: DropWhere) => (dragging ? planMove(shown, dragging, target, where) : null)
  const titleOf = (id: string | null) => (id ? (vocab.topics.find((t) => t.id === id)?.title ?? id) : 'tầng trên cùng')

  function dropTopic(target: string, where: DropWhere) {
    const id = dragging
    const p = plan(target, where)
    setDragging(null)
    setDropAt(null)
    if (!id || !p) return
    if ('error' in p) return setErr(p.error)
    const from = vocab.topics.find((t) => t.id === id)?.parent_id ?? null
    const oldOrder = shown.map((t) => t.id)
    run(async () => {
      // Parent first: the order only means anything once the node sits where it is going.
      if (from !== p.parentId) await updateTopic(id, { parent_id: p.parentId })
      await reorderTopics(p.order)
      // A drop inside a folded node opens it, so the row does not vanish.
      if (p.parentId)
        setFolded((f) => {
          const next = new Set(f)
          next.delete(`t:${p.parentId}`)
          return next
        })
      setUndo({
        msg: `Đã chuyển ${titleOf(id)} ${WHERE_WORDS[where]} ${titleOf(target)}`,
        revert: async () => {
          if (from !== p.parentId) await updateTopic(id, { parent_id: from })
          await reorderTopics(oldOrder)
        },
      })
    })
  }

  const dragOf = (id: string): DragProps => ({
    onDragStart: (e) => {
      e.dataTransfer?.setData('text/plain', id)
      setDragging(id)
    },
    onDragOver: (e) => {
      if (!dragging) return
      e.preventDefault()
      const where = whereIn(e)
      const p = plan(id, where)
      if (!p || 'error' in p) return dropAt && setDropAt(null)
      if (dropAt?.id !== id || dropAt.where !== where) setDropAt({ id, where })
    },
    onDragLeave: () => dropAt?.id === id && setDropAt(null),
    onDrop: (e) => {
      e.preventDefault()
      dropTopic(id, whereIn(e))
    },
    onDragEnd: () => (setDragging(null), setDropAt(null)),
    dragging: dragging === id,
    mark: dropAt?.id === id && dragging !== id ? dropAt.where : null,
  })

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
  const templates = layout.pages.filter((p) => p.kind.startsWith('template_'))
  const livePort = port.pages.filter((p) => p.status !== 'archived')
  const archivedPort = port.pages.filter((p) => p.status === 'archived')
  const overrideOf = (type: 'topic' | 'keyword', id: string) => layout.overrides.find((o) => o.node_type === type && o.node_id === id)
  const nodeCount = (type: 'topic' | 'keyword', id: string) => {
    const page = findPage(pages, type === 'keyword' ? `${TAG_PAGE}${id}` : id)
    return page ? postsOf(page.id).length : 0
  }
  const leafMeta = (type: 'topic' | 'keyword', id: string) => `${overrideOf(type, id) ? 'riêng · ' : ''}${posts(nodeCount(type, id))}`
  const pick = (p: Picked) => () => setPicked(p)
  const on = (p: Picked) => same(picked, p)
  const blog = `/${activeWords().bean}`

  const topicNode = ({ row: t, children, depth }: (typeof topicTree)[number]): ReactNode => (
    <div key={t.id}>
      <Leaf
        name={t.title}
        depth={depth}
        dot={t.accent ?? ancestorsOf(sorted, t.id).reverse().find((a) => a.accent)?.accent ?? null}
        meta={leafMeta('topic', t.id)}
        on={on({ kind: 'topic', id: t.id })}
        fold={children.length ? fold(`t:${t.id}`) : undefined}
        drag={dragOf(t.id)}
        onClick={pick({ kind: 'topic', id: t.id })}
      />
      {!folded.has(`t:${t.id}`) && children.map(topicNode)}
    </div>
  )
  const moduleRows = flattenTree(buildTree([...modules].sort(bySiteOrder)))
  // A module is shown when no ancestor of it is folded.
  const hidden = (id: string): boolean => {
    const parent = modules.find((x) => x.id === id)?.parent_id
    return !!parent && parent !== id && (folded.has(`m:${parent}`) || hidden(parent))
  }
  const groupCard = (id: Group, title: string, note: string) => <Card title={title} note={note} on={on({ kind: 'group', id })} fold={fold(id)} onClick={pick({ kind: 'group', id })} />
  const openGroup = (id: Group) => !folded.has(id)

  const tree = (
    <nav
      aria-label="Cây cấu hình"
      onKeyDown={walk}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, ...(columns === 1 ? {} : { position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto' }), padding: '0 4px 24px 0' }}
    >
      <SiteLabel name="Port" path="/" />
      <Card title="Trang chủ port" note="Lời chào và các khối của trang /" on={on({ kind: 'port-part', part: 'home' })} onClick={pick({ kind: 'port-part', part: 'home' })} />
      {groupCard('port-pages', 'Các trang port', `${livePort.length} trang · thêm từ mẫu bibi, bibe hay trang trống`)}
      {openGroup('port-pages') && (
        <>
          {livePort.map((p) => (
            <Leaf key={p.id} name={p.title} depth={0} meta={p.status === 'draft' ? 'nháp' : `/${p.slug}`} on={on({ kind: 'port-page', id: p.id })} onClick={pick({ kind: 'port-page', id: p.id })} />
          ))}
          {archivedPort.map((p) => (
            <Leaf key={p.id} name={p.title} depth={0} meta="lưu trữ" on={on({ kind: 'port-page', id: p.id })} onClick={pick({ kind: 'port-page', id: p.id })} />
          ))}
        </>
      )}
      {groupCard('port-parts', 'Phần chung của port', 'About, Signature, thanh trên, chân trang')}
      {openGroup('port-parts') &&
        PORT_PARTS.map((x) => <Leaf key={x.part} name={x.title} depth={0} on={on({ kind: 'port-part', part: x.part })} onClick={pick({ kind: 'port-part', part: x.part })} />)}

      <SiteLabel name="Bean blog" path={`${blog}/…`} />
      <Card title="Trang chủ blog" note={`${toPath({ area: 'public', screen: 'landing' })} · nhãn trên cùng, tên lớn, hai đoạn dẫn`} on={on({ kind: 'system', key: 'landing' })} onClick={pick({ kind: 'system', key: 'landing' })} />
      <Card title="Mục lục" note={`${toPath({ area: 'public', screen: 'home' })} · tiêu đề, đoạn dẫn, ảnh khay`} on={on({ kind: 'system', key: 'index' })} onClick={pick({ kind: 'system', key: 'index' })} />
      <Card title="Lưu trữ" note="Chữ cố định của trang lưu trữ" on={on({ kind: 'system', key: 'archive' })} onClick={pick({ kind: 'system', key: 'archive' })} />
      <Card title="Điều hướng" note={`${navItemsOf(layout.pages.find((p) => p.kind === 'nav'), vocab.topics).length} mục ở thanh bên và trang chủ blog`} on={on({ kind: 'nav' })} onClick={pick({ kind: 'nav' })} />
      {groupCard('topics', 'Cây chủ đề', 'Mỗi mục là một trang. Thêm mục ở bên phải; kéo ⋮⋮ để đổi chỗ')}
      {openGroup('topics') && topicTree.map(topicNode)}
      {groupCard('tags', 'Tag', `${vocab.keywords.length} tag · mỗi tag là một trang`)}
      {openGroup('tags') &&
        vocab.keywords.map((k) => <Leaf key={k.id} name={k.label} depth={0} meta={leafMeta('keyword', k.id)} on={on({ kind: 'tag', id: k.id })} onClick={pick({ kind: 'tag', id: k.id })} />)}
      {groupCard('curated', 'Trang chọn tay', 'Trang có quy chế riêng, như Ghi')}
      {openGroup('curated') &&
        curated.map((p) => {
          const page = findPage(pages, p.id)
          return <Leaf key={p.id} name={p.title || p.id} depth={0} meta={posts(page ? postsOf(page.id).length : 0)} on={on({ kind: 'curated', id: p.id })} onClick={pick({ kind: 'curated', id: p.id })} />
        })}
      {groupCard('templates', 'Mẫu', 'Quy chế chung của trang subject, topic và tag')}
      {openGroup('templates') &&
        templates.map((p) => <Leaf key={p.id} name={TEMPLATE_TITLES[p.kind] ?? p.kind} depth={0} on={on({ kind: 'template', id: p.id })} onClick={pick({ kind: 'template', id: p.id })} />)}
      {groupCard('modules', 'Hình trang', 'Module mà một trang mượn dàn trang, ảnh và chữ')}
      {openGroup('modules') &&
        moduleRows
          .filter(({ row }) => !hidden(row.id))
          .map(({ row, depth, children }) => (
            <Leaf
              key={row.id}
              name={row.title}
              depth={depth}
              dot={row.accent}
              on={on({ kind: 'module', id: row.id })}
              fold={children.length ? fold(`m:${row.id}`) : undefined}
              onClick={pick({ kind: 'module', id: row.id })}
            />
          ))}

      <SiteLabel name="Practice" path={toPath({ area: 'practice', screen: 'hours' })} />
      <Card title="Ghi 02" note="Nhật ký giờ luyện, sau đăng nhập" on={on({ kind: 'practice' })} onClick={pick({ kind: 'practice' })} />

      {undo && (
        <div role="status" style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 10, alignItems: 'center', background: paper.cream, border: `1px solid ${ink.border}`, borderRadius: radius, padding: '8px 10px', fontFamily: sans, fontSize: 12, color: ink.base }}>
          <span style={{ flex: 1 }}>{undo.msg}</span>
          <button
            type="button"
            onClick={() => {
              const u = undo
              setUndo(null)
              run(u.revert)
            }}
            style={{ all: 'unset', cursor: 'pointer', color: ink.green, fontWeight: 500 }}
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
      onOpenTemplate={(id) => setPicked({ kind: 'template', id })}
      renderCopy={renderCopy}
      renderModule={renderModule}
    />
  )

  switch (picked.kind) {
    case 'port-part': {
      const title = picked.part === 'home' ? 'Trang chủ' : PORT_PARTS.find((x) => x.part === picked.part)?.title ?? picked.part
      crumbs = ['Port', title]
      preview = toPath({ area: 'public', screen: picked.part === 'about' || picked.part === 'sign' ? 'portfolioAbout' : 'portfolioHome' })
      address = preview
      previewKey = portRound
      body = port.loaded ? <ContentTab key={picked.part} only={picked.part} content={port.content} setStored={port.setContentStored} pages={port.pages} /> : null
      break
    }
    case 'port-page': {
      const p = port.pages.find((x) => x.id === picked.id)
      crumbs = ['Port', 'Các trang port', p?.title ?? picked.id]
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
    case 'curated':
    case 'template': {
      const d = describePage(picked, layout, pages)
      const where = picked.kind === 'curated' ? 'Trang chọn tay' : picked.kind === 'template' ? 'Mẫu' : null
      crumbs = ['Bean blog', ...(where ? [where] : []), picked.kind === 'system' && picked.key === 'landing' ? 'Trang chủ blog' : d.title]
      preview = d.preview
      address = d.preview
      body = page(picked)
      break
    }
    case 'override':
      // Not opened from the tree: a node's own settings show inside its topic or tag.
      break
    case 'nav':
      crumbs = ['Bean blog', 'Điều hướng']
      preview = toPath({ area: 'public', screen: 'landing' })
      body = (
        <>
          {errorLine}
          <p style={hint}>Kéo ⋮⋮ để đổi thứ tự. Bỏ chọn để giấu một mục khỏi thanh bên hay khỏi trang chủ blog.</p>
          <NavEditor layout={layout} topics={vocab.topics} pages={pages} postsOf={postsOf} run={run} />
        </>
      )
      break
    case 'topic': {
      const t = vocab.topics.find((x) => x.id === picked.id)
      if (!t) break
      const path = [...ancestorsOf(sorted, t.id), t].map((x) => x.title)
      crumbs = ['Bean blog', 'Cây chủ đề', ...path]
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
              tree={shown}
              count={t.posts}
              used={[...new Set(vocab.topics.map((x) => x.accent).filter((c): c is string => !!c))]}
              save={(patch) => run(() => updateTopic(t.id, patch))}
            />
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
      crumbs = ['Bean blog', 'Tag', k.label]
      named = true
      address = toPath({ area: 'public', screen: 'module', moduleId: `${TAG_PAGE}${k.id}` })
      preview = address
      body = (
        <>
          {errorLine}
          <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
            <FlatSettings key={k.id} kind="Tag" entry={k} count={k.posts} onRename={(label) => run(() => renameKeyword(k.id, label))} />
          </div>
          <div style={sectionHead}>Trang</div>
          {nodePage('keyword', k.id)}
        </>
      )
      break
    }
    case 'module':
      crumbs = ['Bean blog', 'Hình trang', modules.find((m) => m.id === picked.id)?.title ?? picked.id]
      body = renderModule(picked.id)
      break
    case 'practice':
      crumbs = ['Practice', 'Ghi 02']
      preview = toPath({ area: 'practice', screen: 'hours' })
      address = preview
      body = renderPractice()
      break
    case 'group': {
      const g = picked.id
      if (g === 'port-pages') {
        crumbs = ['Port', 'Các trang port']
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
            <p style={hint}>Chọn một trang ở cây bên trái để sửa, hoặc thêm trang mới.</p>
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
        crumbs = ['Bean blog', 'Cây chủ đề']
        preview = toPath({ area: 'public', screen: 'home' })
        body = (
          <>
            {errorLine}
            <p style={hint}>
              Mỗi mục trong cây là một trang của blog. Chọn một mục ở bên trái để sửa tên, màu, lời dẫn và trang của nó. Muốn đổi chỗ thì nắm ⋮⋮ ở cuối dòng và kéo: thả vào giữa một dòng là cho vào trong mục đó, thả vào mép trên hay mép dưới là đặt trước hay sau.
            </p>
            <div style={sectionHead}>Subject mới</div>
            <AddField label="Thêm subject" placeholder="tên subject" onAdd={(title) => run(() => createTopic(title, null))} />
          </>
        )
      } else if (g === 'tags') {
        crumbs = ['Bean blog', 'Tag']
        body = (
          <>
            {errorLine}
            <p style={hint}>Chọn một tag ở bên trái để đổi tên hay chỉnh trang của nó. Gộp và xoá tag ở tab Nội dung, nơi thấy bài nào sẽ bị đổi.</p>
            <div style={sectionHead}>Tag mới</div>
            <AddField label="Thêm tag" placeholder="tên tag" onAdd={(label) => run(() => createKeyword(label))} />
          </>
        )
      } else if (g === 'curated') {
        crumbs = ['Bean blog', 'Trang chọn tay']
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
        crumbs = g === 'port-parts' ? ['Port', 'Phần chung'] : ['Bean blog', g === 'templates' ? 'Mẫu' : 'Hình trang']
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

  const previewStyle = { background: paper.white, border: `1px solid ${paper.rule}`, borderRadius: radius, overflow: 'hidden', pointerEvents: split.dragging ? 'none' : undefined } as const

  return (
    <div
      ref={root}
      style={{
        display: 'grid',
        gridTemplateColumns: columns === 3 ? `minmax(220px, 264px) ${split.columns}` : columns === 2 ? 'minmax(220px, 264px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
        // Each cell keeps its own height, which is what lets the tree and the preview stick.
        alignItems: 'start',
        columnGap: columns === 3 ? 12 : 28,
        rowGap: 20,
        padding: columns === 1 ? '24px 16px 90px' : '28px 32px 120px',
      }}
    >
      <style>{'.cfg-leaf .cfg-grip{opacity:0}.cfg-leaf:hover .cfg-grip,.cfg-leaf:focus-within .cfg-grip{opacity:1}'}</style>
      <div style={columns === 2 ? { gridRow: '1 / span 2' } : undefined}>{tree}</div>
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
          ...(columns === 2 ? { gridColumn: 2 } : {}),
        }}
      />
      {previewPane}
    </div>
  )
}
