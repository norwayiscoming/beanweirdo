import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthorRef } from 'api-contract'
import { ancestorsOf, buildTree, flattenTree } from '../../lib/contentTree'
import { tagColor } from '../../lib/tagColor'
import { createKeyword, listKeywords, type Keyword, type Module, type PostDetail, type PostTemplate, type PostVisibility, type Node } from '../lib/apiClient'
import { TEMPLATE_LABEL } from '../../content/templates'
import { ink, sans } from '../../design/tokens'
import { IconButton } from '../../design/Button'
import { IconClose } from '../../design/icons'
import { AuthorPicker } from './AuthorPicker'
import { ThemePicker } from './ThemePicker'
import { Choice, DETAIL_CSS, desk } from './Detail'

/**
 * Everything about a post that is not its text, in one panel that slides in
 * from the right of the editor.
 *
 * These fields used to sit as a loose strip of eight controls over three lines
 * above the page, with the colour picker floating at the far right. The owner
 * found it scattered and picked, from three mocks, a Notion-style property
 * panel (2026-10-14): one button opens it, the page stays visible beside it,
 * so a change of colour or topic shows on the page at once.
 *
 * Everything but the address and the authors goes through the editor's own
 * patch, so it saves and undoes like any other field. The address does not:
 * the server can refuse it (taken, or still forwarding to another post), and
 * that answer has to come back to this row. Authors write on their own, like
 * module and pin, without waiting for "Đăng thay đổi".
 */
export type SettingsPatch = Partial<{
  topic_id: string | null
  visibility: PostVisibility
  module_id: string
  keywords: string[]
  template: string
  theme_color: string | null
}>

/** Wide enough for a topic path and the colour row without wrapping either. */
export const SETTINGS_WIDTH = 380

/**
 * Subjects in order, each followed by every topic under it at any depth — the
 * tree as one list. `path` names a topic by its whole branch below the subject
 * (`roasting › maillard`), since two topics in different branches may share a name.
 */
export function topicOptions(topics: readonly Node[]): { subject: Node; children: { topic: Node; path: string }[] }[] {
  const byOrder = [...topics].sort((a, b) => a.sort_order - b.sort_order)
  return buildTree(byOrder).map(({ row: subject, children }) => ({
    subject,
    children: flattenTree(children).map(({ row: topic }) => ({
      topic,
      path: [...ancestorsOf(byOrder, topic.id), topic].map((t) => t.title).join(' › '),
    })),
  }))
}

/** A topic named by its whole branch, the way the panel and the summary line both show it. */
export function topicPath(topics: readonly Node[], id: string | null | undefined): string | null {
  const t = id ? topics.find((n) => n.id === id) : undefined
  return t ? [...ancestorsOf(topics, t.id), t].map((n) => n.title).join(' › ') : null
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ background: desk.panel, border: `1px solid ${desk.line}`, borderRadius: 6, padding: '4px 14px' }}>
      <h3 style={{ margin: 0, padding: '10px 0 6px', fontSize: 12, fontWeight: 600, color: ink.soft }}>{title}</h3>
      {children}
    </section>
  )
}

/** A label above its control: the panel is too narrow for the two side by side once a field holds chips. */
function Prop({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="cfg-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: ink.strong }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
      {hint && <span style={{ fontSize: 12, color: ink.soft, lineHeight: 1.45 }}>{hint}</span>}
    </div>
  )
}

const chip = { display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 2px 1px 8px', borderRadius: 999, fontSize: 13, color: '#2A2016' } as const

export function PostSettings({
  open,
  onClose,
  post,
  byline,
  modules,
  topics,
  template,
  canChangeTemplate,
  derivedSlug,
  onPatch,
  onSlug,
  onForget,
}: {
  open: boolean
  onClose: () => void
  post: PostDetail
  /** Who stood on the byline when the post was loaded; `AuthorPicker` keeps it from there. */
  byline: AuthorRef[]
  modules: Module[]
  topics: Node[]
  template: PostTemplate
  /** Only while nothing is written: the templates hold differently shaped bodies. */
  canChangeTemplate: boolean
  /** The address the post is reached at while nothing is stored. */
  derivedSlug: string
  onPatch: (patch: SettingsPatch) => void
  /** Resolves to an error message, or null when the address was taken. */
  onSlug: (slug: string) => Promise<string | null>
  /** Stop an old address forwarding to this post. */
  onForget?: (slug: string) => void
}) {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [slugError, setSlugError] = useState<string | null>(null)
  const panel = useRef<HTMLElement>(null)
  // Closed, the panel is only slid off screen: keep Tab and screen readers out of it.
  useEffect(() => {
    panel.current?.toggleAttribute('inert', !open)
  }, [open])

  useEffect(() => {
    void listKeywords().then(setKeywords)
  }, [])

  const wearing = post.keywords ?? []
  const kw = (id: string) => keywords.find((k) => k.id === id)
  const activeModule = modules.find((m) => m.id === post.module_id)

  async function addKeyword(text: string) {
    const v = text.trim().replace(/^#/, '')
    if (!v) return
    const known = keywords.find((k) => k.label.toLowerCase() === v.toLowerCase() || k.id === v)
    const made = known ?? (await createKeyword(v))
    if (!known) setKeywords((ks) => [...ks, made])
    if (!wearing.includes(made.id)) onPatch({ keywords: [...wearing, made.id] })
  }

  async function commitSlug(value: string) {
    const v = value.trim()
    if (!v || v === (post.slug ?? derivedSlug)) return setSlugError(null)
    setSlugError(await onSlug(v))
  }

  return (
    <aside
      aria-label="Thông tin bài"
      ref={panel}
      aria-hidden={!open}
      className="cfg-detail"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: `min(${SETTINGS_WIDTH}px, 100vw)`,
        boxSizing: 'border-box',
        background: desk.ground,
        borderLeft: `1px solid ${desk.line}`,
        boxShadow: open ? '-8px 0 24px rgba(0,0,0,.06)' : 'none',
        transform: open ? 'none' : 'translateX(100%)',
        transition: 'transform .2s ease, box-shadow .2s ease',
        overflowY: 'auto',
        padding: '14px 16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: sans,
        color: ink.base,
        zIndex: 20,
      }}
    >
      {/* The editor is its own screen, outside the Cms desk that mounts these frames. */}
      <style>{DETAIL_CSS + '@media (prefers-reduced-motion: reduce) { aside[aria-label="Thông tin bài"] { transition: none !important; } }'}</style>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 600 }}>Thông tin bài</h2>
        <IconButton label="Đóng thông tin bài" onClick={onClose}>
          <IconClose />
        </IconButton>
      </div>

      <Group title="Vị trí">
        <Prop label="Chủ đề" hint="Bài hiện ở mục này trong Mục lục.">
          <select aria-label="Chủ đề" value={post.topic_id ?? ''} onChange={(e) => onPatch({ topic_id: e.target.value || null })} style={{ width: '100%' }}>
            {!post.topic_id && <option value="">—</option>}
            {topicOptions(topics).map(({ subject, children }) => (
              <optgroup key={subject.id} label={subject.title}>
                <option value={subject.id}>{subject.title}</option>
                {children.map(({ topic: t, path }) => (
                  <option key={t.id} value={t.id}>
                    {path}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Prop>
        <Prop label="Tag" hint="Tag dùng chung cho mọi site. Gõ tên rồi Enter.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {wearing.map((id) => {
              const color = tagColor(id, kw(id)?.color)
              const label = kw(id)?.label ?? id
              return (
                <span key={id} style={{ ...chip, border: `1px solid ${color}`, background: `${color}2E` }}>
                  #{label}
                  <IconButton size="sm" label={`bỏ tag ${label}`} onClick={() => onPatch({ keywords: wearing.filter((k) => k !== id) })} style={{ width: 20, height: 20 }}>
                    <IconClose size={12} />
                  </IconButton>
                </span>
              )
            })}
            <input
              aria-label="Thêm tag"
              list="post-keywords"
              placeholder="#tên tag"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                const el = e.currentTarget
                void addKeyword(el.value)
                el.value = ''
              }}
              style={{ width: 150 }}
            />
            <datalist id="post-keywords">
              {keywords
                .filter((k) => !wearing.includes(k.id))
                .map((k) => (
                  <option key={k.id} value={k.label} />
                ))}
            </datalist>
          </div>
        </Prop>
      </Group>

      <Group title="Người viết">
        <Prop label="Tác giả" hint="Thứ tự ở đây là thứ tự trên dòng tác giả.">
          <AuthorPicker key={post.id} postId={post.id} initial={byline} />
        </Prop>
      </Group>

      <Group title="Hiển thị">
        <Prop label="Template" hint={canChangeTemplate ? undefined : 'Bài đã có chữ nên không đổi được nữa.'}>
          {canChangeTemplate ? (
            <select aria-label="Template" value={template} onChange={(e) => onPatch({ template: e.target.value })} style={{ width: '100%' }}>
              {Object.entries(TEMPLATE_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 14 }}>{TEMPLATE_LABEL[template]}</span>
          )}
        </Prop>
        {/*
          * Named for what it still does. Where a post shows on the blog is the
          * topic's job now; the module only lends its colour, the address a post
          * gets until one is typed, and the list of an old page with no rule.
          */}
        <Prop label="Màu mượn từ" hint="Màu mặc định và địa chỉ tự sinh lấy từ module này. Bài hiện ở đâu là do Chủ đề.">
          <select aria-label="Module" value={post.module_id} onChange={(e) => onPatch({ module_id: e.target.value })} style={{ width: '100%' }}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </Prop>
        <Prop label="Màu bài">
          <ThemePicker
            value={post.theme_color}
            moduleColor={activeModule?.accent}
            moduleLabel={activeModule?.title}
            themes={modules.map((m) => ({ id: m.id, label: m.title, color: m.accent }))}
            onChange={(theme_color) => onPatch({ theme_color })}
          />
        </Prop>
      </Group>

      <Group title="Địa chỉ & quyền xem">
        <Prop label="Quyền xem">
          <Choice
            label="Quyền xem"
            value={post.visibility}
            options={[
              { value: 'public', label: 'Công khai' },
              { value: 'private', label: 'Riêng tư' },
            ]}
            onChange={(visibility) => onPatch({ visibility })}
          />
        </Prop>
        <Prop
          label="Địa chỉ"
          hint={
            slugError ? (
              <span role="alert" style={{ color: ink.danger }}>
                {slugError}
              </span>
            ) : (
              'Để trống thì dùng địa chỉ tự sinh. Enter để lưu, Esc để bỏ.'
            )
          }
        >
          <input
            aria-label="Địa chỉ"
            key={post.slug ?? derivedSlug}
            defaultValue={post.slug ?? ''}
            placeholder={derivedSlug}
            onBlur={(e) => void commitSlug(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                // The field's own undo, not the panel's close.
                e.stopPropagation()
                e.currentTarget.value = post.slug ?? ''
                setSlugError(null)
              }
            }}
            style={{ width: '100%' }}
          />
        </Prop>
        {(post.old_slugs ?? []).length > 0 && (
          <Prop label="Địa chỉ cũ" hint="Vẫn chuyển về bài này. Bỏ đi thì địa chỉ ấy trống lại.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(post.old_slugs ?? []).map((s) => (
                <span key={s} style={{ ...chip, border: `1px solid ${desk.field}`, background: desk.panel, borderRadius: 6 }}>
                  {s}
                  {onForget && (
                    <IconButton size="sm" label={`bỏ địa chỉ cũ ${s}`} onClick={() => onForget(s)} style={{ width: 20, height: 20 }}>
                      <IconClose size={12} />
                    </IconButton>
                  )}
                </span>
              ))}
            </div>
          </Prop>
        )}
      </Group>
    </aside>
  )
}
