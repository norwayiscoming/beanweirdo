// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  reorderTopics: vi.fn(),
  createTopic: vi.fn(),
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
  vi.clearAllMocks()
  api.listTopics.mockResolvedValue([topic('coffee', null, 1), topic('sensory', 'coffee', 2, 3)])
  api.listKeywords.mockResolvedValue([{ id: 'heat', label: 'heat', posts: 2 }])
  api.updateTopic.mockImplementation(async (id: string, patch: object) => ({ ...topic(id, 'coffee', 2, 3), ...patch }))
  api.renameKeyword.mockResolvedValue(undefined)
  api.reorderTopics.mockResolvedValue(undefined)
  api.createTopic.mockImplementation(async (title: string, parent: string | null) => topic(title, parent, 9))
})

/** The draggable row that holds a tree entry's name. */
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^.?${name}`) }).parentElement as HTMLElement

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
    expect(await screen.findByRole('button', { name: /^.?cảm quan/ })).toBeTruthy()
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

  /*
   * jsdom gives every box a height of 0, so the pointer position reads as
   * unmeasurable and the drop answers "before" — the safe default. That is
   * enough to drag a topic out of its subject and up to the top level.
   */
  it('drags a topic out of its subject, up to the top level', async () => {
    renderTree()
    await screen.findByRole('button', { name: /sensory/ })
    fireEvent.dragStart(row('sensory'))
    fireEvent.dragOver(row('coffee'), { clientY: 0 })
    fireEvent.drop(row('coffee'), { clientY: 0 })
    await waitFor(() => expect(api.reorderTopics).toHaveBeenCalledWith(['sensory', 'coffee']))
    expect(api.updateTopic).toHaveBeenCalledWith('sensory', { parent_id: null })
  })

  it('adds a subject, and an entry inside the one being edited', async () => {
    renderTree()
    await userEvent.click(await screen.findByRole('button', { name: '+ subject mới' }))
    await userEvent.type(screen.getByLabelText('subject mới'), 'art{Enter}')
    expect(api.createTopic).toHaveBeenCalledWith('art', null)
    // A deeper level starts from the node being edited.
    await userEvent.click(screen.getByRole('button', { name: /^.?sensory/ }))
    await userEvent.click(screen.getByRole('button', { name: '+ mục trong sensory' }))
    await userEvent.type(screen.getByLabelText('mục trong sensory'), 'acid{Enter}')
    expect(api.createTopic).toHaveBeenCalledWith('acid', 'sensory')
  })

  it('drops a subject inside another, any depth', async () => {
    api.listTopics.mockResolvedValue([topic('coffee', null, 1), topic('sensory', 'coffee', 2, 3), topic('art', null, 3)])
    renderTree()
    await screen.findByRole('button', { name: /sensory/ })
    // Pretend the row has height, so the middle of it reads as "inside".
    const target = row('sensory')
    target.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 200, width: 200, x: 0, y: 0, toJSON: () => ({}) })
    // jsdom has no DragEvent, so the pointer position is set on a plain event.
    const at = (make: typeof createEvent.drop) => {
      const ev = make(target)
      Object.defineProperty(ev, 'clientY', { value: 20 })
      fireEvent(target, ev)
    }
    fireEvent.dragStart(row('art'))
    at(createEvent.dragOver)
    at(createEvent.drop)
    await waitFor(() => expect(api.reorderTopics).toHaveBeenCalledWith(['coffee', 'sensory', 'art']))
    expect(api.updateTopic).toHaveBeenCalledWith('art', { parent_id: 'sensory' })
  })
})
