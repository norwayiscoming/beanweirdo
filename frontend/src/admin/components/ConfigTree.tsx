import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { createTopic, listKeywords, listTopics, renameKeyword, reorderTopics, updateTopic, type Keyword, type Module, type Topic } from '../lib/apiClient'
import { ancestorsOf, buildTree, flattenTree } from '../../lib/contentTree'
import { planMove, type DropWhere } from '../../lib/treeMove'
import { bySiteOrder } from '../../lib/moduleOrder'
import { TAG_PAGE, toPath } from '../../lib/routes'
import { ink, paper, sans, serif } from '../../design/tokens'
import { radius } from '../../design/controls'
import { useToast } from '../../design/Toaster'
import { FlatSettings, TopicSettings } from './ContentWorkspace'
import type { SystemPage } from './PagesManager'

/**
 * Cấu hình — the fork's old two-column settings screen, back at its own
 * address (`/ad-cau-hinh`).
 *
 * Before PR #61 it was a sticky index of five subjects on the left and their
 * fields on the right. The owner asked for it back because a tree you click
 * into is faster to work through than Quản lý trang's per-page editor plus a
 * live preview. The subjects are the same five, read from today's data: the
 * module tree became the topic tree (subject › topic) — the site's real page
 * tree, so it is where adding and dragging into and out of a branch lives —
 * tags are the keyword vocabulary, and modules survive only as the looks a
 * page can borrow, so they are listed under Hình trang and edited, never
 * created or nested, here.
 */

type CopyKey = Extract<SystemPage, 'landing' | 'index' | 'notes'>

type Picked =
  | { kind: 'copy'; key: CopyKey }
  | { kind: 'topic'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'module'; id: string }

/** The branches that fold, named once so their fold state has stable keys. */
type Branch = 'topics' | 'tags' | 'modules'

const COPY: { key: CopyKey; t: string; d: string }[] = [
  { key: 'landing', t: 'Trang chủ', d: 'Nhãn trên cùng, tên lớn hai dòng, hai đoạn dẫn' },
  { key: 'index', t: 'Trang mục lục', d: 'Tiêu đề, hai đoạn dẫn và ba ảnh khay' },
  { key: 'notes', t: 'Trang Ghi chép', d: 'Tiêu đề, đoạn dẫn, dòng hướng dẫn, câu trích, lời kết' },
]

const BRANCHES: { id: Branch; t: string; d: string }[] = [
  { id: 'topics', t: 'Cây chủ đề', d: 'Thêm, kéo vào trong hay ra ngoài; tên, màu, lời dẫn' },
  { id: 'tags', t: 'Tag', d: 'Đổi tên tag; gộp và xoá ở tab Nội dung' },
  { id: 'modules', t: 'Hình trang', d: 'Module mà một trang mượn dàn trang, ảnh và chữ' },
]

/** One gap per level, and the guide line sits in it — as the old module tree drew it. */
const INDENT = 16

const same = (a: Picked | null, b: Picked) => !!a && JSON.stringify(a) === JSON.stringify(b)

function Card({ title, note, on, open, onClick }: { title: string; note: string; on: boolean; open?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="ab-box"
      aria-current={on}
      aria-expanded={open}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: on ? paper.hover : paper.white,
        border: `1px solid ${on ? ink.border : paper.rule}`,
        borderRadius: radius,
        padding: '12px 14px 13px',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: serif, fontSize: 17, lineHeight: 1.15, letterSpacing: '-.02em', color: ink.base }}>
        {title}
        {open !== undefined && <span aria-hidden style={{ fontFamily: sans, fontSize: 11, color: ink.muted }}>{open ? '▾' : '▸'}</span>}
      </div>
      <div style={{ fontFamily: sans, fontWeight: 300, fontSize: 11.5, lineHeight: 1.4, color: ink.muted, marginTop: 5 }}>{note}</div>
    </button>
  )
}

type TopicNode = ReturnType<typeof buildTree<Topic>>[number]

type DragProps = {
  onDragStart: () => void
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

/** A "+" line that turns into a name field; Enter adds, Esc or leaving cancels. */
function AddRow({ label, depth, onAdd }: { label: string; depth: number; onAdd: (title: string) => void }) {
  const [typing, setTyping] = useState(false)
  if (!typing)
    return (
      <button
        type="button"
        onClick={() => setTyping(true)}
        style={{ all: 'unset', cursor: 'pointer', marginLeft: depth * INDENT + 22, padding: '4px 8px', fontFamily: sans, fontSize: 12, color: ink.green }}
      >
        + {label}
      </button>
    )
  return (
    <input
      autoFocus
      aria-label={label}
      placeholder={label}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setTyping(false)
        if (e.key !== 'Enter') return
        const v = e.currentTarget.value.trim()
        setTyping(false)
        if (v) onAdd(v)
      }}
      onBlur={() => setTyping(false)}
      style={{ marginLeft: depth * INDENT + 22, boxSizing: 'border-box', width: `calc(100% - ${depth * INDENT + 22}px)`, border: `1px solid ${ink.green}`, background: paper.white, fontFamily: sans, fontSize: 13, padding: '4px 8px', outline: 'none' }}
    />
  )
}

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
  /** Present on a node that has children: whether they are shown, and the toggle. */
  fold?: { open: boolean; toggle: () => void }
  /** Present on a node that can be dragged and dropped on. */
  drag?: DragProps
  onClick: () => void
}) {
  const mark = drag?.mark
  return (
    <div
      draggable={!!drag}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDragLeave={drag?.onDragLeave}
      onDrop={drag?.onDrop}
      onDragEnd={drag?.onDragEnd}
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
        cursor: drag ? 'grab' : undefined,
      }}
    >
      <button
        type="button"
        aria-label={fold ? `${fold.open ? 'Gập' : 'Mở'} ${name}` : undefined}
        aria-expanded={fold?.open}
        tabIndex={fold ? 0 : -1}
        onClick={fold?.toggle}
        style={{ all: 'unset', width: 18, textAlign: 'center', fontSize: 10, color: ink.muted, cursor: fold ? 'pointer' : 'default', visibility: fold ? 'visible' : 'hidden' }}
      >
        {fold?.open ? '▾' : '▸'}
      </button>
      <button
        type="button"
        aria-current={on}
        onClick={onClick}
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
          fontFamily: sans,
          fontSize: 13,
          color: ink.base,
        }}
      >
        {dot !== undefined && <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: dot ?? 'transparent', border: dot ? 'none' : `1.5px solid ${paper.rule}` }} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: on ? 500 : 400 }}>{name}</span>
        {meta && <span style={{ fontSize: 11, color: ink.faint, fontVariantNumeric: 'tabular-nums' }}>{meta}</span>}
      </button>
    </div>
  )
}

export function ConfigTree({
  modules,
  renderCopy,
  renderModule,
}: {
  modules: Module[]
  renderCopy: (key: CopyKey) => ReactNode
  renderModule: (moduleId: string) => ReactNode
}) {
  const toast = useToast()
  const [topics, setTopics] = useState<Topic[]>([])
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [picked, setPick] = useState<Picked | null>({ kind: 'copy', key: 'landing' })
  const detail = useRef<HTMLDivElement>(null)
  // The tree is long and sticks; the detail is not. A pick far down the tree
  // would open its fields above the fold — or, on a phone, below the whole
  // tree — so bring them into view.
  const setPicked = (next: Picked | null) => {
    setPick(next)
    const top = detail.current?.getBoundingClientRect().top ?? 0
    if (top < 0 || top > window.innerHeight - 80) detail.current?.scrollIntoView?.({ block: 'start' })
  }
  // Branches start open; a subject or module folds on its own arrow.
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setFolded((f) => {
      const next = new Set(f)
      if (!next.delete(id)) next.add(id)
      return next
    })

  // ── topic tree: add, and drag into, out of and between branches ─────────
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; where: DropWhere } | null>(null)
  // The order the tree is drawn in, which `planMove` keeps for everything it does not move.
  const shownTopics = () => flattenTree(buildTree([...topics].sort((a, b) => a.sort_order - b.sort_order))).map((n) => n.row)
  const plan = (target: string, where: DropWhere) => (dragging ? planMove(shownTopics(), dragging, target, where) : null)

  const reload = () =>
    listTopics()
      .then(setTopics)
      .catch((e) => toast.fromError(e))

  async function dropTopic(target: string, where: DropWhere) {
    const id = dragging
    const p = plan(target, where)
    setDragging(null)
    setDropAt(null)
    if (!id || !p) return
    if ('error' in p) return toast.error(p.error)
    const before = topics.find((t) => t.id === id)
    try {
      // Parent first: the server checks depth on the parent change, and the
      // order only means anything once the node sits where it is going.
      if ((before?.parent_id ?? null) !== p.parentId) await updateTopic(id, { parent_id: p.parentId })
      await reorderTopics(p.order)
      // A drop inside a folded subject opens it, so the row does not vanish.
      if (p.parentId)
        setFolded((f) => {
          const next = new Set(f)
          next.delete(`t:${p.parentId}`)
          return next
        })
    } catch (e) {
      toast.fromError(e)
    }
    await reload()
  }

  const dragOf = (id: string): DragProps => ({
    onDragStart: () => setDragging(id),
    onDragOver: (e) => {
      e.preventDefault()
      const where = whereIn(e)
      const p = plan(id, where)
      if (!p || 'error' in p) return dropAt && setDropAt(null)
      if (dropAt?.id !== id || dropAt.where !== where) setDropAt({ id, where })
    },
    onDragLeave: () => dropAt?.id === id && setDropAt(null),
    onDrop: (e) => {
      e.preventDefault()
      void dropTopic(id, whereIn(e))
    },
    onDragEnd: () => (setDragging(null), setDropAt(null)),
    dragging: dragging === id,
    mark: dropAt?.id === id && dragging !== id ? dropAt.where : null,
  })

  async function addTopic(title: string, parent: string | null) {
    try {
      const t = await createTopic(title, parent)
      setTopics((ts) => [...ts, t])
      setPicked({ kind: 'topic', id: t.id })
    } catch (e) {
      toast.fromError(e)
    }
  }

  useEffect(() => {
    Promise.all([listTopics(), listKeywords()])
      .then(([t, k]) => {
        setTopics(t)
        setKeywords(k)
      })
      .catch((e) => toast.fromError(e))
  }, [toast])

  const sorted = useMemo(() => [...topics].sort((a, b) => a.sort_order - b.sort_order), [topics])
  const kidsOf = (id: string) => sorted.filter((t) => t.parent_id === id)
  const topicTree = useMemo(() => buildTree(sorted), [sorted])

  /*
   * One node and, unless folded, its branch. The node being edited also gets
   * a "+" line for a new entry inside it — the way to start a deeper level
   * without a "+" on every row of the tree.
   */
  const topicNode = ({ row: t, children, depth }: TopicNode): ReactNode => {
    const open = !folded.has(`t:${t.id}`)
    const editing = same(picked, { kind: 'topic', id: t.id })
    return (
      <div key={t.id}>
        <Leaf
          name={t.title}
          depth={depth}
          dot={t.accent ?? ancestorsOf(sorted, t.id).reverse().find((a) => a.accent)?.accent ?? null}
          meta={String(t.posts)}
          on={editing}
          fold={children.length ? { open, toggle: () => toggle(`t:${t.id}`) } : undefined}
          drag={dragOf(t.id)}
          onClick={() => setPicked({ kind: 'topic', id: t.id })}
        />
        {open && children.map(topicNode)}
        {editing && <AddRow label={`mục trong ${t.title}`} depth={depth + 1} onAdd={(title) => void addTopic(title, t.id)} />}
      </div>
    )
  }
  const moduleRows = useMemo(() => flattenTree(buildTree([...modules].sort(bySiteOrder))), [modules])
  // A module is shown when no ancestor of it is folded.
  const hidden = (id: string): boolean => {
    const m = modules.find((x) => x.id === id)
    const parent = m?.parent_id
    return !!parent && parent !== id && (folded.has(`m:${parent}`) || hidden(parent))
  }

  const saveTopic = async (id: string, patch: Parameters<typeof updateTopic>[1]) => {
    try {
      const next = await updateTopic(id, patch)
      setTopics((ts) => ts.map((t) => (t.id === id ? { ...t, ...next } : t)))
    } catch (e) {
      toast.fromError(e)
    }
  }
  const renameTag = async (id: string, label: string) => {
    try {
      await renameKeyword(id, label)
      setKeywords((ks) => ks.map((k) => (k.id === id ? { ...k, label } : k)))
    } catch (e) {
      toast.fromError(e)
    }
  }

  const branchOpen = (b: Branch) => !folded.has(b)
  const close = () => setPicked(null)

  const nav = (
    <nav aria-label="Cây cấu hình" style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
      {COPY.slice(0, 1).map((c) => (
        <Card key={c.key} title={c.t} note={c.d} on={same(picked, { kind: 'copy', key: c.key })} onClick={() => setPicked({ kind: 'copy', key: c.key })} />
      ))}

      <Card title={BRANCHES[0].t} note={BRANCHES[0].d} on={picked?.kind === 'topic'} open={branchOpen('topics')} onClick={() => toggle('topics')} />
      {branchOpen('topics') && topicTree.map(topicNode)}
      {branchOpen('topics') && <AddRow label="subject mới" depth={0} onAdd={(title) => void addTopic(title, null)} />}

      {COPY.slice(1).map((c) => (
        <Card key={c.key} title={c.t} note={c.d} on={same(picked, { kind: 'copy', key: c.key })} onClick={() => setPicked({ kind: 'copy', key: c.key })} />
      ))}

      <Card title={BRANCHES[1].t} note={BRANCHES[1].d} on={picked?.kind === 'tag'} open={branchOpen('tags')} onClick={() => toggle('tags')} />
      {branchOpen('tags') &&
        keywords.map((k) => <Leaf key={k.id} name={k.label} depth={0} meta={String(k.posts)} on={same(picked, { kind: 'tag', id: k.id })} onClick={() => setPicked({ kind: 'tag', id: k.id })} />)}

      <Card title={BRANCHES[2].t} note={BRANCHES[2].d} on={picked?.kind === 'module'} open={branchOpen('modules')} onClick={() => toggle('modules')} />
      {branchOpen('modules') &&
        moduleRows
          .filter(({ row }) => !hidden(row.id))
          .map(({ row, depth, children }) => (
            <Leaf
              key={row.id}
              name={row.title}
              depth={depth}
              dot={row.accent}
              on={same(picked, { kind: 'module', id: row.id })}
              fold={children.length ? { open: !folded.has(`m:${row.id}`), toggle: () => toggle(`m:${row.id}`) } : undefined}
              onClick={() => setPicked({ kind: 'module', id: row.id })}
            />
          ))}
    </nav>
  )

  let body: ReactNode = (
    <div style={{ fontFamily: sans, fontSize: 13, color: ink.muted, padding: '40px 0' }}>Chọn một mục ở cột bên trái để sửa.</div>
  )
  if (picked?.kind === 'copy') body = renderCopy(picked.key)
  if (picked?.kind === 'module') body = renderModule(picked.id)
  if (picked?.kind === 'topic') {
    const t = topics.find((x) => x.id === picked.id)
    if (t)
      body = (
        <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
          <TopicSettings
            key={t.id}
            topic={t}
            parent={t.parent_id ? topics.find((x) => x.id === t.parent_id) : undefined}
            kids={kidsOf(t.id)}
            tree={flattenTree(topicTree).map((n) => n.row)}
            count={t.posts}
            used={[...new Set(topics.map((x) => x.accent).filter((c): c is string => !!c))]}
            save={(patch) => void saveTopic(t.id, patch)}
            onClose={close}
          />
        </div>
      )
  }
  if (picked?.kind === 'tag') {
    const k = keywords.find((x) => x.id === picked.id)
    if (k)
      body = (
        <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
          <FlatSettings
            key={k.id}
            kind="Tag"
            entry={k}
            count={k.posts}
            others={keywords.filter((x) => x.id !== k.id)}
            address={toPath({ area: 'public', screen: 'module', moduleId: `${TAG_PAGE}${k.id}` })}
            onRename={(label) => void renameTag(k.id, label)}
            onClose={close}
          />
        </div>
      )
  }

  return (
    /*
     * `align-items: start` is what lets the left column stick: a grid stretches
     * each cell to the row's height, and a sticky element inside a cell as
     * tall as the whole content never has room to stick.
     */
    <div
      className="cfg-tree"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 258px) minmax(0, 1fr)', alignItems: 'start', gap: 34, padding: '34px 56px 130px', maxWidth: 1180 }}
    >
      <style>{'@media (max-width:900px){.cfg-tree{grid-template-columns:1fr!important;padding:24px 16px 90px!important}.cfg-tree>nav{position:static!important;max-height:none!important}}'}</style>
      {nav}
      <div ref={detail} style={{ minWidth: 0, scrollMarginTop: 16 }}>{body}</div>
    </div>
  )
}
