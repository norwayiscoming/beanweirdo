import { describe, expect, it } from 'vitest'
import { cellRatio, featureCells } from './notes'

/**
 * Ghi 01 holds two kinds of cell and they must not be read as one list. A
 * feature cell belongs to the page's layout and is set up with the page; a
 * post is published into the module and set up where posts are written. The
 * posts fill the grid; the feature cells sit small at the foot of the page.
 */
describe('hai nhóm element ở Ghi 01', () => {
  it('ô feature có hệ đánh số riêng, liên tục F1…Fn', () => {
    expect(featureCells.map((f) => f.n)).toEqual(featureCells.map((_, i) => i + 1))
  })

  it('mỗi ô ảnh có tỉ lệ khung để cắt ảnh và vẽ ở chân trang', () => {
    for (const f of featureCells.filter((c) => c.kind === 'slot')) {
      const r = cellRatio(f)
      expect(Number.isFinite(r)).toBe(true)
      expect(r).toBeGreaterThan(0)
    }
  })
})
