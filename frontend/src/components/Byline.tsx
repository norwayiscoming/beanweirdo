import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { AuthorRef, PostSite } from 'api-contract'
import { serif, sans } from '../design/tokens'
import type { Tag } from '../lib/tagColor'
import { templateName } from '../lib/templateNames'
import { TagBadges } from './TagBadges'

/** The public read adds the bio for the card at the end; the admin's author list does not carry one. */
type BylineAuthor = AuthorRef & { bio?: string | null }

const MONTH_DAY_YEAR = (iso: string): string | null => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}

export function Avatar({ author, size, ring }: { author: BylineAuthor; size: number; ring?: boolean }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 999,
    flex: 'none',
    objectFit: 'cover',
    // Opaque on purpose: stacked faces overlap, and a see-through disc (or a
    // transparent PNG) lets the face underneath show through.
    background: '#E4E0D8',
    color: '#3A3833',
    // The ring keeps overlapping faces apart on any band colour.
    boxShadow: ring ? '0 0 0 2px #fff' : undefined,
  }
  if (author.avatar_url) return <img src={author.avatar_url} alt="" style={style} />
  return (
    <span
      aria-hidden
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        textTransform: 'uppercase',
      }}
    >
      {author.name.slice(0, 1)}
    </span>
  )
}

/** The sites a post can be ticked for, as the reader sees them, each with its dot colour. */
export const SITE_CHIPS: Record<PostSite, { name: string; color: string }> = {
  biz: { name: 'biz', color: '#5B7DB1' },
  bean: { name: 'bean', color: '#B7795A' },
  blog: { name: 'personal blog', color: '#2B4B33' },
}

/**
 * The post's properties, Notion style, under its title on every template:
 * who wrote it, its topic and tags, which homes show it, the date and how long
 * it reads (owner picked mock B, 2026-10-15). The six templates in
 * `post-renderer` did not each grow a slot for it; it rides the breadcrumb
 * slot and inherits the band's ink.
 *
 * A row shows only when it has a value. `updated_at` is left out on purpose:
 * reordering or pinning a post moves it, so it would claim edits nobody made.
 */
export function PostProps({
  authors,
  topic,
  tags = [],
  shownOn = [],
  publishedAt,
  minutes,
  template,
}: {
  authors: BylineAuthor[]
  topic?: string | null
  tags?: Tag[]
  shownOn?: PostSite[]
  /** Only a published post has one worth printing; callers pass null for a draft. */
  publishedAt?: string | null
  minutes?: number | null
  template?: string | null
}) {
  const date = publishedAt ? MONTH_DAY_YEAR(publishedAt) : null
  const read = [minutes ? `${minutes} phút` : null, templateName(template) || null].filter(Boolean).join(' · ')
  const rows: [string, ReactNode][] = []
  if (authors.length)
    rows.push([
      'Tác giả',
      authors.map((a) => (
        <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Avatar author={a} size={22} />
          {a.name}
        </span>
      )),
    ])
  if (topic) rows.push(['Chủ đề', topic])
  if (tags.length) rows.push(['Tag', <TagBadges key="t" tags={tags} />])
  if (shownOn.length)
    rows.push([
      'Hiện ở',
      shownOn.map((s) => (
        <span key={s} style={chip}>
          <i style={{ width: 7, height: 7, borderRadius: 999, background: SITE_CHIPS[s].color }} />
          {SITE_CHIPS[s].name}
        </span>
      )),
    ])
  if (date) rows.push(['Ngày', date])
  if (read) rows.push(['Đọc', read])
  if (!rows.length) return null
  return (
    <dl
      data-testid="post-props"
      style={{
        display: 'grid',
        gridTemplateColumns: '110px minmax(0, 1fr)',
        gap: '8px 16px',
        margin: '0 0 24px',
        padding: '0 0 16px',
        borderBottom: RULE,
        fontFamily: sans,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt style={{ opacity: 0.65 }}>{label}</dt>
          <dd style={{ margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', minWidth: 0 }}>{value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

const RULE = '1px solid rgba(127,127,127,.3)'

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: RULE,
  borderRadius: 999,
  padding: '1px 10px',
  fontSize: 13,
}

/** "Viết bởi" at the end of the post, one row per author with their bio — Medium's "Written by". */
export function AuthorCard({ authors }: { authors: BylineAuthor[] }) {
  if (authors.length === 0) return null
  return (
    <div
      data-testid="author-card"
      style={{ borderTop: '1px solid rgba(127,127,127,.3)', marginTop: 40, paddingTop: 24, display: 'grid', gap: 20, fontFamily: sans }}
    >
      {authors.map((a) => (
        <div key={a.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <Avatar author={a} size={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.6 }}>Viết bởi</div>
            <div style={{ fontFamily: serif, fontSize: 20, margin: '2px 0 6px' }}>{a.name}</div>
            {a.bio?.trim() && (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.85, maxWidth: '60ch', whiteSpace: 'pre-line' }}>
                {a.bio.trim()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
