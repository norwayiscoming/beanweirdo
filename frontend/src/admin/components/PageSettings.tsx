import { type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { POST_TEMPLATE_KEYS as TEMPLATES } from '../../content/templates'
import {
  createRule,
  deleteOverride,
  deletePage,
  saveOverride,
  updatePage,
  updateRule,
  type Keyword,
  type LayoutOverride,
  type LayoutPage,
  type StoredRule,
  type Tag,
  type Topic,
} from '../lib/apiClient'
import { useRowDrag } from '../lib/useRowDrag'
import { findPage, type PageRow } from '../../data/useModules'
import { ancestorsOf } from '../../lib/contentTree'
import { treeOrder, type ListingRule, type RuleGroup, type RuleSort, type RuleTier } from '../../lib/listingRule'
import { toPath } from '../../lib/routes'
import type { PortPart } from './PortEditors'
import { ink, paper, sans, serif } from '../../design/tokens'

/**
 * The page side of Cấu hình: what a page lists and how it looks (migration
 * 0028). This was Quản lý trang's editor column; since the two tabs were
 * merged (2026-10-08) the tree that picks a page lives in `ConfigTree.tsx`
 * and these are the panels it opens on the right.
 */

/** Pages the site draws with screens of their own, whose copy lives in site settings. */
export type SystemPage = 'landing' | 'index' | 'notes' | 'archive'

/** What PageEditor opens: the blog's own pages. */
export type BlogSelected =
  | { kind: 'system'; key: SystemPage }
  | { kind: 'curated'; id: string }
  | { kind: 'template'; id: string }
  | { kind: 'override'; type: 'topic' | 'keyword'; node: string }

export type Layout = { pages: LayoutPage[]; overrides: LayoutOverride[]; rules: StoredRule[] }

const SYSTEM: { key: SystemPage; title: string; path: string }[] = [
  { key: 'landing', title: 'Trang chủ', path: toPath({ area: 'public', screen: 'landing' }) },
  { key: 'index', title: 'Mục lục', path: toPath({ area: 'public', screen: 'home' }) },
  { key: 'archive', title: 'Lưu trữ', path: '' },
]

export const TEMPLATE_TITLES: Record<string, string> = {
  template_subject: 'Mẫu trang subject',
  template_topic: 'Mẫu trang topic',
  template_keyword: 'Mẫu trang tag',
}

const TIER_NAMES: Record<RuleTier, string> = {
  topic: 'Chủ đề',
  keyword: 'Tag',
  kind: 'Dạng bài',
  template: 'Khuôn bài',
  pick: 'Chọn tay',
  all: 'Toàn bộ',
}
const SORT_NAMES: Record<RuleSort, string> = { newest: 'mới nhất trước', oldest: 'cũ nhất trước', manual: 'xếp tay', tree: 'theo cây chủ đề' }
const GROUP_NAMES: Record<RuleGroup, string> = { none: 'không nhóm', subject: 'subject', topic: 'topic', keyword: 'tag', kind: 'dạng bài', year: 'năm' }

const head: CSSProperties = {
  fontFamily: sans,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '.2em',
  textTransform: 'uppercase',
  color: ink.muted,
  borderBottom: `2px solid ${ink.base}`,
  paddingBottom: 9,
  margin: '30px 0 12px',
}
const label: CSSProperties = { fontFamily: sans, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: ink.faint, marginBottom: 6 }
const box: CSSProperties = {
  boxSizing: 'border-box',
  background: paper.white,
  border: `1px solid ${paper.rule}`,
  color: ink.base,
  fontFamily: sans,
  fontSize: 12.5,
  padding: '5px 8px',
  outline: 'none',
}
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${paper.rule}`, fontFamily: sans, fontSize: 13 }
const link: CSSProperties = { fontFamily: sans, fontSize: 11, color: ink.green, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }
const quiet: CSSProperties = { ...link, color: ink.muted }
const chip = (on: boolean): CSSProperties => ({
  fontFamily: sans,
  fontSize: 11.5,
  padding: '3px 9px',
  border: `1px solid ${on ? ink.base : paper.rule}`,
  background: on ? ink.base : paper.white,
  color: on ? paper.cream : ink.soft,
  cursor: 'pointer',
})

function dragRow(d: ReturnType<typeof useRowDrag>, i: number) {
  return {
    draggable: true,
    onDragStart: () => d.setFrom(i),
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      d.setOver(i)
    },
    onDrop: () => d.drop(i),
    onDragEnd: d.end,
    style: { ...row, background: d.over === i && d.from !== i ? '#EEF5F8' : 'transparent', opacity: d.from === i ? 0.5 : 1 },
  }
}

const moved = <T,>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

export type Vocab = { topics: Topic[]; keywords: Keyword[]; kinds: Tag[] }

/** A set of options to switch on and off. */
function Chips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = value.includes(o.id)
        return (
          <button key={o.id} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} style={chip(on)}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function nodeOptions(tier: RuleTier, v: Vocab): { id: string; label: string }[] {
  if (tier === 'topic') {
    const byId = new Map(v.topics.map((t) => [t.id, t]))
    return treeOrder(v.topics).map((id) => ({ id, label: [...ancestorsOf(v.topics, id), byId.get(id)!].map((t) => t.title).join(' › ') }))
  }
  if (tier === 'keyword') return v.keywords.map((k) => ({ id: k.id, label: k.label }))
  if (tier === 'kind') return v.kinds.map((k) => ({ id: k.id, label: k.label }))
  if (tier === 'template') return TEMPLATES.map((t) => ({ id: t, label: t }))
  return []
}

/** The rule's own fields. A template's rule always takes its node from the page. */
function RuleEditor({ rule, vocab, template, onChange }: { rule: StoredRule; vocab: Vocab; template: boolean; onChange: (patch: Partial<ListingRule>) => void }) {
  const opts = nodeOptions(rule.tier, vocab)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {!template && (
        <div>
          <div style={label}>Kéo từ</div>
          <select aria-label="Kéo từ" value={rule.tier} onChange={(e) => onChange({ tier: e.target.value as RuleTier, nodes: [], exclude: [] })} style={box}>
            {/* No dạng bài: it is retired, the template tier says the same. */}
            {(Object.keys(TIER_NAMES) as RuleTier[]).filter((t) => t !== 'pick' && t !== 'kind').map((t) => (
              <option key={t} value={t}>
                {TIER_NAMES[t]}
              </option>
            ))}
          </select>
        </div>
      )}
      {!template && opts.length > 0 && (
        <div>
          <div style={label}>Nút</div>
          <Chips options={opts} value={rule.nodes} onChange={(nodes) => onChange({ nodes })} />
        </div>
      )}
      {rule.tier === 'topic' && (
        <label style={{ fontFamily: sans, fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={rule.include_children} onChange={(e) => onChange({ include_children: e.target.checked })} />
          gồm topic con
        </label>
      )}
      {rule.tier === 'keyword' && !template && (
        <div>
          <div style={label}>Khớp</div>
          <select aria-label="Khớp" value={rule.match} onChange={(e) => onChange({ match: e.target.value as 'any' | 'all' })} style={box}>
            <option value="any">bất kỳ tag nào</option>
            <option value="all">đủ mọi tag</option>
          </select>
        </div>
      )}
      {!template && opts.length > 0 && (
        <div>
          <div style={label}>Loại trừ</div>
          <Chips options={opts} value={rule.exclude} onChange={(exclude) => onChange({ exclude })} />
        </div>
      )}
      <div>
        <div style={label}>Chỉ dạng bài</div>
        <Chips options={vocab.kinds.map((k) => ({ id: k.id, label: k.label }))} value={rule.kinds} onChange={(kinds) => onChange({ kinds })} />
      </div>
      <div>
        <div style={label}>Chỉ khuôn bài</div>
        <Chips options={TEMPLATES.map((t) => ({ id: t, label: t }))} value={rule.templates} onChange={(templates) => onChange({ templates })} />
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={label}>Xếp</div>
          <select aria-label="Xếp" value={rule.sort} onChange={(e) => onChange({ sort: e.target.value as RuleSort })} style={box}>
            {(Object.keys(SORT_NAMES) as RuleSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_NAMES[s]}
              </option>
            ))}
          </select>
        </div>
        {rule.sort === 'manual' && (
          <div>
            <div style={label}>Bài mới</div>
            <select aria-label="Bài mới" value={rule.new_first ? 'first' : 'last'} onChange={(e) => onChange({ new_first: e.target.value === 'first' })} style={box}>
              <option value="first">vào đầu</option>
              <option value="last">vào cuối</option>
            </select>
          </div>
        )}
        <div>
          <div style={label}>Nhóm</div>
          <select aria-label="Nhóm" value={rule.group_by} onChange={(e) => onChange({ group_by: e.target.value as RuleGroup })} style={box}>
            {(Object.keys(GROUP_NAMES) as RuleGroup[]).filter((g) => g !== 'kind').map((g) => (
              <option key={g} value={g}>
                {GROUP_NAMES[g]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={label}>Giới hạn</div>
          <input
            aria-label="Giới hạn"
            type="number"
            min={1}
            defaultValue={rule.limit_n ?? ''}
            key={rule.limit_n ?? 'none'}
            onBlur={(e) => onChange({ limit_n: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
            style={{ ...box, width: 70 }}
          />
        </div>
      </div>
    </div>
  )
}

/** The page's posts in their current order, to drag into a hand order and pin. */
function HandOrder({ rule, posts, onChange }: { rule: StoredRule; posts: { id: string; en: string }[]; onChange: (patch: Partial<ListingRule>) => void }) {
  const drag = useRowDrag((from, to) => onChange({ manual_order: moved(posts.map((p) => p.id), from, to) }))
  return (
    <div>
      {posts.map((p, i) => (
        <div key={p.id} {...dragRow(drag, i)}>
          <span style={{ cursor: 'grab', color: ink.faint }} aria-hidden>
            ⋮⋮
          </span>
          <span style={{ color: ink.faint, width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ flex: 1, fontFamily: serif, fontSize: 15 }}>{p.en}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: ink.muted }}>
            <input
              type="checkbox"
              aria-label={`ghim ${p.en}`}
              checked={rule.pinned.includes(p.id)}
              onChange={(e) => onChange({ pinned: e.target.checked ? [...rule.pinned, p.id] : rule.pinned.filter((x) => x !== p.id) })}
            />
            ghim
          </label>
        </div>
      ))}
    </div>
  )
}

type NavItem = { ref: string; sidebar?: boolean; home?: boolean }

export const PORT_PARTS: { part: PortPart; title: string }[] = [
  { part: 'about', title: 'About' },
  { part: 'sign', title: 'Signature' },
  { part: 'header', title: 'Thanh trên' },
  { part: 'footer', title: 'Chân trang' },
]

const ruleIn = (layout: Layout) => (id: string | null | undefined) => layout.rules.find((r) => r.id === id)

/** The navigation as the site draws it: the owner's list, then subjects not yet placed. */
export function navItemsOf(nav: LayoutPage | undefined, topics: Topic[]): NavItem[] {
  const items = ((nav?.presentation.items ?? []) as NavItem[]).slice()
  const listed = new Set(items.map((i) => i.ref))
  const subjects = topics.filter((t) => t.parent_id === null).sort((a, b) => a.sort_order - b.sort_order)
  for (const s of subjects) if (!listed.has(`topic:${s.id}`)) items.push({ ref: `topic:${s.id}`, sidebar: true, home: true })
  return items
}

/** Điều hướng: the subjects and pages the sidebar and the blog home list, in order. */
export function NavEditor({
  layout,
  topics,
  pages,
  postsOf,
  run,
}: {
  layout: Layout
  topics: Topic[]
  pages: PageRow[]
  postsOf: (id: string) => { id: string; en: string }[]
  run: (fn: () => Promise<unknown>) => void
}) {
  const nav = layout.pages.find((p) => p.kind === 'nav')
  const items = navItemsOf(nav, topics)
  const save = (next: NavItem[]) => nav && run(() => updatePage(nav.id, { presentation: { ...nav.presentation, items: next } }))
  const drag = useRowDrag((from, to) => save(moved(items, from, to)))
  const pageOf = (ref: string): PageRow | undefined => {
    const [type, id] = ref.split(':')
    return findPage(pages, type === 'tag' ? `tag-${id}` : id)
  }
  return (
    <div>
      {items.map((it, i) => {
        const p = pageOf(it.ref)
        return (
          <div key={it.ref} {...dragRow(drag, i)}>
            <span style={{ cursor: 'grab', color: ink.faint }} aria-hidden>
              ⋮⋮
            </span>
            <span style={{ flex: 1 }}>{p?.title ?? it.ref}</span>
            <span style={{ color: ink.faint, fontSize: 11 }}>{p ? postsOf(p.id).length : 0} bài</span>
            {(['sidebar', 'home'] as const).map((flag) => (
              <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: ink.muted }}>
                <input
                  type="checkbox"
                  aria-label={`${flag === 'sidebar' ? 'thanh bên' : 'trang chủ'} ${p?.title ?? it.ref}`}
                  checked={it[flag] !== false}
                  onChange={(e) => save(items.map((x, j) => (j === i ? { ...x, [flag]: e.target.checked } : x)))}
                />
                {flag === 'sidebar' ? 'thanh bên' : 'trang chủ'}
              </label>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The page of a topic or a tag: either it follows its tier's template, or it
 * has settings of its own — then it gets the full page editor.
 */
export function NodePage({
  type,
  node,
  layout,
  pages,
  postsOf,
  vocab,
  error,
  run,
  onOpenTemplate,
  renderCopy,
  renderModule,
}: {
  type: 'topic' | 'keyword'
  node: string
  layout: Layout
  pages: PageRow[]
  postsOf: (id: string) => { id: string; en: string }[]
  vocab: Vocab
  error: ReactNode
  run: (fn: () => Promise<unknown>) => void
  onOpenTemplate: (id: string) => void
  renderCopy: (key: SystemPage) => ReactNode
  renderModule: (moduleId: string) => ReactNode
}) {
  const own = layout.overrides.find((o) => o.node_type === type && o.node_id === node)
  if (own)
    return (
      <PageEditor
        selected={{ kind: 'override', type, node }}
        layout={layout}
        pages={pages}
        postsOf={postsOf}
        vocab={vocab}
        error={error}
        run={run}
        renderCopy={renderCopy}
        renderModule={renderModule}
      />
    )
  const topic = vocab.topics.find((t) => t.id === node)
  const tplKind = type === 'keyword' ? 'template_keyword' : topic?.parent_id ? 'template_topic' : 'template_subject'
  const tpl = layout.pages.find((p) => p.kind === tplKind)
  const page = findPage(pages, type === 'keyword' ? `tag-${node}` : node)
  return (
    <div>
      {error}
      <div style={{ fontFamily: sans, fontSize: 13, color: ink.muted, margin: '8px 0 14px' }}>
        theo{' '}
        {tpl ? (
          <button type="button" onClick={() => onOpenTemplate(tpl.id)} style={{ ...link, fontSize: 13 }}>
            {TEMPLATE_TITLES[tplKind]}
          </button>
        ) : (
          TEMPLATE_TITLES[tplKind]
        )}{' '}
        · {page ? postsOf(page.id).length : 0} bài
      </div>
      <button
        type="button"
        style={{ ...link, fontSize: 12.5 }}
        onClick={() =>
          run(async () => {
            // The node starts from its template's rule, with the node written in.
            const { id: _id, ...copy } = ruleIn(layout)(tpl?.blocks[0]) ?? ({} as StoredRule)
            const rule = await createRule({ ...copy, tier: type, from_page: false, nodes: [node] })
            await saveOverride({ node_type: type, node_id: node, rule_id: rule.id })
          })
        }
      >
        + cài đặt riêng
      </button>
    </div>
  )
}

/** Where a blog page lives and what it is made of — read once, by the editor and by the preview beside it. */
export function describePage(selected: BlogSelected, layout: Layout, pages: PageRow[]) {
  const ruleOf = ruleIn(layout)
  let title = ''
  let rule: StoredRule | undefined
  let preview = ''
  let page: PageRow | undefined
  let record: LayoutPage | undefined
  let override: LayoutOverride | undefined
  let copyKey: SystemPage | null = null

  if (selected.kind === 'system') {
    const s = SYSTEM.find((x) => x.key === selected.key)!
    title = s.title
    preview = s.path
    copyKey = s.key
  } else if (selected.kind === 'curated' || selected.kind === 'template') {
    record = layout.pages.find((p) => p.id === selected.id)
    rule = ruleOf(record?.blocks[0])
    page = selected.kind === 'curated' ? findPage(pages, selected.id) : undefined
    title = selected.kind === 'template' ? TEMPLATE_TITLES[record?.kind ?? ''] ?? '' : record?.title || selected.id
    if (page) preview = page.screen === 'notes' ? toPath({ area: 'public', screen: 'notes' }) : toPath({ area: 'public', screen: 'module', moduleId: page.id })
    if (page?.screen === 'notes') copyKey = 'notes'
  } else {
    override = layout.overrides.find((o) => o.node_type === selected.type && o.node_id === selected.node)
    rule = ruleOf(override?.rule_id)
    page = findPage(pages, selected.type === 'keyword' ? `tag-${selected.node}` : selected.node)
    title = page?.title ?? selected.node
    if (page) preview = toPath({ area: 'public', screen: 'module', moduleId: page.id })
  }
  return { title, rule, preview, page, record, override, copyKey }
}

export function PageEditor({
  selected,
  layout,
  pages,
  postsOf,
  vocab,
  error,
  run,
  onGone,
  renderCopy,
  renderModule,
}: {
  selected: BlogSelected
  layout: Layout
  pages: PageRow[]
  postsOf: (id: string) => { id: string; en: string }[]
  vocab: Vocab
  error: ReactNode
  run: (fn: () => Promise<unknown>) => void
  /** Called once the page itself is deleted, so the screen can open something that still exists. */
  onGone?: () => void
  renderCopy: (key: SystemPage) => ReactNode
  renderModule: (moduleId: string) => ReactNode
}) {
  const { rule, page, record, override, copyKey } = describePage(selected, layout, pages)
  const linked = ((override?.presentation ?? record?.presentation ?? {}) as { module?: string }).module
  const posts = page ? postsOf(page.id) : []
  const saveRule = (patch: Partial<ListingRule>) => rule && run(() => updateRule(rule.id, patch))

  return (
    <div>
      {error}

      {record && selected.kind === 'curated' && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '12px 0' }}>
          <input
            aria-label="Tên trang"
            defaultValue={record.title}
            key={record.title}
            onBlur={(e) => e.target.value.trim() && e.target.value !== record.title && run(() => updatePage(record.id, { title: e.target.value.trim() }))}
            style={{ ...box, width: 260, fontFamily: serif, fontSize: 16 }}
          />
          <select aria-label="Quyền xem trang" value={record.visibility} onChange={(e) => run(() => updatePage(record.id, { visibility: e.target.value as 'public' | 'private' }))} style={box}>
            <option value="public">công khai</option>
            <option value="private">riêng tư</option>
          </select>
        </div>
      )}

      {rule && (
        <>
          <div style={head}>Quy chế</div>
          <RuleEditor rule={rule} vocab={vocab} template={selected.kind === 'template'} onChange={saveRule} />
        </>
      )}

      {rule?.sort === 'manual' && posts.length > 0 && (
        <>
          <div style={head}>Thứ tự</div>
          <HandOrder rule={rule} posts={posts} onChange={saveRule} />
        </>
      )}

      {linked && (
        <>
          <div style={head}>Hình trang</div>
          {renderModule(linked)}
        </>
      )}

      {copyKey && (
        <>
          <div style={head}>Chữ cố định</div>
          {renderCopy(copyKey)}
        </>
      )}

      {selected.kind === 'override' && (
        <button type="button" style={{ ...quiet, marginTop: 30 }} onClick={() => run(() => deleteOverride(selected.type, selected.node))}>
          bỏ cài đặt riêng, dùng mẫu
        </button>
      )}
      {selected.kind === 'curated' && record && record.aliases.length === 0 && !linked && (
        <button
          type="button"
          style={{ ...quiet, marginTop: 30 }}
          onClick={() =>
            run(async () => {
              await deletePage(record.id)
              onGone?.()
            })
          }
        >
          xoá trang
        </button>
      )}
    </div>
  )
}
