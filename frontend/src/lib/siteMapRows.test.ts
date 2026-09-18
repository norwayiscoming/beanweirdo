import { describe, expect, it } from 'vitest'
import { moduleMapRow } from './siteMapRows'

/*
 * The CMS site map was the last surface structurally incapable of nesting:
 * `MapRow.kids` was `string[]`, a list of pre-formatted lines, so a page that
 * holds pages had nowhere to go. These check the shape that replaced it.
 */

const mod = (id: string, parent_id: string | null = null, concept?: string) => ({
  id,
  title: id,
  parent_id,
  concept,
})

const post = (en: string) => ({ en })

const TREE = [
  mod('bean', null, 'roast'),
  mod('roasting', 'bean'),
  mod('heat', 'roasting'),
  mod('sensory'),
]

const POSTS: Record<string, { en: string }[]> = {
  bean: [post('Mở đầu')],
  roasting: [post('Rang nhạt'), post('Rang đậm')],
  heat: [post('Dẫn nhiệt')],
}
const postsOf = (id: string) => POSTS[id] ?? []

const labels = (rows: { label: string; kids: unknown[] }[]): unknown[] =>
  rows.map((r) => [r.label, labels(r.kids as never)])

describe('a module row on the site map', () => {
  it('carries the modules filed inside it, then its own posts', () => {
    const row = moduleMapRow(TREE, TREE[0], postsOf)
    expect(row.kids.map((k) => k.label)).toEqual(['roasting', '01 · Mở đầu'])
  })

  it('goes as deep as the site does, with nothing counting levels', () => {
    const row = moduleMapRow(TREE, TREE[0], postsOf)
    expect(labels([row])).toEqual([
      [
        'bean',
        [
          ['roasting', [['heat', [['01 · Dẫn nhiệt', []]]], ['01 · Rang nhạt', []], ['02 · Rang đậm', []]]],
          ['01 · Mở đầu', []],
        ],
      ],
    ])
  })

  it('numbers posts by where they sit in the list shown, not across the site', () => {
    const row = moduleMapRow(TREE, TREE[1], postsOf)
    expect(row.kids.map((k) => k.label)).toEqual(['heat', '01 · Rang nhạt', '02 · Rang đậm'])
  })

  it('reads exactly as before for a module with nothing filed inside it', () => {
    const row = moduleMapRow(TREE, TREE[3], postsOf)
    expect(row).toEqual({ label: 'sensory', desc: 'module', kids: [] })
  })

  it('says what a module is about when it has a concept, and just "module" when not', () => {
    expect(moduleMapRow(TREE, TREE[0], postsOf).desc).toBe('module · roast')
    expect(moduleMapRow(TREE, TREE[1], postsOf).desc).toBe('module')
  })

  it('leaves a post row empty of children, so nothing recurses into a post', () => {
    const row = moduleMapRow(TREE, TREE[2], postsOf)
    expect(row.kids).toEqual([{ label: '01 · Dẫn nhiệt', desc: '', kids: [] }])
  })
})
