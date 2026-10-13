import { useState } from 'react'
import { ink, paper, sans } from '../../design/tokens'

/**
 * The row of site tabs (Personal Blog | Port | …) that splits an admin screen
 * by site. Cài đặt hiển thị had it first; the owner asked for the same bar on
 * Cấu hình, so both screens draw this one and they cannot drift apart.
 */
export function SiteTabs<T extends string>({ tabs, labels, value, onChange }: { tabs: readonly T[]; labels: Record<T, string>; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" style={{ display: 'inline-flex', border: `1px solid ${paper.rule}`, background: paper.white }}>
      {tabs.map((s, i) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={value === s}
          onClick={() => onChange(s)}
          style={{ all: 'unset', cursor: 'pointer', fontFamily: sans, fontSize: 13, padding: '7px 18px', borderLeft: i ? `1px solid ${paper.rule}` : undefined, background: value === s ? ink.base : 'transparent', color: value === s ? paper.cream : ink.soft }}
        >
          {labels[s]}
        </button>
      ))}
    </div>
  )
}

/** The tab last open on this screen; storage is a convenience, so any failure falls back to the first tab. */
export function useRememberedTab<T extends string>(key: string, tabs: readonly T[]): [T, (t: T) => void] {
  const [tab, setTab] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key)
      return tabs.find((t) => t === v) ?? tabs[0]
    } catch {
      return tabs[0]
    }
  })
  const set = (t: T) => {
    setTab(t)
    try {
      localStorage.setItem(key, t)
    } catch {
      /* a remembered tab is a convenience */
    }
  }
  return [tab, set]
}
