import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/*
 * Lưới ô của tab Cấu hình và những gì nó mở ra phải khớp nhau.
 *
 * `BoxGrid` đọc `CONFIG_BOXES` để vẽ ra các thẻ, rồi đặt `box` bằng `id` của
 * thẻ vừa bấm. Cái nhận lấy `id` ấy là một `{box === '…' && …}` viết tay ở tận
 * dưới. Hai chỗ ấy không có gì buộc phải khớp: đổi tên hay thêm một ô mà quên
 * sửa chỗ kia thì TypeScript không kêu, màn vẫn dựng, test cũ vẫn xanh — chỉ
 * có cái thẻ mở ra một màn trống. Hỏng im lặng, đúng kiểu khó tìm nhất.
 *
 * Nên test này dựng màn thật, bấm từng thẻ rồi soi DOM, chứ không đọc mã.
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

const { BACK_LABEL, Cms, CONFIG_BOXES, GRID_LABEL, TABS } = await import('./Cms')

const tabLabel = (k: string) => TABS.find((t) => t.k === k)!.t

/*
 * Lưới, chứ không phải cả trang: "Trang chủ" cũng là một chặng trên đường dẫn
 * ngay phía trên, nên tìm khắp màn thì trúng hai chỗ.
 */
const grid = async () => within(await screen.findByLabelText(GRID_LABEL))

describe('lưới ô của tab Cấu hình', () => {
  it('mỗi thẻ mở ra đúng phần của nó', async () => {
    for (const b of CONFIG_BOXES) {
      const view = render(<Cms />)
      ;(await screen.findByText(tabLabel('config'))).click()
      ;(await (await grid()).findByText(b.t)).click()

      await waitFor(() => {
        expect(document.getElementById(b.id), `thẻ “${b.t}” mở ra màn trống`).not.toBeNull()
      })
      view.unmount()
    }
  })

  it('lưới là thứ hiện ra trước, không phải một ô nào', async () => {
    render(<Cms />)
    ;(await screen.findByText(tabLabel('config'))).click()

    // Mọi thẻ có mặt; chưa phần nào xổ ra.
    for (const b of CONFIG_BOXES) {
      expect((await grid()).queryAllByText(b.t).length, `thiếu thẻ “${b.t}”`).toBe(1)
      expect(document.getElementById(b.id), `ô “${b.t}” xổ sẵn khi chưa bấm`).toBeNull()
    }
  })

  it('mở một ô rồi quay lại được lưới', async () => {
    render(<Cms />)
    ;(await screen.findByText(tabLabel('config'))).click()
    ;(await (await grid()).findByText(CONFIG_BOXES[0].t)).click()
    await waitFor(() => expect(document.getElementById(CONFIG_BOXES[0].id)).not.toBeNull())

    ;(await screen.findByText(BACK_LABEL)).click()
    await waitFor(() => expect(document.getElementById(CONFIG_BOXES[0].id)).toBeNull())
  })
})

describe('khối sửa module', () => {
  /*
   * Nó từng nằm giữa 484 dòng của một tab chữ dài, và chủ site đi tìm ô "Nằm
   * trong" mãi không ra. Nay nó là một ô riêng, không dính gì tới chữ trên
   * trang.
   */
  it('là một ô riêng, không nằm chung với ô chữ nào', async () => {
    render(<Cms />)
    ;(await screen.findByText(tabLabel('config'))).click()
    ;(await (await grid()).findByText(CONFIG_BOXES.find((b) => b.id === 'landing')!.t)).click()
    await waitFor(() => expect(document.getElementById('landing')).not.toBeNull())
    expect(document.getElementById('modules')).toBeNull()
  })
})
