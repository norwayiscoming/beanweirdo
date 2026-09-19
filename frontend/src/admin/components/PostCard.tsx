import { useState } from 'react'
import type { PostStatus, PostSummary, StatusAction } from '../lib/apiClient'
import { TEMPLATE_LABEL } from '../../content/templates'
import { garden, ink, paper, sans, serif } from '../../design/tokens'
import { Button, IconButton } from '../../design/Button'
import { IconCopy, IconEdit, IconPin } from '../../design/icons'
import { StatusBadge } from './StatusBadge'


/**
 * What each action does to the post, which decides how loud its button is.
 *
 * All five used to be the same green text link, so "Xoá" and "Sửa" were
 * indistinguishable until you read them. Only the ones that destroy something
 * are marked; everything else is an ordinary row action.
 */
const ACTIONS_BY_STATUS: Record<PostStatus, { label: string; action: StatusAction; danger?: true }[]> = {
  draft: [
    { label: 'Đăng', action: 'publish' },
    { label: 'Lưu trữ', action: 'archive' },
    { label: 'Xoá', action: 'delete', danger: true },
  ],
  published: [
    { label: 'Bỏ đăng', action: 'unpublish' },
    { label: 'Lưu trữ', action: 'archive' },
    { label: 'Xoá', action: 'delete', danger: true },
  ],
  archived: [
    { label: 'Khôi phục', action: 'restore' },
    { label: 'Xoá', action: 'delete', danger: true },
  ],
  deleted: [
    { label: 'Khôi phục', action: 'restore-trash' },
    { label: 'Xoá vĩnh viễn', action: 'permanently-delete', danger: true },
  ],
}

// No color field on PostSummary — pick a stable garden tint per card from
// the post id so the thumbnail fallback reads like the mockup without a
// schema change. Used only when the post has no picture anywhere in it.
const THUMB_COLORS = [garden.blush, garden.petalTint2, garden.leafTint2, garden.apricot, garden.honeyTint2]
function thumbColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return THUMB_COLORS[hash % THUMB_COLORS.length]
}

export function PostCard({
  post,
  onAction,
  onEdit,
  onCopy,
  onPin,
}: {
  post: PostSummary
  onAction: (id: string, action: StatusAction) => void
  onEdit: (id: string) => void
  /** Start a new draft from this one's content. */
  onCopy: (id: string) => void
  /** Ghim bài lên đầu module của nó. Mọi module đều ghim được, không riêng Ghi 01. */
  onPin: (id: string, pinned: boolean) => void
}) {
  const [hover, setHover] = useState(false)
  const actions = ACTIONS_BY_STATUS[post.status]

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '52px minmax(0,1fr) auto',
        alignItems: 'center',
        gap: 16,
        padding: '14px 40px',
        borderBottom: `1px solid ${paper.rule}`,
        borderLeft: `3px solid ${hover ? ink.green : 'transparent'}`,
        background: hover ? paper.hover : paper.white,
      }}
    >
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url}
          alt=""
          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, flex: 'none' }}
        />
      ) : (
        <div style={{ width: 44, height: 44, background: thumbColor(post.id), borderRadius: 4, flex: 'none' }} />
      )}

      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: serif, fontSize: 16, letterSpacing: '-0.01em', color: ink.base }}>{post.en}</div>
        <div style={{ fontFamily: sans, fontSize: 11, color: ink.muted, marginTop: 3 }}>
          {post.module_id} · {post.kind} · {post.date_label}
        </div>
        <div style={{ fontFamily: sans, fontSize: 12.5, color: ink.soft, marginTop: 5, lineHeight: 1.5 }}>{post.vi}</div>
      </div>

      {/*
        Actions get their own column instead of sitting inside the title cell.
        Mixed in with the text they read as part of the description, which is
        most of why they did not read as controls at all.
      */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: sans,
              fontSize: 10,
              color: ink.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {post.template ? TEMPLATE_LABEL[post.template] : '—'}
          </span>
          {/* Ghim là việc của mọi module, không riêng Ghi 01: bài ghim dẫn đầu
              module của nó dù phần còn lại xếp theo gì. */}
          <IconButton
            level={post.pinned ? 'primary' : 'ghost'}
            aria-pressed={post.pinned}
            label={post.pinned ? 'Bỏ ghim' : 'Ghim lên đầu module'}
            onClick={(e) => {
              e.stopPropagation()
              onPin(post.id, !post.pinned)
            }}
          >
            <IconPin size={16} />
          </IconButton>
          <StatusBadge status={post.status} />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button size="sm" onClick={() => onEdit(post.id)} icon={<IconEdit size={14} />}>
            Sửa
          </Button>
          <Button size="sm" onClick={() => onCopy(post.id)} icon={<IconCopy size={14} />}>
            Nhân bản
          </Button>
          {actions.map((a) => (
            <Button
              key={a.action}
              size="sm"
              level={a.danger ? 'danger' : 'ghost'}
              onClick={() => onAction(post.id, a.action)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
