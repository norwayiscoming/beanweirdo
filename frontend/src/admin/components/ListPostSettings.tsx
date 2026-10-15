import { useEffect, useState } from 'react'
import type { AuthorRef } from 'api-contract'
import { getPost, updatePost, type Module, type Node, type PostDetail } from '../lib/apiClient'
import { listModulesCached } from '../lib/lists'
import { resolveTemplate } from '../lib/postData'
import { usePostAddresses } from '../../data/usePostAddresses'
import { PostSettings, type SettingsPatch } from './PostSettings'

/**
 * The editor's "Thông tin bài" panel, opened on one post straight from the
 * post list.
 *
 * Owner (2026-10-15): clicking a post's info line should open "1 wizard chung"
 * to edit it without going into the post. It is the same panel as the
 * editor's, not a second form, so a field added there shows up here too.
 * Writes go through `updatePost` exactly as the editor's do, so a published
 * post gets the same draft rules either way.
 */
export function ListPostSettings({
  postId,
  topics,
  onClose,
  onError,
}: {
  postId: string | null
  topics: Node[]
  /** Called on close; the list reloads then, since authors write on their own. */
  onClose: () => void
  onError: (message: string) => void
}) {
  const addresses = usePostAddresses()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [byline, setByline] = useState<AuthorRef[]>([])
  const [modules, setModules] = useState<Module[]>([])
  // Mounted closed, opened a frame later, so the panel slides in as it does in the editor.
  const [shown, setShown] = useState(false)

  useEffect(() => {
    setPost(null)
    setShown(false)
    if (!postId) return
    let alive = true
    Promise.all([getPost(postId), listModulesCached()])
      .then(([{ authors, ...p }, mods]) => {
        if (!alive) return
        setByline(authors)
        setModules(mods)
        setPost(p)
        requestAnimationFrame(() => alive && setShown(true))
      })
      .catch((e: Error) => alive && onError(e.message))
    return () => {
      alive = false
    }
  }, [postId, onError])

  useEffect(() => {
    if (!postId) return
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [postId, onClose])

  if (!postId || !post) return null

  const hasContent = Array.isArray(post.body)
    ? post.body.length > 0
    : Object.keys((post.body ?? {}) as Record<string, unknown>).length > 0

  const patch = (p: SettingsPatch) => {
    // The panel's template is a free string; the editor casts the same way.
    setPost((prev) => (prev ? { ...prev, ...(p as Partial<PostDetail>) } : prev))
    void updatePost(post.id, p as Parameters<typeof updatePost>[1]).catch((e: Error) => onError(e.message))
  }

  return (
    <>
      <div aria-hidden onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19, background: shown ? 'rgba(35, 33, 26, 0.18)' : 'transparent', transition: 'background .2s ease' }} />
      <PostSettings
        open={shown}
        onClose={onClose}
        post={post}
        byline={byline}
        modules={modules}
        topics={topics}
        template={resolveTemplate(post)}
        canChangeTemplate={!hasContent}
        derivedSlug={addresses.slugOf(post.id)}
        onPatch={patch}
        onSlug={async (slug) => {
          try {
            const saved = await updatePost(post.id, { slug })
            setPost((prev) => (prev ? { ...prev, slug: saved.slug ?? null, old_slugs: saved.old_slugs } : prev))
            return null
          } catch (e) {
            return (e as Error).message
          }
        }}
        onForget={(slug) =>
          void updatePost(post.id, { forget_slugs: [slug] }).then((saved) => setPost((prev) => (prev ? { ...prev, old_slugs: saved.old_slugs } : prev)))
        }
      />
    </>
  )
}
