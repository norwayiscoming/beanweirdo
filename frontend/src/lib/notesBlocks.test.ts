import { describe, expect, it } from 'vitest'
import { placePosts } from './notesBlocks'

describe('placePosts — khối 8 ô cố định của Ghi 01', () => {
  it('bài cũ nhất vào ô 7, bài mới nhất lấp dần lên ô 0', () => {
    // Ba bài, mới nhất đứng đầu danh sách.
    expect(placePosts(3)).toEqual([
      { i: 0, block: 0, slot: 5 },
      { i: 1, block: 0, slot: 6 },
      { i: 2, block: 0, slot: 7 },
    ])
  })

  it('tám bài lấp kín một khối', () => {
    expect(placePosts(8).map((p) => p.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('bài thứ chín mở khối mới ở trên, bắt đầu từ ô 7', () => {
    const at = placePosts(9)
    expect(at[0]).toEqual({ i: 0, block: 0, slot: 7 })
    expect(at.slice(1).every((p) => p.block === 1)).toBe(true)
    expect(at.slice(1).map((p) => p.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('thêm bài mới không dời chỗ bài cũ', () => {
    const before = placePosts(5)
    const after = placePosts(6)
    // Bài cũ là bài i trong danh sách 5, và là bài i+1 trong danh sách 6.
    for (const p of before) expect(after[p.i + 1].slot).toBe(p.slot)
  })
})
