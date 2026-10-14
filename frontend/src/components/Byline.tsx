import type { CSSProperties } from 'react'
import type { AuthorRef } from 'api-contract'
import { serif, sans } from '../design/tokens'
import type { Tag } from '../lib/tagColor'
import { TagBadges } from './TagBadges'

/** The public read adds the bio for the card at the end; the admin's author list does not carry one. */
type BylineAuthor = AuthorRef & { bio?: string | null }

const MONTH_DAY_YEAR = (iso: string): string | null => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}

/** "kris", "kris và kay", "kris, kay và an" — how a Vietnamese byline lists people. */
function names(authors: BylineAuthor[]): string {
  const all = authors.map((a) => a.name)
  return all.length < 2 ? (all[0] ?? '') : `${all.slice(0, -1).join(', ')} và ${all[all.length - 1]}`
}

function Avatar({ author, size, ring }: { author: BylineAuthor; size: number; ring?: boolean }) {
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

/**
 * Who wrote it, when, and how long it takes — Medium's byline, drawn by the
 * app under the breadcrumb of every template so the six templates in
 * `post-renderer` did not each grow a slot for it. It inherits the band's ink.
 *
 * Each part shows only when it has a value; with none of them it draws
 * nothing, so an old post with no author, date or tag looks as it did.
 * `updated_at` is left out on purpose: reordering or pinning a post moves it,
 * so it would claim edits nobody made.
 */
export function Byline({
  authors,
  publishedAt,
  minutes,
  tags = [],
}: {
  authors: BylineAuthor[]
  /** Only a published post has one worth printing; callers pass null for a draft. */
  publishedAt?: string | null
  minutes?: number | null
  tags?: Tag[]
}) {
  const date = publishedAt ? MONTH_DAY_YEAR(publishedAt) : null
  const facts = [minutes ? `${minutes} phút đọc` : null, date].filter(Boolean)
  if (authors.length === 0 && facts.length === 0 && tags.length === 0) return null
  return (
    <div
      data-testid="byline"
      style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: sans, margin: '0 0 24px' }}
    >
      {authors.length > 0 && (
        <span style={{ display: 'flex', flex: 'none' }}>
          {authors.map((a, i) => (
            <span key={a.id} style={{ marginLeft: i === 0 ? 0 : -12, display: 'flex' }}>
              <Avatar author={a} size={40} ring={authors.length > 1} />
            </span>
          ))}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        {authors.length > 0 && <div style={{ fontSize: 14, fontWeight: 500 }}>{names(authors)}</div>}
        {(facts.length > 0 || tags.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', marginTop: 2, fontSize: 12.5 }}>
            {facts.length > 0 && <span style={{ opacity: 0.7 }}>{facts.join(' · ')}</span>}
            <TagBadges tags={tags} />
          </div>
        )}
      </div>
    </div>
  )
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
