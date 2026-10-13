import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ink, paper, sans } from '../../design/tokens'
import { radius } from '../../design/controls'
import type { DropWhere } from '../../lib/treeMove'

/**
 * The one shape every detail panel of Cấu hình is drawn in (owner, 2026-10-13).
 *
 * Each item used to bring its own layout: Mục lục a form, a topic a column of
 * boxes, a port page a builder, and "Các trang port" three buttons on an empty
 * page. The owner asked for one template for everything that does the same job:
 *
 * - `DetailHead`: where you are, the name, the public address, the status,
 *   and a ⋮ that is the only place anything is deleted — on a page that
 *   cannot be, the line is still there, greyed, saying why;
 * - `Section` + `Row`: a panel per part, a label on the left of each field;
 * - `ItemList`: the children of the item, with "+ Thêm …" under them, which
 *   opens one new line and a Lưu button. Children are dragged into order and
 *   deleted from their own ⋮ here, since the tree on the left holds only cards.
 *
 * The first version was hairlines and light grey text on cream, and the owner
 * found it faint and hard to use ("mờ mờ mờ"). From three styles they picked
 * "Bàn làm việc" (2026-10-13): white panels on a warm grey desk, labels and
 * text in dark ink at 13–14px, fields with a visible frame, choices as joined
 * buttons, on/off as a switch. Fields drawn by older editors inside a panel
 * (the port's blocks, a page's fixed copy) get the same frames through
 * `DETAIL_CSS`, scoped to `.cfg-detail`.
 */

/** The desk and its panels. Ink stays the blog's; only the grounds are new. */
export const desk = {
  ground: '#EFEDE7',
  panel: '#FFFFFF',
  line: '#E3DFD5',
  /** The frame of a field: dark enough to see on white, lighter than a button's. */
  field: '#CFCABE',
  /** Behind the address and a selected row. */
  soft: '#E4F0DF',
} as const

export type DetailAction = {
  label: string
  onPick?: () => void
  danger?: true
  /** Why the action cannot be taken here; the line is shown greyed with this under it. */
  off?: string
}

/** One step of where the item sits; a step with `open` goes back to it. */
export type Crumb = { label: string; open?: () => void }

/** A framed button, the one shape every control on the panel takes. */
export const frame = {
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 34,
  padding: '0 14px',
  borderRadius: radius,
  border: `1px solid ${ink.border}`,
  background: desk.panel,
  fontFamily: sans,
  fontSize: 13.5,
  fontWeight: 500,
  color: ink.base,
  whiteSpace: 'nowrap',
} as const

function Menu({ actions, label = 'Thao tác', small }: { actions: DetailAction[]; label?: string; small?: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    // `mousedown`: a click that closes the menu must not also land on what is under it.
    const outside = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  const size = small ? 28 : 34
  return (
    <div ref={box} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="cfg-btn"
        style={{ ...frame, width: size, height: size, padding: 0, fontSize: 17, borderColor: small ? desk.field : ink.border, background: open ? paper.hover : desk.panel }}
      >
        ⋮
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: size + 4, zIndex: 5, width: 230, background: desk.panel, border: `1px solid ${ink.border}`, borderRadius: radius, boxShadow: '0 10px 24px rgba(35,33,26,.14)', padding: '4px 0' }}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled={!!a.off}
              onClick={() => {
                setOpen(false)
                a.onPick?.()
              }}
              className="cfg-menuitem"
              style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', padding: '9px 14px', cursor: a.off ? 'default' : 'pointer', fontFamily: sans, fontSize: 14, fontWeight: 500, color: a.off ? ink.muted : a.danger ? ink.danger : ink.base }}
            >
              {a.label}
              {a.off && <span style={{ display: 'block', fontSize: 12.5, fontWeight: 400, color: ink.soft, marginTop: 2 }}>{a.off}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailHead({
  crumbs,
  title,
  rename,
  address,
  facts = [],
  actions,
}: {
  /** Where the item sits, outermost first, without the item itself. */
  crumbs: Crumb[]
  title: string
  /** When set, the name is typed straight into the title. */
  rename?: (v: string) => void
  /** The public page, when the item has one. */
  address?: string
  /** Short facts after the address: a count, the status. */
  facts?: string[]
  actions: DetailAction[]
}) {
  return (
    <header style={{ display: 'grid', gap: 6, padding: '2px 2px 4px' }}>
      <div aria-label="Đang sửa" style={{ fontFamily: sans, fontSize: 13, color: ink.soft }}>
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && ' › '}
            {c.open ? (
              <button type="button" onClick={c.open} className="cfg-crumb" style={{ all: 'unset', cursor: 'pointer', color: ink.strong, textDecoration: 'underline', textDecorationColor: ink.faint, textUnderlineOffset: 3 }}>
                {c.label}
              </button>
            ) : (
              c.label
            )}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ flex: 1, minWidth: 200, fontFamily: sans, fontWeight: 600, fontSize: 26, letterSpacing: '-.01em', lineHeight: 1.2, margin: 0, color: ink.base }}>
          {rename ? (
            <input
              aria-label="Tên"
              key={title}
              defaultValue={title}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== title) rename(v)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="cfg-line"
              style={{ font: 'inherit', letterSpacing: 'inherit', color: 'inherit', width: '100%' }}
            />
          ) : (
            title
          )}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {address && (
            <a href={address} target="_blank" rel="noreferrer" className="cfg-btn" style={frame}>
              Xem trang ↗
            </a>
          )}
          <Menu actions={actions} />
        </div>
      </div>
      {(address || facts.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontFamily: sans, fontSize: 13, color: ink.strong }}>
          {address && <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, color: ink.moss, background: desk.soft, padding: '3px 8px', borderRadius: radius }}>{address}</span>}
          {facts.map((f, i) => (
            <span key={f}>
              {(i > 0 || address) && <span aria-hidden style={{ color: ink.faint, marginRight: 8 }}>·</span>}
              {f}
            </span>
          ))}
        </div>
      )}
    </header>
  )
}

/** One part of an item: a white panel on the desk, its name and a note at the top. */
export function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="cfg-sec" style={{ marginTop: 14, background: desk.panel, border: `1px solid ${desk.line}`, borderRadius: radius, padding: '0 18px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 12px', padding: '13px 0 11px', borderBottom: `1px solid ${desk.line}` }}>
        <h3 style={{ fontFamily: sans, fontWeight: 600, fontSize: 15, color: ink.base, margin: 0 }}>{title}</h3>
        {note && <span style={{ fontFamily: sans, fontSize: 13, color: ink.soft }}>{note}</span>}
      </div>
      {children}
    </section>
  )
}

/** One field: its name on the left, the value on the right, a line between fields. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cfg-field" style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 18, alignItems: 'center', padding: '11px 0', fontFamily: sans, fontSize: 14, color: ink.base }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: ink.strong }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

/** A short set of choices as joined buttons; the one in force is filled. */
export function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <span role="group" aria-label={label} style={{ display: 'inline-flex', flexWrap: 'wrap', border: `1px solid ${ink.border}`, borderRadius: radius, overflow: 'hidden', verticalAlign: 'middle' }}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => !on && onChange(o.value)}
            className="cfg-seg"
            style={{ all: 'unset', cursor: 'pointer', padding: '8px 14px', fontFamily: sans, fontSize: 13.5, fontWeight: 500, background: on ? ink.moss : desk.panel, color: on ? paper.white : ink.strong, borderLeft: i ? `1px solid ${desk.field}` : 'none' }}
          >
            {o.label}
          </button>
        )
      })}
    </span>
  )
}

/** On or off, as a switch with its state written beside it. */
export function Switch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-label={label} aria-checked={value} onClick={() => onChange(!value)} className="cfg-switch" style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: sans, fontSize: 14, color: ink.base }}>
      <span aria-hidden style={{ position: 'relative', width: 38, height: 22, borderRadius: 999, background: value ? ink.green : desk.field, flex: 'none', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: paper.white, boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'left .15s' }} />
      </span>
      {value ? 'Hiện' : 'Ẩn'}
    </button>
  )
}

/** A text field in a frame. Saves on leaving it. */
export function LineInput({ label, value, onSave, multiline, placeholder, mono }: { label: string; value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; mono?: boolean }) {
  const common = {
    'aria-label': label,
    defaultValue: value,
    placeholder: placeholder ?? 'bấm để viết…',
    style: { width: '100%', font: 'inherit', fontFamily: mono ? 'ui-monospace, Menlo, monospace' : 'inherit', color: 'inherit', lineHeight: 1.5 },
    onBlur: (e: { target: { value: string } }) => e.target.value !== value && onSave(e.target.value),
  }
  return multiline ? <textarea key={value} rows={2} {...common} style={{ ...common.style, resize: 'vertical' }} /> : <input key={value} {...common} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
}

export const WHERE_WORDS: Record<DropWhere, string> = { before: 'trước', after: 'sau', inside: 'vào trong' }

/** A row that can be dragged and dropped on; `mark` is where a drop held over it would land. */
export type ItemDrag = {
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  dragging: boolean
  mark: DropWhere | null
}

export type ListItem = {
  id: string
  name: string
  meta?: string
  dot?: string | null
  /** Indent under the row above, for a list that is a tree (Phần chung). */
  depth?: number
  onOpen: () => void
  drag?: ItemDrag
  /** The row's own ⋮: the same actions its detail's ⋮ holds. */
  actions?: DetailAction[]
}

/** What "+ Thêm …" asks before it saves: a name, and optionally one choice. */
export type AddSpec = {
  label: string
  placeholder: string
  choose?: { label: string; options: { value: string; label: string }[] }
  onSave: (name: string, choice?: string) => void
}

function AddLine({ spec }: { spec: AddSpec }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [choice, setChoice] = useState(spec.choose?.options[0]?.value ?? '')
  const close = () => {
    setOpen(false)
    setName('')
  }
  const save = () => {
    if (!name.trim()) return
    spec.onSave(name.trim(), spec.choose ? choice : undefined)
    close()
  }
  if (!open)
    return (
      <div style={{ paddingTop: 12 }}>
        <button type="button" onClick={() => setOpen(true)} className="cfg-btn" style={frame}>
          + {spec.label}
        </button>
      </div>
    )
  return (
    <div style={{ display: 'grid', gap: 12, padding: '12px 0 2px' }}>
      <input
        autoFocus
        aria-label={spec.label}
        placeholder={spec.placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => (e.key === 'Enter' ? save() : e.key === 'Escape' && close())}
        style={{ fontFamily: sans, fontSize: 14.5, color: ink.base, maxWidth: 420 }}
      />
      {spec.choose && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontFamily: sans, fontSize: 13, fontWeight: 600, color: ink.strong }}>
          {spec.choose.label} <Choice label={spec.choose.label} options={spec.choose.options} value={choice} onChange={setChoice} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" disabled={!name.trim()} onClick={save} className="cfg-btn" style={{ ...frame, background: name.trim() ? ink.moss : paper.hover, borderColor: name.trim() ? ink.moss : desk.field, color: name.trim() ? paper.white : ink.muted, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
          Lưu
        </button>
        <button type="button" onClick={close} className="cfg-btn" style={{ ...frame, borderColor: 'transparent', background: 'transparent', color: ink.strong }}>
          Huỷ
        </button>
      </div>
    </div>
  )
}

/** The children of an item, numbered, with their facts at the end; a click opens one. */
export function ItemList({ label, items, add, empty }: { label: string; items: ListItem[]; add?: AddSpec; empty?: string }) {
  return (
    <div>
      {items.length === 0 && empty && <p style={{ fontFamily: sans, fontSize: 13.5, color: ink.soft, margin: '12px 0 0' }}>{empty}</p>}
      <ol aria-label={label} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((it, i) => {
          const mark = it.drag?.mark
          return (
            <li
              key={it.id}
              className="cfg-row"
              onDragOver={it.drag?.onDragOver}
              onDragLeave={it.drag?.onDragLeave}
              onDrop={it.drag?.onDrop}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderTop: i ? `1px solid ${desk.line}` : 'none',
                // Where the drop will land: a line above or below, or the whole row lit for "inside".
                boxShadow: mark === 'before' ? `inset 0 3px 0 ${ink.green}` : mark === 'after' ? `inset 0 -3px 0 ${ink.green}` : 'none',
                outline: mark === 'inside' ? `2px solid ${ink.green}` : 'none',
                outlineOffset: -2,
                background: mark === 'inside' ? desk.soft : 'transparent',
                opacity: it.drag?.dragging ? 0.45 : 1,
              }}
            >
              {it.drag ? (
                // Only the grip starts a drag, so a click that slips never moves anything.
                <span
                  className="cfg-grip"
                  draggable
                  role="img"
                  aria-label={`Kéo ${it.name}`}
                  title={`Kéo ${it.name}`}
                  onDragStart={it.drag.onDragStart}
                  onDragEnd={it.drag.onDragEnd}
                  style={{ flex: 'none', width: 20, textAlign: 'center', color: ink.soft, fontSize: 14, letterSpacing: -2, cursor: 'grab', userSelect: 'none' }}
                >
                  ⋮⋮
                </span>
              ) : (
                <span style={{ width: 20, flex: 'none' }} />
              )}
              <button type="button" onClick={it.onOpen} className="cfg-item" style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 6px', paddingLeft: 6 + (it.depth ?? 0) * 20, borderRadius: radius }}>
                <span aria-hidden style={{ fontFamily: sans, fontSize: 12.5, color: ink.soft, width: 20, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {it.dot && <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: it.dot, flex: 'none' }} />}
                <span style={{ flex: 1, minWidth: 0, fontFamily: sans, fontSize: 14.5, fontWeight: 500, color: ink.base, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                {/* While something is held over the row, its facts give way to where the drop will land. */}
                {mark ? (
                  <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: ink.green, whiteSpace: 'nowrap' }}>
                    {WHERE_WORDS[mark]} {it.name}
                  </span>
                ) : (
                  it.meta && <span style={{ fontFamily: sans, fontSize: 13, color: ink.strong, whiteSpace: 'nowrap' }}>{it.meta}</span>
                )}
              </button>
              {it.actions ? <Menu actions={it.actions} label={`Thao tác ${it.name}`} small /> : <span style={{ width: 28, flex: 'none' }} />}
            </li>
          )
        })}
      </ol>
      {add && <AddLine spec={add} />}
    </div>
  )
}

/**
 * Gives every field inside a panel the same frame, the old editors' included,
 * and draws hover and focus, which inline styles cannot. `!important` because
 * those editors set their borders inline. The title's `.cfg-line` stays
 * frameless until it is pointed at, since it reads as the page's name.
 */
export const DETAIL_CSS = `
.cfg-detail input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not(.cfg-line),
.cfg-detail textarea, .cfg-detail select {
  border: 1px solid ${desk.field} !important; border-radius: ${radius}px !important; background: ${desk.panel} !important;
  box-shadow: none !important; outline: none; padding: 8px 11px !important; box-sizing: border-box;
  font-family: ${sans}; font-size: 14px !important; color: ${ink.base} !important; max-width: 100%;
}
.cfg-detail input::placeholder, .cfg-detail textarea::placeholder { color: ${ink.muted}; }
.cfg-detail input:hover, .cfg-detail textarea:hover, .cfg-detail select:hover { border-color: ${ink.soft} !important; }
.cfg-detail input:focus, .cfg-detail textarea:focus, .cfg-detail select:focus { border-color: ${ink.base} !important; box-shadow: 0 0 0 3px ${desk.soft} !important; }
.cfg-detail .cfg-line { border: 1px solid transparent; border-radius: ${radius}px; background: transparent; outline: none; padding: 2px 6px; margin-left: -7px; }
.cfg-detail .cfg-line:hover { border-color: ${desk.field}; }
.cfg-detail .cfg-line:focus { border-color: ${ink.base}; background: ${desk.panel}; box-shadow: 0 0 0 3px ${desk.soft}; }
.cfg-detail .cfg-field + .cfg-field { border-top: 1px solid ${desk.line}; }
.cfg-detail .cfg-btn:hover { background: ${paper.hover} !important; }
.cfg-detail .cfg-btn:focus-visible, .cfg-detail .cfg-seg:focus-visible, .cfg-detail .cfg-switch:focus-visible, .cfg-detail .cfg-item:focus-visible, .cfg-detail .cfg-crumb:focus-visible { outline: 3px solid ${ink.green}; outline-offset: 2px; }
.cfg-detail .cfg-seg:hover[aria-pressed=false] { background: ${paper.hover} !important; }
.cfg-detail .cfg-menuitem:hover:not(:disabled) { background: ${paper.hover}; }
.cfg-detail .cfg-item:hover { background: ${paper.hover}; }
.cfg-detail .cfg-crumb:hover { color: ${ink.base}; text-decoration-color: ${ink.base}; }
.cfg-detail .cfg-row .cfg-grip { opacity: .55; }
.cfg-detail .cfg-row:hover .cfg-grip, .cfg-detail .cfg-row:focus-within .cfg-grip { opacity: 1; }
.cfg-detail label, .cfg-detail .cfg-sec { font-family: ${sans}; }
@media (max-width: 640px) { .cfg-detail .cfg-field { grid-template-columns: minmax(0, 1fr) !important; gap: 8px !important; } }
@media (prefers-reduced-motion: reduce) { .cfg-detail .cfg-switch span, .cfg-detail .cfg-switch span span { transition: none !important; } }
`
