// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const topic = (id: string, parent_id: string | null, sort_order: number, posts = 0) => ({
  id, parent_id, title: id, intro: '', accent: null, on_color: null, tint: null, tint2: null, image_url: null, sort_order, visibility: 'public', posts,
})

const api = vi.hoisted(() => ({
  listTopics: vi.fn(),
  listKeywords: vi.fn(),
  updateTopic: vi.fn(),
  renameKeyword: vi.fn(),
  // ContentWorkspace, which lends the two settings panels, imports these at load.
  listModules: vi.fn(),
  listAuthors: vi.fn(),
}))
vi.mock('../lib/apiClient', () => api)

const { ConfigTree } = await import('./ConfigTree')

const modules = [
  { id: 'bean', title: 'Bean', accent: '#7FB87E', parent_id: null, sort_order: 1, kind: 'normal' },
  { id: 'roast', title: 'Roast', accent: '#7FB87E', parent_id: 'bean', sort_order: 2, kind: 'normal' },
] as never[]

beforeEach(() => {
  api.listTopics.mockResolvedValue([topic('coffee', null, 1), topic('sensory', 'coffee', 2, 3)])
  api.listKeywords.mockResolvedValue([{ id: 'heat', label: 'heat', posts: 2 }])
  api.updateTopic.mockImplementation(async (id: string, patch: object) => ({ ...topic(id, 'coffee', 2, 3), ...patch }))
  api.renameKeyword.mockResolvedValue(undefined)
})

const renderTree = () =>
  render(
    <ConfigTree
      modules={modules}
      renderCopy={(key) => <div>copy:{key}</div>}
      renderModule={(id) => <div>module:{id}</div>}
    />,
  )

describe('Cấu hình', () => {
  it('opens on Trang chủ, and a click on the left opens that item on the right', async () => {
    renderTree()
    expect(screen.getByText('copy:landing')).toBeTruthy()

    await userEvent.click(await screen.findByRole('button', { name: /sensory/ }))
    expect(screen.getByLabelText('Tên')).toHaveProperty('value', 'sensory')

    await userEvent.click(screen.getByRole('button', { name: /heat/ }))
    expect(screen.getByLabelText('Tên')).toHaveProperty('value', 'heat')

    await userEvent.click(screen.getByRole('button', { name: /Roast/ }))
    expect(screen.getByText('module:roast')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /Trang Ghi chép/ }))
    expect(screen.getByText('copy:notes')).toBeTruthy()
  })

  it('saves a topic edited on the right', async () => {
    renderTree()
    await userEvent.click(await screen.findByRole('button', { name: /sensory/ }))
    const name = screen.getByLabelText('Tên')
    await userEvent.clear(name)
    await userEvent.type(name, 'cảm quan{Enter}')
    expect(api.updateTopic).toHaveBeenCalledWith('sensory', { title: 'cảm quan' })
    expect(await screen.findByRole('button', { name: /cảm quan/ })).toBeTruthy()
  })

  it('folds a subject and a module branch on their arrows', async () => {
    renderTree()
    await screen.findByRole('button', { name: /sensory/ })
    await userEvent.click(screen.getByRole('button', { name: 'Gập coffee' }))
    expect(screen.queryByRole('button', { name: /sensory/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Gập Bean' }))
    expect(screen.queryByRole('button', { name: /Roast/ })).toBeNull()
  })

  it('leaves retiring a topic or tag to Nội dung, where its posts are on screen', async () => {
    renderTree()
    await userEvent.click(await screen.findByRole('button', { name: /sensory/ }))
    expect(screen.queryByRole('button', { name: /Xoá|Chuyển/ })).toBeNull()
  })
})
