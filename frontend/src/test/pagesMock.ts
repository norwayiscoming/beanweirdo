/**
 * Test double for `data/useModules`: screens get their pages from the mocked
 * `useModules`, and each page lists the mocked posts filed under it — the
 * shape screens had before the feature layer, so screen tests keep testing
 * the screen rather than the rules (those have tests of their own).
 */
import type { PostRow } from '../data/usePublishedPosts'

type Fn = (...a: unknown[]) => { data?: unknown[]; loading?: boolean; error?: string | null }

export async function pagesModule(orig: () => Promise<unknown>, modulesOf: Fn, posts: () => PostRow[]) {
  const real = (await orig()) as typeof import('../data/useModules')
  const postsOf = (id: string) => {
    const page = real.findPage((modulesOf().data ?? []) as { id: string; aliases: string[] }[], id)
    const key = page?.id ?? id
    return posts().filter((p) => p.module_id === key)
  }
  return {
    ...real,
    useModules: (...a: unknown[]) => ({ ...modulesOf(...a), postsOf, groupsOf: (id: string) => [{ key: '', label: '', posts: postsOf(id) }], reload: () => {} }),
    usePagePosts: (id: string | null | undefined) => ({ data: id ? postsOf(id) : [], loading: Boolean(modulesOf().loading) }),
  }
}
