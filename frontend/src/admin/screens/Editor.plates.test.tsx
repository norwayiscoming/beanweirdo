import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { EditorCanvas } from './Editor'

/*
 * Màn sửa có nối móc nút tải ảnh vào khuôn bài hay không.
 *
 * `everyTemplate.test.tsx` bên post-renderer chứng minh **khuôn bài** vẽ nút
 * khi được đưa móc. Nó không chứng minh **màn sửa** đưa móc ấy xuống — và đó
 * là hai chuyện khác nhau: một khuôn bài vẽ đúng mà màn sửa quên truyền thì
 * trên màn hình không có nút nào, đúng thứ nhìn thấy được nhưng không bài kiểm
 * nào đỏ.
 *
 * Nên chỗ này dựng đúng `EditorCanvas` thật cho từng khuôn và đếm góc ô ảnh.
 */
const post = (template: string, over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    module_id: 'sensory',
    en: 'Tiêu đề',
    vi: 'Mô tả',
    kind: 'note',
    template,
    date_label: '2026.08',
    status: 'draft',
    body: template === 'memo' ? { sections: [] } : [],
    lead: null,
    hero_image_url: null,
    hero_caption: null,
    plate_images: null,
    pull_quote: null,
    further_reading: [],
    sort_order: null,
    pinned: false,
    created_at: '',
    updated_at: '',
    published_at: null,
    ...over,
  }) as never

const draw = (template: string, over?: Record<string, unknown>) =>
  render(
    <EditorCanvas
      template={template as never}
      post={post(template, over)}
      onChange={vi.fn()}
      onHeroDrop={vi.fn()}
    />,
  )

const corners = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('[data-plate-corner]'))
    .map((el) => el.getAttribute('data-plate-corner'))
    .sort()

describe('màn sửa nối nút tải ảnh vào từng ô ảnh cố định', () => {
  it('article: bốn ô của dàn trang, cộng một ô cho mỗi phần có hình', () => {
    const { container } = draw('article', {
      body: [
        {
          h: 'Phần',
          p: 'chữ',
          fig: { label: 'fig-1', note: '', caption: '', w: '200px', h: '140px', tint: '#EEE', margin: '0' },
        },
      ],
    })
    expect(corners(container)).toEqual(['detail', 'fig-0', 'hero', 'primary', 'secondary'])
  })

  it('memo: ô ảnh đầu trang dựng cả khi bài chưa có ảnh', () => {
    const { container } = draw('memo')
    expect(corners(container)).toEqual(['hero'])
  })

  it('bitesize: ô phương tiện và ô ảnh phụ', () => {
    const { container } = draw('bitesize', { body: { sub: 'chữ ô phụ' } })
    expect(corners(container)).toEqual(['hero', 'sub'])
  })

  it('longform: mỗi khung ảnh, kể cả khung trong hộp ghi chú', () => {
    const { container } = draw('longform', {
      body: [{ k: 'h1', runs: [{ t: 'Tiêu đề gốc' }] }, { k: 'fig' }, { k: 'aside', items: [{ k: 'fig' }] }],
    })
    expect(corners(container)).toEqual(['fig-1', 'fig-2-0'])
  })

  /*
   * Hai khuôn này không dựng sẵn ô ảnh nào — ảnh của chúng là khối `image` của
   * kho dùng chung, đã có đường tải ảnh riêng. Khẳng định ra đây để "không có
   * nút" đọc là cố ý chứ không phải một chỗ quên nối.
   */
  it('cards và report không có ô ảnh cố định nào', () => {
    for (const template of ['cards', 'report']) {
      const { container, unmount } = draw(template)
      expect(corners(container), template).toEqual([])
      unmount()
    }
  })

  /* Nút phải là nút thật, bấm được, có tên đọc lên được — không phải một ô màu. */
  it('mỗi góc có một nút tải ảnh gọi tên được', () => {
    const { container } = draw('article')
    const labels = Array.from(container.querySelectorAll('[data-plate-corner] button')).map((b) =>
      b.getAttribute('aria-label'),
    )
    expect(labels).toEqual(['tải ảnh lên', 'tải ảnh lên', 'tải ảnh lên', 'tải ảnh lên'])
  })
})
