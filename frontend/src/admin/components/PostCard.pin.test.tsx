import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PostCard } from './PostCard'
import type { PostSummary } from '../lib/apiClient'

const post = (over: Partial<PostSummary> = {}): PostSummary =>
  ({
    id: 'p1',
    module_id: 'sensory',
    en: 'Sensory Lexicon',
    vi: 'mô tả',
    kind: 'ref',
    date_label: '2026.03',
    status: 'published',
    template: 'cards',
    hero_image_url: null,
    thumbnail_url: null,
    sort_order: null,
    pinned: false,
    created_at: '',
    updated_at: '',
    published_at: null,
    ...over,
  }) as PostSummary

// The pin was the emoji 📌 held at opacity .18 until hovered, so its whole
// accessible name was the emoji and a pin nobody hovered was invisible. It is
// an icon button now, named by what pressing it does.
const pin = () => screen.getByRole('button', { name: /ghim/i })

describe('ghim bài', () => {
  it('ghim được từ danh sách, ở mọi module — không riêng Ghi 01', () => {
    const onPin = vi.fn()
    render(
      <PostCard post={post({ module_id: 'biochem' })} onAction={vi.fn()} onEdit={vi.fn()} onCopy={vi.fn()} onPin={onPin} />,
    )
    fireEvent.click(pin())
    expect(onPin).toHaveBeenCalledWith('p1', true)
  })

  it('bài đang ghim thì bấm lại là bỏ ghim', () => {
    const onPin = vi.fn()
    render(<PostCard post={post({ pinned: true })} onAction={vi.fn()} onEdit={vi.fn()} onCopy={vi.fn()} onPin={onPin} />)
    expect(pin()).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(pin())
    expect(onPin).toHaveBeenCalledWith('p1', false)
  })

  it('nhìn là biết bài nào đang ghim, và thấy nó cả khi chưa rê chuột', () => {
    const { rerender } = render(
      <PostCard post={post({ pinned: false })} onAction={vi.fn()} onEdit={vi.fn()} onCopy={vi.fn()} onPin={vi.fn()} />,
    )
    // Không ghim: nút vẫn vẽ đủ viền, chỉ là nền trắng.
    expect(pin().className).toContain('ab-ghost')
    expect(pin()).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <PostCard post={post({ pinned: true })} onAction={vi.fn()} onEdit={vi.fn()} onCopy={vi.fn()} onPin={vi.fn()} />,
    )
    // Ghim rồi: nền đặc, khác hẳn phần còn lại của hàng.
    expect(pin().className).toContain('ab-primary')
  })

  it('“Xoá” không trông giống “Sửa”', () => {
    render(<PostCard post={post()} onAction={vi.fn()} onEdit={vi.fn()} onCopy={vi.fn()} onPin={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Sửa' }).className).toContain('ab-ghost')
    expect(screen.getByRole('button', { name: 'Xoá' }).className).toContain('ab-danger')
  })
})
