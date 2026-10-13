import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ink, paper, sans, serif } from '../../design/tokens'
import { radius } from '../../design/controls'

/**
 * The one shape every detail panel of Cấu hình is drawn in (owner, 2026-10-13).
 *
 * Each item used to bring its own layout: Mục lục a form, a topic a column of
 * boxes, a port page a builder, and "Các trang port" three buttons on an empty
 * page. Where to add a thing and where to delete it moved from screen to
 * screen, and some could not be deleted at all. The owner asked for one
 * template for everything that does the same job, and for no boxes:
 *
 * - `DetailHead`: where you are, the name, the public address, the status,
 *   and a ⋮ that is the only place anything is deleted — on a page that
 *   cannot be, the line is still there, greyed, saying why;
 * - `Section` + `Row`: fields as lines of text on hairlines, a label on the
 *   left; an input shows its underline only when it is being typed in;
 * - `ItemList`: the children of the item, read like a book's contents, with
 *   "+ Thêm …" as the last line, which opens one new line and a Lưu button.
 *
 * Fields drawn by older editors inside a panel (the port's blocks, a page's
 * fixed copy) lose their boxes through `DETAIL_CSS`, scoped to `.cfg-detail`.
 */

export type DetailAction = {
  label: string
  onPick?: () => void
  danger?: true
  /** Why the action cannot be taken here; the line is shown greyed with this under it. */
  off?: string
}

const crumbStyle = { fontFamily: sans, fontSize: 11.5, color: ink.muted } as const
const quiet = { all: 'unset', cursor: 'pointer', fontFamily: sans, fontSize: 12, color: ink.soft } as const

function Menu({ actions }: { actions: DetailAction[] }) {
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
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" aria-label="Thao tác" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...quiet, fontSize: 16, padding: '0 6px', color: open ? ink.base : ink.soft }}>
        ⋮
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 26, zIndex: 5, width: 220, background: paper.cream, borderTop: `1px solid ${ink.base}`, borderBottom: `1px solid ${ink.base}`, boxShadow: '0 10px 24px rgba(35,33,26,.10)', padding: '4px 0' }}>
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
              style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', padding: '7px 12px', cursor: a.off ? 'default' : 'pointer', fontFamily: sans, fontSize: 13, color: a.off ? ink.faint : a.danger ? ink.danger : ink.base, borderTop: a.danger ? `1px solid ${paper.rule}` : undefined }}
            >
              {a.label}
              {a.off && <span style={{ display: 'block', fontSize: 11, color: ink.faint }}>{a.off}</span>}
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
  crumbs: string[]
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
    <header style={{ margin: '4px 0 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div aria-label="Đang sửa" style={{ ...crumbStyle, flex: 1 }}>
          {crumbs.join(' › ')}
        </div>
        {address && (
          <a href={address} target="_blank" rel="noreferrer" style={{ ...quiet, color: ink.soft }}>
            xem trang ↗
          </a>
        )}
        <Menu actions={actions} />
      </div>
      <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 32, letterSpacing: '-.02em', lineHeight: 1.15, margin: '4px 0 2px', color: ink.base }}>
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
      {(address || facts.length > 0) && (
        <div style={{ fontFamily: sans, fontSize: 12, color: ink.muted }}>
          {[address && <span key="a" style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: ink.green }}>{address}</span>, ...facts.map((f) => <span key={f}>{f}</span>)]
            .filter(Boolean)
            .flatMap((x, i) => (i ? [<span key={`s${i}`}> · </span>, x] : [x]))}
        </div>
      )}
    </header>
  )
}

export function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h3 style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, fontSize: 15, color: ink.soft, margin: 0 }}>{title}</h3>
        {note && <span style={{ fontFamily: sans, fontSize: 11.5, color: ink.faint, textAlign: 'right' }}>{note}</span>}
      </div>
      {children}
    </section>
  )
}

/** One field: its name on the left, the value on the right, a hairline above. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: 16, alignItems: 'start', padding: '9px 0', borderTop: `1px solid ${paper.rule}`, fontFamily: sans, fontSize: 13.5, color: ink.base }}>
      <span style={{ fontSize: 11.5, color: ink.muted, paddingTop: 3 }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

/** A short set of choices as words; the one in force is underlined. */
export function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <span role="group" aria-label={label}>
      {options.map((o, i) => (
        <span key={o.value}>
          {i > 0 && <span style={{ color: ink.faint }}> · </span>}
          <button
            type="button"
            aria-pressed={o.value === value}
            onClick={() => o.value !== value && onChange(o.value)}
            style={{ all: 'unset', cursor: 'pointer', color: o.value === value ? ink.base : ink.muted, textDecoration: o.value === value ? 'underline' : 'none', textUnderlineOffset: 3 }}
          >
            {o.label}
          </button>
        </span>
      ))}
    </span>
  )
}

/** A text field that reads as text until it is typed in. Saves on leaving it. */
export function LineInput({ label, value, onSave, multiline, placeholder, mono }: { label: string; value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; mono?: boolean }) {
  const common = {
    'aria-label': label,
    defaultValue: value,
    placeholder: placeholder ?? 'bấm để viết…',
    className: 'cfg-line',
    style: { width: '100%', font: 'inherit', fontFamily: mono ? 'ui-monospace, Menlo, monospace' : 'inherit', color: 'inherit', lineHeight: 1.5 },
    onBlur: (e: { target: { value: string } }) => e.target.value !== value && onSave(e.target.value),
  }
  return multiline ? <textarea key={value} rows={2} {...common} style={{ ...common.style, resize: 'vertical' }} /> : <input key={value} {...common} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
}

export type ListItem = { id: string; name: string; meta?: string; dot?: string | null; onOpen: () => void }

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
      <button type="button" onClick={() => setOpen(true)} style={{ ...quiet, color: ink.green, fontSize: 13, padding: '10px 0 0 28px' }}>
        + {spec.label}
      </button>
    )
  return (
    <div style={{ padding: '10px 0 10px 28px', borderBottom: `1px solid ${paper.rule}` }}>
      <input
        autoFocus
        aria-label={spec.label}
        placeholder={spec.placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => (e.key === 'Enter' ? save() : e.key === 'Escape' && close())}
        className="cfg-line cfg-line-on"
        style={{ fontFamily: serif, fontSize: 16, color: ink.base, minWidth: 240 }}
      />
      {spec.choose && (
        <div style={{ marginTop: 10, fontFamily: sans, fontSize: 13, color: ink.soft }}>
          {spec.choose.label} &nbsp; <Choice label={spec.choose.label} options={spec.choose.options} value={choice} onChange={setChoice} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 12 }}>
        <button type="button" disabled={!name.trim()} onClick={save} style={{ all: 'unset', cursor: name.trim() ? 'pointer' : 'default', background: name.trim() ? ink.base : ink.faint, color: paper.cream, borderRadius: radius, padding: '5px 16px', fontFamily: sans, fontSize: 13 }}>
          Lưu
        </button>
        <button type="button" onClick={close} style={{ ...quiet, color: ink.muted }}>
          Huỷ
        </button>
      </div>
    </div>
  )
}

/** The children of an item, numbered, a dotted leader to their facts; a click opens one. */
export function ItemList({ label, items, add, empty }: { label: string; items: ListItem[]; add?: AddSpec; empty?: string }) {
  return (
    <div>
      {items.length === 0 && empty && <p style={{ fontFamily: sans, fontSize: 12.5, color: ink.faint, margin: '8px 0 0 28px' }}>{empty}</p>}
      <ol aria-label={label} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((it, i) => (
          <li key={it.id} style={{ borderTop: `1px solid ${paper.rule}`, ...(i === items.length - 1 ? { borderBottom: `1px solid ${paper.rule}` } : {}) }}>
            <button type="button" onClick={it.onOpen} className="cfg-item" style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 4px 8px 0' }}>
              <span aria-hidden style={{ fontFamily: sans, fontSize: 11, color: ink.faint, width: 18, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {it.dot && <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: it.dot, flex: 'none', alignSelf: 'center' }} />}
              <span style={{ fontFamily: serif, fontSize: 16, color: ink.base }}>{it.name}</span>
              <span aria-hidden style={{ flex: 1, borderBottom: `1px dotted ${ink.faint}`, transform: 'translateY(-4px)', minWidth: 20 }} />
              {it.meta && <span style={{ fontFamily: sans, fontSize: 11.5, color: ink.muted, whiteSpace: 'nowrap' }}>{it.meta}</span>}
            </button>
          </li>
        ))}
      </ol>
      {add && <AddLine spec={add} />}
    </div>
  )
}

/**
 * Takes the boxes off every field inside a panel, the old editors' included:
 * no border but a hairline under it, the line darkening while it is typed in.
 * `!important` because those editors set their borders inline.
 */
export const DETAIL_CSS = `
.cfg-detail input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),
.cfg-detail textarea, .cfg-detail select, .cfg-line {
  border: 0 !important; border-bottom: 1px solid transparent !important; border-radius: 0 !important;
  background: transparent !important; box-shadow: none !important; outline: none; padding-left: 0 !important; padding-right: 0 !important;
}
.cfg-detail input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), .cfg-detail textarea, .cfg-detail select { border-bottom-color: ${paper.rule} !important; }
.cfg-detail input:focus, .cfg-detail textarea:focus, .cfg-detail select:focus, .cfg-line:focus, .cfg-line-on { border-bottom-color: ${ink.base} !important; }
.cfg-detail .cfg-item:hover { background: linear-gradient(90deg, ${paper.hover}, transparent); }
.cfg-detail .cfg-item:focus-visible { outline: 2px solid ${ink.green}; outline-offset: -2px; }
`
