/**
 * One item in an editable list, with the handles that make it one.
 *
 * The report editor grew these first: a grip in the left margin that drags to
 * reorder and takes Delete, and a pair of buttons on the right to copy or
 * remove. Article, cards and memo had none of it — their editors let you write
 * over the words that were already there and nothing else, so a post had
 * exactly as many parts as the template it was copied from, forever.
 *
 * Rather than write that three more times, it is one component. Keyboard works
 * everywhere it does: a handle that can only be dragged is a handle half the
 * people using it cannot reach.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { FLOW_EXIT, exitThing, thingKeyDown } from '../lib/flowFocus'

export const GRIP_LABEL = 'Kéo thả để đổi thứ tự · Delete để xoá'

export type RowShellProps = {
  children: ReactNode
  /** What this row is called in the controls' labels — "khối", "phần", "thẻ". */
  noun: string
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onDuplicate?: () => void
  /** Drag state, from `useRowDrag`. */
  index: number
  drag: RowDrag
  /** Extra controls, shown before copy and remove. */
  extra?: ReactNode
  /** Nút `+` của máng bên trái, và menu nổi của nó. */
  plus?: ReactNode
  /**
   * Hàng này là một khối **trong thân bài**, đứng giữa các dải chữ — mở một
   * dòng chữ trống ngay sau nó. Có hàm này thì hàng nhận luật bàn phím của
   * thân bài (`thingKeyDown`): Enter thoát khối, mũi tên đi xuyên qua nó.
   */
  onAddLine?: () => void
}

export function RowShell({ children, noun, onMove, onRemove, onDuplicate, index, drag, extra, plus, onAddLine }: RowShellProps) {
  const box = useFlowThing(onAddLine)
  return (
    <div
      ref={box}
      data-flow={onAddLine ? 'thing' : undefined}
      data-flow-at={onAddLine ? index : undefined}
      onKeyDown={onAddLine ? (e) => thingKeyDown(e, onRemove) : undefined}
      onDragOver={(e) => {
        if (drag.from === null) return
        e.preventDefault()
        drag.setOver(index)
      }}
      onDrop={() => drag.drop(index)}
    >
      {drag.over === index && drag.from !== null && drag.from !== index && <div className="awc-dropline" />}
      <div className="awc-rep-block">
        {/*
          * Máng bên trái gom hết nút: `+`, tay nắm, nhân bản, xoá. Trước đây
          * chúng nằm hai đầu và ✎ ⧉ × đè lên chính đoạn đang viết.
          */}
        <div className="awc-gutter">
        {plus}
        <button
          type="button"
          className="awc-grip"
          draggable
          onDragStart={() => drag.setFrom(index)}
          onDragEnd={drag.end}
          aria-label={GRIP_LABEL}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              onMove(-1)
              followGrip(e.currentTarget, index - 1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              onMove(1)
              followGrip(e.currentTarget, index + 1)
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault()
              onRemove()
            }
          }}
        >
          ⠿
          <span className="awc-grip-tip">{GRIP_LABEL}</span>
        </button>
        <div className="awc-block-controls">
          {extra}
          {onDuplicate && (
            <button type="button" onClick={onDuplicate} aria-label={`nhân bản ${noun}`}>
              ⧉
            </button>
          )}
          <button type="button" onClick={onRemove} aria-label={`xoá ${noun}`}>
            ×
          </button>
        </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export type RowDrag = {
  from: number | null
  over: number | null
  setFrom: (i: number | null) => void
  setOver: (i: number | null) => void
  drop: (to: number) => void
  end: () => void
}

/** The button that adds one more of whatever the list holds. */
export function AddRow({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    // `alignSelf` because some canvases lay their children out in a stretching
    // column, where a bare button spans the whole width and stops reading as one.
    <button type="button" className="awc-plus-btn" style={{ alignSelf: 'flex-start' }} onClick={onAdd}>
      + {label}
    </button>
  )
}

/**
 * Vỏ ngoài của một khối trong thân bài nghe lời xin thoát từ các ô bên trong.
 *
 * Đi bằng một sự kiện DOM thay vì một prop truyền xuống: ô bên trong có thể là
 * `input`, `textarea`, hay cả một mặt soạn Lexical (hộp ghi chú của long-form),
 * và không cái nào trong số ấy biết mình đang nằm trong khối nào.
 */
export function useFlowThing(onAddLine?: () => void) {
  const box = useRef<HTMLDivElement>(null)
  const latest = useRef(onAddLine)
  latest.current = onAddLine
  useEffect(() => {
    const el = box.current
    if (!el) return
    const exit = (e: Event) => {
      const add = latest.current
      if (!add) return
      e.stopPropagation()
      exitThing(el, add)
    }
    el.addEventListener(FLOW_EXIT, exit)
    return () => el.removeEventListener(FLOW_EXIT, exit)
  }, [])
  return box
}

/**
 * Tay nắm đi theo khối nó vừa dời.
 *
 * Hàng vẽ theo chỉ số, nên sau một lần dời thì tay nắm đang giữ focus là của
 * khối **khác** — bấm mũi tên lần nữa là dời nhầm khối. Đợi vẽ xong rồi đưa
 * focus sang tay nắm của khối ở chỗ mới.
 */
export function followGrip(grip: HTMLElement, to: number) {
  const root = grip.closest<HTMLElement>('[data-flow-root]')
  if (!root) return
  const find = () =>
    root.querySelector<HTMLElement>(`[data-flow="thing"][data-flow-at="${to}"] .awc-grip`)
  let tries = 8
  const step = () => {
    const el = find()
    if (el && el !== document.activeElement) el.focus()
    else if (--tries > 0) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
