/**
 * Báo khi trang đang mở là bản cũ, và tải lại bằng một nút.
 *
 * A tab left open on /ad-config keeps running the bundle it loaded, however
 * many deploys land after it. Nothing in the page could tell, so every deploy
 * came with "Ctrl+Shift+R once" — a step the owner had to remember, and the
 * symptom of forgetting it was a fix that looked like it did not ship.
 *
 * Vite names the entry script by its content hash, so the cheapest version
 * stamp is already in `index.html`: fetch it fresh and compare the script name
 * with the one this page is running. No build step, no version file to keep in
 * sync.
 *
 * It asks, it does not reload by itself: the editor holds unsaved text, and a
 * reload the writer did not press is how that text gets lost.
 */
import { useEffect, useState } from 'react'
import { Button } from '../design/Button'
import { radius } from '../design/controls'
import { ink, paper, sans } from '../design/tokens'

/** How often an open, visible tab checks for a new deploy. */
export const CHECK_EVERY_MS = 5 * 60 * 1000

/** The hashed entry script a built `index.html` loads, or null in dev. */
export function entryScript(html: string): string | null {
  const m = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/)
  return m ? m[1] : null
}

async function latestEntry(): Promise<string | null> {
  // `no-store` so neither the browser nor anything in between answers with the
  // copy this tab was built from.
  const res = await fetch('/', { cache: 'no-store' })
  if (!res.ok) return null
  return entryScript(await res.text())
}

export function NewVersionNotice() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const running = entryScript(document.documentElement.outerHTML)
    // Dev server and tests have no hashed entry, so there is nothing to compare.
    if (!running) return

    let stopped = false
    const check = () => {
      if (document.visibilityState !== 'visible') return
      latestEntry()
        .then((latest) => {
          if (!stopped && latest && latest !== running) setStale(true)
        })
        // Offline or a deploy mid-flight: try again at the next check.
        .catch(() => {})
    }

    const timer = window.setInterval(check, CHECK_EVERY_MS)
    // Coming back to the tab is the moment a deploy has most likely happened.
    document.addEventListener('visibilitychange', check)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  if (!stale) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 40px)',
        padding: '8px 8px 8px 14px',
        borderRadius: radius,
        border: `1px solid ${ink.border}`,
        background: paper.white,
        color: ink.strong,
        fontFamily: sans,
        fontSize: 12.5,
        boxShadow: '0 2px 6px rgba(35, 33, 26, .07)',
      }}
    >
      <span>Trang vừa có bản mới.</span>
      <Button level="primary" size="sm" onClick={() => window.location.reload()}>
        Tải lại
      </Button>
    </div>
  )
}
