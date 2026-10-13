import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  createPost,
  listKeywords,
  listPosts,
  listNodes,
  transitionStatus,
  updatePost,
  type Keyword,
  type PostStatus,
  type PostSummary,
  type StatusAction,
  type Node,
} from '../lib/apiClient'
import { ink, paper, sans, serif } from '../../design/tokens'
import { useNav } from '../../lib/nav'
import { TEMPLATE_KEYS, templateName } from '../../lib/templateNames'
import { usePostAddresses } from '../../data/usePostAddresses'
import { StatusBadge } from './StatusBadge'
import { MovePostDialog } from './MovePostDialog'
import { PostAuthorsDialog } from './PostAuthorsDialog'
import { SectionHead } from './SectionHead'
import { statusLabel } from './NodeFields'
import { ancestorsOf, buildTree, flattenTree } from '../../lib/contentTree'
import { desk, Menu } from './Detail'
import { Button, IconButton } from '../../design/Button'
import { IconClose, IconEdit, IconPlus } from '../../design/icons'
import { radius } from '../../design/controls'

/**
 * Nội dung — the posts and the three vocabularies that file them, on one
 * screen (Phân loại and Quản lý bài used to be two tabs that could not see each
 * other: Phân loại knew a dạng bài had ten posts and could not say which).
 *
 * Left: every vocabulary entry with its live count; a click filters the list.
 * Right: the posts themselves, bulk-editable.
 *
 * Naming, colouring, adding, arranging and deleting topics and tags is Cấu
 * hình's job (owner, 2026-10-08 and 2026-10-13): the tree was in three tabs
 * and a click on the same entry did a different thing in each.
 */

type Vocab = 'topic' | 'tpl' | 'kw'
type Filters = { topic: string | null; tpl: string | null; kw: string | null; status: PostStatus | null }
type Undo = { msg: string; revert?: () => Promise<unknown> }

const isUndo = (u: unknown): u is Undo => !!u && typeof u === 'object' && typeof (u as Undo).msg === 'string'

/** Posts with no place on the tree yet — a filter of their own so none goes unseen. */
const UNPLACED = '__unplaced'

const STATUS_LABEL: Record<PostStatus, string> = { draft: 'Nháp', published: 'Đã đăng', archived: 'Lưu trữ', deleted: 'Thùng rác' }

const ACTIONS_BY_STATUS: Record<PostStatus, { label: string; action: StatusAction }[]> = {
  draft: [
    { label: 'Đăng', action: 'publish' },
    { label: 'Lưu trữ', action: 'archive' },
    { label: 'Xoá', action: 'delete' },
  ],
  published: [
    { label: 'Bỏ đăng', action: 'unpublish' },
    { label: 'Lưu trữ', action: 'archive' },
    { label: 'Xoá', action: 'delete' },
  ],
  archived: [
    { label: 'Khôi phục', action: 'restore' },
    { label: 'Xoá', action: 'delete' },
  ],
  deleted: [
    { label: 'Khôi phục', action: 'restore-trash' },
    { label: 'Xoá vĩnh viễn', action: 'permanently-delete' },
  ],
}

/** What the bulk bar offers; each applies only to the selected posts it is valid for. */
const BULK_STATUS: { action: StatusAction; label: string }[] = [
  { action: 'publish', label: 'Đăng' },
  { action: 'unpublish', label: 'Bỏ đăng' },
  { action: 'archive', label: 'Lưu trữ' },
  { action: 'restore', label: 'Khôi phục' },
  { action: 'delete', label: 'Vào thùng rác' },
  { action: 'restore-trash', label: 'Lấy khỏi thùng rác' },
]

const SEL = '#EEF5F8'
const WARN = '#B4552E'
const label: CSSProperties = { fontFamily: sans, fontSize: 13, fontWeight: 600, color: ink.strong }
const box: CSSProperties = { boxSizing: 'border-box', background: paper.white, border: `1px solid ${paper.rule}`, color: ink.base, fontFamily: sans, fontSize: 13, padding: '6px 9px', outline: 'none', width: '100%' }
const pill: CSSProperties = { display: 'inline-block', fontFamily: sans, fontSize: 13, padding: '0 7px', lineHeight: '18px', border: `1px solid ${paper.rule}`, borderRadius: 10, color: ink.soft, whiteSpace: 'nowrap', cursor: 'pointer', background: 'none', margin: '1px 3px 1px 0' }

const CSS = `
.cw-r:hover{background:${paper.hover}}
.cw-r:focus-visible,.cw-row:focus-within{outline:2px solid ${ink.green};outline-offset:-2px}
.cw-row:hover td{background:${paper.hover}}
.cw-pill:hover{border-color:${ink.green}!important;color:${ink.green}!important}
.cw-unchip{all:unset;cursor:pointer;display:inline-flex;padding:2px;border-radius:4px;color:${ink.soft}}
.cw-unchip:hover{background:rgba(0,0,0,.08);color:${ink.base}}
.cw-unchip:focus-visible{outline:2px solid #2563eb}
@media (max-width:900px){.cw-ws{grid-template-columns:1fr!important}.cw-rail{border-right:none!important;border-bottom:1px solid ${paper.rule};max-height:280px;overflow-y:auto}}
`

function Dot({ own, inherited }: { own: string | null; inherited?: string | null }) {
  return (
    <span
      aria-hidden
      style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', boxSizing: 'border-box', background: own ?? 'transparent', border: own ? 'none' : `1.5px solid ${inherited ?? paper.rule}` }}
    />
  )
}

/** One entry in the left column: a click filters the posts to it. */
function RailRow({
  name,
  count,
  on,
  onClick,
  indent = 14,
  big,
  dot,
  flag,
}: {
  name: string
  count: number
  on: boolean
  onClick: () => void
  indent?: number
  big?: boolean
  dot?: ReactNode
  flag?: string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={on}
      className="cw-r"
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      style={{
        display: 'grid',
        gridTemplateColumns: `${dot ? '9px ' : ''}minmax(0,1fr) auto`,
        gap: 7,
        alignItems: 'center',
        padding: `5px 8px 5px ${indent}px`,
        cursor: 'pointer',
        background: on ? SEL : undefined,
        boxShadow: on ? `inset 3px 0 0 ${ink.green}` : undefined,
      }}
    >
      {dot}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: ink.base, ...(big ? { fontFamily: serif, fontSize: 15.5 } : { fontFamily: sans, fontSize: 13 }) }}>
        {name}
        {flag && <span style={{ fontFamily: sans, fontSize: 13, color: WARN, marginLeft: 6 }}>{flag}</span>}
      </span>
      <span style={{ fontFamily: sans, fontSize: 13, color: count ? ink.soft : ink.soft, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </div>
  )
}

export function ContentWorkspace({ onChanged }: { onChanged?: () => void }) {
  const nav = useNav()
  const addresses = usePostAddresses()
  const [topics, setTopics] = useState<Node[]>([])
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState<Filters>({ topic: null, tpl: null, kw: null, status: null })
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [undo, setUndo] = useState<Undo | null>(null)
  const [busy, setBusy] = useState(false)
  const [moving, setMoving] = useState<PostSummary | null>(null)
  const [naming, setNaming] = useState<PostSummary | null>(null)

  const load = useCallback(
    () =>
      Promise.all([listNodes('blog'), listKeywords(), listPosts('all')])
        .then(([t, k, p]) => {
          setTopics(t)
          setKeywords(k)
          setPosts(p)
        })
        .catch((e: Error) => setErr(e.message)),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])

  /** Every write goes through here: one error line, one reload, the other tabs told. */
  const run = (fn: () => Promise<unknown>, then?: () => void) => {
    setBusy(true)
    void fn()
      .then((u) => {
        setErr(null)
        if (isUndo(u)) setUndo(u)
        then?.()
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => {
        setBusy(false)
        void load()
        onChanged?.()
      })
  }

  // ── derived ──────────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...topics].sort((a, b) => a.sort_order - b.sort_order), [topics])
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics])
  const live = useMemo(() => posts.filter((p) => p.status !== 'deleted'), [posts])
  // A post sits under a node when the node is its topic or any ancestor of it.
  const inTopic = (p: PostSummary, id: string) =>
    id === UNPLACED ? !p.topic_id : p.topic_id === id || (!!p.topic_id && ancestorsOf(topics, p.topic_id).some((a) => a.id === id))
  /** The whole tree, parents before their children, at any depth. */
  const shown = useMemo(() => flattenTree(buildTree(sorted)), [sorted])
  const kwOf = (p: PostSummary) => p.keywords ?? []
  const postsOf = (vocab: Vocab, id: string, from = live) =>
    from.filter((p) => (vocab === 'topic' ? inTopic(p, id) : vocab === 'tpl' ? p.template === id : kwOf(p).includes(id)))

  const visible = posts
    .filter((p) => (f.status ? p.status === f.status : p.status !== 'deleted'))
    .filter((p) => !f.topic || inTopic(p, f.topic))
    .filter((p) => !f.tpl || p.template === f.tpl)
    .filter((p) => !f.kw || kwOf(p).includes(f.kw))
    .filter((p) => !q.trim() || `${p.en} ${p.vi}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.date_label ?? '').localeCompare(a.date_label ?? '') || b.updated_at.localeCompare(a.updated_at))
  const selected = posts.filter((p) => sel.has(p.id))

  const nameOf = (vocab: Vocab | 'status', id: string) =>
    vocab === 'topic'
      ? id === UNPLACED
        ? 'chưa xếp'
        : topicById.get(id)?.title ?? id
      : vocab === 'tpl'
        ? templateName(id)
        : vocab === 'kw'
          ? keywords.find((k) => k.id === id)?.label ?? id
          : STATUS_LABEL[id as PostStatus]

  const toggle = (vocab: keyof Filters, id: string) => setF((o) => ({ ...o, [vocab]: o[vocab] === id ? null : id }))
  // ── post actions ─────────────────────────────────────────────────────────
  const act = (id: string, action: StatusAction) =>
    run(async () => {
      // Publishing fixes the post's address for good (migration 0027).
      const slug = action === 'publish' ? addresses.slugToPublish(id) : undefined
      await transitionStatus(id, action, ...(slug ? [slug] : []))
    })

  const copy = (id: string) => {
    const src = posts.find((p) => p.id === id)
    if (!src) return
    run(async () => {
      const { id: created } = await createPost({
        module_id: src.module_id,
        kind: src.kind,
        topic_id: src.topic_id,
        en: `${src.en} (bản sao)`,
        vi: src.vi || 'Một dòng mô tả',
        fromPostId: id,
      })
      nav.editPost(created)
    })
  }

  /**
   * Change one field on many posts. The old values are kept so Hoàn tác can
   * put each post back exactly as it was, not to some common value.
   */
  function bulk(field: 'topic_id' | 'kw+' | 'kw-', value: string) {
    const targets = selected
    const before = targets.map((p) => ({ id: p.id, topic_id: p.topic_id, keywords: kwOf(p) }))
    const patchOf = (p: PostSummary) =>
      field === 'topic_id'
        ? { topic_id: value }
        : { keywords: field === 'kw+' ? [...new Set([...kwOf(p), value])] : kwOf(p).filter((k) => k !== value) }
    const what = {
      topic_id: `chủ đề → ${nameOf('topic', value)}`,
      'kw+': `+ tag ${nameOf('kw', value)}`,
      'kw-': `− tag ${nameOf('kw', value)}`,
    }[field]
    run(async () => {
      await Promise.all(targets.map((p) => updatePost(p.id, patchOf(p))))
      return {
        msg: `${targets.length} bài · ${what}`,
        revert: () =>
          Promise.all(
            before.map((b) =>
              updatePost(b.id, field === 'topic_id' ? { topic_id: b.topic_id } : { keywords: b.keywords }),
            ),
          ),
      }
    })
  }

  function bulkStatus(action: StatusAction) {
    const ok = selected.filter((p) => ACTIONS_BY_STATUS[p.status].some((a) => a.action === action))
    const name = BULK_STATUS.find((b) => b.action === action)?.label ?? action
    run(async () => {
      for (const p of ok) {
        const slug = action === 'publish' ? addresses.slugToPublish(p.id) : undefined
        await transitionStatus(p.id, action, ...(slug ? [slug] : []))
      }
      return { msg: `${name} · ${ok.length}/${selected.length} bài` }
    })
  }

  // ── left column ──────────────────────────────────────────────────────────
  const unplaced = live.filter((p) => !p.topic_id).length
  const statusCount = (s: PostStatus) => posts.filter((p) => p.status === s).length
  const rail = (
    <nav aria-label="Phân loại" className="cw-rail" style={{ background: desk.panel, border: `1px solid ${desk.line}`, borderRadius: radius, paddingBottom: 18 }}>
      <SectionHead id="content.topics" title="Chủ đề">
        {shown.map(({ row: t, depth }) => (
            <div key={t.id}>
              <RailRow
                name={t.title}
                big={depth === 0}
                indent={14 + depth * 16}
                count={postsOf('topic', t.id).length}
                on={f.topic === t.id}
                onClick={() => toggle('topic', t.id)}
                dot={<Dot own={t.accent} inherited={ancestorsOf(topics, t.id).reverse().find((a) => a.accent)?.accent} />}
                flag={t.status !== 'published' ? statusLabel(t.status) : undefined}
              />
            </div>
        ))}
        {unplaced > 0 && <RailRow name="chưa xếp" count={unplaced} on={f.topic === UNPLACED} onClick={() => toggle('topic', UNPLACED)} />}
      </SectionHead>
      {/* Dạng bài is retired: the template a post is written in says what it is. */}
      <SectionHead id="content.templates" title="Template">
        {TEMPLATE_KEYS.map((t) => (
          <RailRow key={t} name={templateName(t)} count={postsOf('tpl', t).length} on={f.tpl === t} onClick={() => toggle('tpl', t)} />
        ))}
      </SectionHead>
      <SectionHead id="content.tags" title="Tag">
        {keywords.map((k) => (
          <RailRow
            key={k.id}
            name={k.label}
            count={postsOf('kw', k.id).length}
            on={f.kw === k.id}
            onClick={() => toggle('kw', k.id)}
          />
        ))}
      </SectionHead>
      <SectionHead id="content.status" title="Trạng thái">
        {(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => (
          <RailRow key={s} name={STATUS_LABEL[s]} count={statusCount(s)} on={f.status === s} onClick={() => toggle('status', s)} />
        ))}
      </SectionHead>
    </nav>
  )

  // ── middle column ────────────────────────────────────────────────────────
  const chips = (['topic', 'tpl', 'kw', 'status'] as const).filter((v) => f[v])
  const allOn = visible.length > 0 && visible.every((p) => sel.has(p.id))
  const pillBtn = (vocab: keyof Filters, id: string, text: string, dashed = false) => (
    <button key={id} type="button" className="cw-pill" onClick={() => setF((o) => ({ ...o, [vocab]: id }))} style={{ ...pill, borderStyle: dashed ? 'dashed' : 'solid' }}>
      {text}
    </button>
  )
  const th: CSSProperties = { ...label, textAlign: 'left', padding: '10px', borderBottom: `1px solid ${ink.border}`, background: paper.hover }
  const td: CSSProperties = { padding: '10px', borderBottom: `1px solid ${desk.line}`, verticalAlign: 'baseline', fontFamily: sans, fontSize: 13.5, color: ink.strong }

  const list = (
    <div style={{ minWidth: 0, display: 'grid', alignContent: 'start', background: desk.panel, border: `1px solid ${desk.line}`, borderRadius: radius, overflow: 'hidden' }}>
      {undo && (
        <div role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', background: '#E7EFE3', padding: '8px 16px', fontFamily: sans, fontSize: 13, color: ink.base }}>
          <span>{undo.msg}</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {undo.revert && (
              <Button size="sm" disabled={busy} onClick={() => run(async () => (await undo.revert?.(), { msg: 'Đã hoàn tác' }))}>
                Hoàn tác
              </Button>
            )}
            <IconButton size="sm" label="Đóng" onClick={() => setUndo(null)}>
              <IconClose />
            </IconButton>
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${paper.rule}`, fontFamily: sans, fontSize: 12.5, color: ink.soft }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{visible.length} bài</span>
        {chips.map((v) => (
          <span key={v} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: SEL, color: ink.base, padding: '2px 8px', borderRadius: 3 }}>
            {nameOf(v, f[v] as string)}
            <button type="button" aria-label={`Bỏ lọc ${nameOf(v, f[v] as string)}`} onClick={() => (setF((o) => ({ ...o, [v]: null })))} className="cw-unchip">
              <IconClose size={12} />
            </button>
          </span>
        ))}
        <input type="search" aria-label="Tìm bài" placeholder="Tìm bài" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...box, width: 200, marginLeft: 'auto' }} />
        <Button level="primary" icon={<IconPlus />} onClick={() => nav.newPost()}>
          Bài mới
        </Button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 680 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  checked={allOn}
                  onChange={() => setSel((s) => {
                    const n = new Set(s)
                    visible.forEach((p) => (allOn ? n.delete(p.id) : n.add(p.id)))
                    return n
                  })}
                />
              </th>
              <th style={th}>Bài</th>
              <th style={th}>Chủ đề</th>
              <th style={th}>Template</th>
              <th style={th}>Tag</th>
              <th style={th}>Trạng thái</th>
              <th style={th}>Ngày</th>
              <th style={th} aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const t = p.topic_id ? topicById.get(p.topic_id) : undefined
              const on = sel.has(p.id)
              return (
                <tr key={p.id} className="cw-row" style={{ background: on ? SEL : undefined }}>
                  <td style={td}>
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${p.en}`}
                      checked={on}
                      onChange={() => setSel((s) => {
                        const n = new Set(s)
                        if (n.has(p.id)) n.delete(p.id)
                        else n.add(p.id)
                        return n
                      })}
                    />
                  </td>
                  <td style={{ ...td, maxWidth: 320 }}>
                    <button type="button" onClick={() => nav.editPost(p.id)} style={{ all: 'unset', cursor: 'pointer', fontFamily: sans, fontSize: 14.5, fontWeight: 500, color: ink.base }}>
                      {p.en}
                    </button>
                    {p.pinned && (
                      <span aria-label="đã ghim" style={{ marginLeft: 6, fontSize: 13 }}>
                        📌
                      </span>
                    )}
                  </td>
                  <td style={td}>{t ? pillBtn('topic', t.id, t.title) : pillBtn('topic', UNPLACED, 'chưa xếp')}</td>
                  <td style={td}>{pillBtn('tpl', p.template ?? '', templateName(p.template))}</td>
                  <td style={td}>{kwOf(p).map((k) => pillBtn('kw', k, nameOf('kw', k), true))}</td>
                  <td style={td}>
                    <StatusBadge status={p.status} pending={p.has_draft} />
                  </td>
                  <td style={{ ...td, color: ink.soft, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{p.date_label}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Button size="sm" icon={<IconEdit size={14} />} aria-label={`Sửa ${p.en}`} onClick={() => nav.editPost(p.id)}>
                        Sửa
                      </Button>
                      <Menu
                        small
                        label={`Thao tác ${p.en}`}
                        actions={[
                          { label: 'Nhân bản', onPick: () => copy(p.id) },
                          // A pinned post leads every page that lists it (listingRule sortPosts).
                          { label: p.pinned ? 'Bỏ ghim' : 'Ghim', onPick: () => run(() => updatePost(p.id, { pinned: !p.pinned })) },
                          { label: 'Chuyển module', onPick: () => setMoving(p) },
                          { label: 'Tác giả', onPick: () => setNaming(p) },
                          ...ACTIONS_BY_STATUS[p.status].map((a) => ({
                            label: a.label,
                            onPick: () => act(p.id, a.action),
                            ...(a.action === 'delete' || a.action === 'permanently-delete' ? { danger: true as const } : {}),
                          })),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && <div style={{ color: ink.soft, fontFamily: sans, fontSize: 12.5, padding: '40px 0', textAlign: 'center' }}>Không có bài nào.</div>}
      </div>
      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          topics={shown.map((n) => n.row)}
          keywords={keywords}
          busy={busy}
          onField={bulk}
          onStatus={bulkStatus}
          onClear={() => setSel(new Set())}
        />
      )}
      <MovePostDialog
        post={moving}
        onClose={() => setMoving(null)}
        // Moving changes the post's public address and drops its hand-placed
        // order (sort_order is 1..N within a module) — see handlePatch.
        onMoved={(module_id) => (moving ? updatePost(moving.id, { module_id }).then(() => (setMoving(null), void load(), onChanged?.())) : undefined)}
      />
      <PostAuthorsDialog post={naming} onClose={() => setNaming(null)} />
    </div>
  )

  return (
    <div style={{ padding: '16px 24px 40px' }}>
      <style>{CSS}</style>
      {err && (
        <div role="alert" style={{ background: '#FBE7E5', color: '#8E1E42', fontFamily: sans, fontSize: 12.5, padding: '8px 16px' }}>
          {err}
        </div>
      )}
      <div
        className="cw-ws"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,240px) minmax(0,1fr)',
          gap: 14,
          minHeight: 560,
          alignItems: 'start',
        }}
      >
        {rail}
        {list}
      </div>
    </div>
  )
}

function BulkBar({
  count,
  topics,
  keywords,
  busy,
  onField,
  onStatus,
  onClear,
}: {
  count: number
  topics: Node[]
  keywords: Keyword[]
  busy: boolean
  onField: (field: 'topic_id' | 'kw+' | 'kw-', value: string) => void
  onStatus: (a: StatusAction) => void
  onClear: () => void
}) {
  const s: CSSProperties = { all: 'unset', cursor: 'pointer', border: '1px solid rgba(255,255,255,.28)', padding: '4px 10px', fontFamily: sans, fontSize: 12.5, color: paper.cream }
  const pick = (name: string, opts: [string, string][], go: (v: string) => void) => (
    <select
      aria-label={name}
      value=""
      disabled={busy}
      onChange={(e) => e.target.value && go(e.target.value)}
      style={s}
    >
      <option value="">{name}</option>
      {opts.map(([v, t]) => (
        <option key={v} value={v} style={{ color: ink.base }}>
          {t}
        </option>
      ))}
    </select>
  )
  return (
    <div role="toolbar" aria-label="Sửa nhiều bài" style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: ink.base, color: paper.cream, padding: '9px 14px', fontFamily: sans, fontSize: 13 }}>
      <b style={{ marginRight: 8, fontWeight: 500 }}>{count} bài</b>
      {pick('Chủ đề', topics.map((t) => [t.id, `${'  '.repeat(ancestorsOf(topics, t.id).length)}${t.parent_id ? '› ' : ''}${t.title}`]), (v) => onField('topic_id', v))}
      {keywords.length > 0 && pick('+ Tag', keywords.map((k) => [k.id, k.label]), (v) => onField('kw+', v))}
      {keywords.length > 0 && pick('− Tag', keywords.map((k) => [k.id, k.label]), (v) => onField('kw-', v))}
      {pick('Trạng thái', BULK_STATUS.map((b) => [b.action, b.label]), (v) => onStatus(v as StatusAction))}
      <span style={{ marginLeft: 'auto' }}>
        <Button size="sm" onClick={onClear}>
          Bỏ chọn
        </Button>
      </span>
    </div>
  )
}
