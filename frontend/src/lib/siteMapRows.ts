import type { TreeRow } from './contentTree'
import { childrenOf } from './contentTree'
import { displayNumber } from './postText'

/**
 * One page on the site map, and what it holds.
 *
 * `kids` used to be `string[]` — pre-formatted lines, not rows. That is the
 * shape that made a third level impossible in the CMS: a list of strings has
 * nowhere to put a page that holds pages of its own, so however deep the site
 * got, the map could only ever draw two rows deep.
 */
export type MapRow = { label: string; desc: string; kids: MapRow[] }

/** The little this file needs to know about a module, and about a post. */
type Titled = TreeRow & { title: string; concept?: string }
type Named = { en: string }

/**
 * A module and everything under it: the modules filed inside it first, then its
 * own posts.
 *
 * Recursive, so the map is as deep as the site is and nothing here counts
 * levels. `postsOf` is handed in rather than queried because the screen already
 * has the posts loaded and already knows which of them a reader can reach — a
 * site map shows the site, and a post nobody can read is not on it.
 */
export function moduleMapRow<M extends Titled, P extends Named>(
  modules: readonly M[],
  m: M,
  postsOf: (moduleId: string) => readonly P[],
): MapRow {
  return {
    label: m.title,
    desc: m.concept ? `module · ${m.concept}` : 'module',
    kids: [
      ...childrenOf(modules, m.id).map((child) => moduleMapRow(modules, child, postsOf)),
      ...postsOf(m.id).map((p, i) => ({
        label: `${displayNumber(i)} · ${p.en}`,
        desc: '',
        kids: [],
      })),
    ],
  }
}
