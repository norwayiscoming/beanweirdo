import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/*
 * Thanh nhảy mục và các mục nó nhảy tới phải khớp nhau.
 *
 * `ContentIndex` đọc `CONTENT_SECTIONS` để vẽ ra các nút, rồi cuộn tới
 * `document.getElementById(id)`. Cái neo lại là một `div id=` viết tay ở tận
 * dưới. Hai chỗ ấy không có gì buộc phải khớp: đổi tên hay bỏ một mục mà quên
 * sửa chỗ kia thì TypeScript không kêu, màn vẫn dựng, test cũ vẫn xanh — chỉ
 * có cái nút trỏ vào hư không. Hỏng im lặng, đúng kiểu khó tìm nhất.
 *
 * Nên test này dựng màn thật rồi soi DOM, chứ không đọc mã.
 */

vi.mock('../admin/lib/apiClient', () => ({
  getSite: () => Promise.resolve({}),
  listModules: () => Promise.resolve([]),
  listPosts: () => Promise.resolve([]),
  listTemplates: () => Promise.resolve([]),
  listTags: () => Promise.resolve([]),
  updateSite: (p: unknown) => Promise.resolve(p),
  createTag: vi.fn(), renameTag: vi.fn(), deleteTag: vi.fn(),
  createModule: vi.fn(), deleteModule: vi.fn(), reorderModules: vi.fn(),
  reorderPosts: vi.fn(), updateModule: vi.fn(), updatePost: vi.fn(),
  uploadImage: vi.fn(), transitionStatus: vi.fn(),
}))

vi.mock('../lib/nav', async () => {
  const { useState } = await import('react')
  return {
    useNav: () => {
      const [cmsTab, goCms] = useState('posts')
      return { cmsTab, goCms, openArticle: vi.fn(), goHome: vi.fn() }
    },
  }
})

const { Cms, CONTENT_SECTIONS, TABS } = await import('./Cms')

const tabLabel = (k: string) => TABS.find((t) => t.k === k)!.t

describe('thanh nhảy mục của tab chữ', () => {
  it('mọi mục nó liệt kê đều có neo thật trên trang', async () => {
    render(<Cms />)
    ;(await screen.findByText(tabLabel('content'))).click()

    for (const s of CONTENT_SECTIONS) {
      await waitFor(() => {
        expect(document.getElementById(s.id), `thiếu neo id="${s.id}"`).not.toBeNull()
      })
    }
  })

  it('vẽ đúng một nút cho mỗi mục', async () => {
    render(<Cms />)
    ;(await screen.findByText(tabLabel('content'))).click()

    for (const s of CONTENT_SECTIONS) {
      await waitFor(() => expect(screen.queryAllByText(s.t).length).toBeGreaterThan(0))
    }
  })
})

describe('khối sửa module', () => {
  /*
   * Nó từng nằm trong tab chữ, 484 dòng, và chủ site đi tìm ô "Nằm trong" ở
   * tab Cấu trúc — tìm đúng chỗ, vì đó là màn vẽ cái cây. Nay nó ở đấy.
   */
  it('nằm ở tab Cấu trúc, không ở tab chữ', async () => {
    render(<Cms />)

    ;(await screen.findByText(tabLabel('content'))).click()
    await waitFor(() => expect(document.getElementById('landing')).not.toBeNull())
    expect(document.getElementById('modules')).toBeNull()

    ;(await screen.findByText(tabLabel('map'))).click()
    await waitFor(() => expect(document.getElementById('modules')).not.toBeNull())
  })
})
