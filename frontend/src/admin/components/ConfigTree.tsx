import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { listKeywords, listTopics, renameKeyword, updateTopic, type Keyword, type Module, type Topic } from '../lib/apiClient'
import { buildTree, flattenTree } from '../../lib/contentTree'
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
 * module tree became the topic tree (subject › topic), tags are the keyword
 * vocabulary, and modules survive only as the looks a page can borrow — so
 * they are listed under Hình trang and edited, never created or nested, here.
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
  { id: 'topics', t: 'Cây chủ đề', d: 'Subject và topic: tên, màu, lời dẫn, quyền xem' },
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

function Leaf({
  name,
  depth,
  on,
  dot,
  meta,
  fold,
  onClick,
}: {
  name: string
  depth: number
  on: boolean
  dot?: string | null
  meta?: string
  /** Present on a node that has children: whether they are shown, and the toggle. */
  fold?: { open: boolean; toggle: () => void }
  onClick: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginLeft: depth * INDENT, borderLeft: `1px solid ${paper.rule}` }}>
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

  useEffect(() => {
    Promise.all([listTopics(), listKeywords()])
      .then(([t, k]) => {
        setTopics(t)
        setKeywords(k)
      })
      .catch((e) => toast.fromError(e))
  }, [toast])

  const sorted = useMemo(() => [...topics].sort((a, b) => a.sort_order - b.sort_order), [topics])
  const subjects = sorted.filter((t) => t.parent_id === null)
  const kidsOf = (id: string) => sorted.filter((t) => t.parent_id === id)
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
      {branchOpen('topics') &&
        subjects.map((s) => {
          const kids = kidsOf(s.id)
          const open = !folded.has(`t:${s.id}`)
          return (
            <div key={s.id}>
              <Leaf
                name={s.title}
                depth={0}
                dot={s.accent}
                meta={String(s.posts)}
                on={same(picked, { kind: 'topic', id: s.id })}
                fold={kids.length ? { open, toggle: () => toggle(`t:${s.id}`) } : undefined}
                onClick={() => setPicked({ kind: 'topic', id: s.id })}
              />
              {open &&
                kids.map((t) => (
                  <Leaf key={t.id} name={t.title} depth={1} dot={t.accent ?? s.accent} meta={String(t.posts)} on={same(picked, { kind: 'topic', id: t.id })} onClick={() => setPicked({ kind: 'topic', id: t.id })} />
                ))}
            </div>
          )
        })}

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
            subjects={subjects}
            tree={subjects.flatMap((s) => [s, ...kidsOf(s.id)])}
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
