// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const topic = (id: string, parent_id: string | null, sort_order: number, posts = 0) => ({
  id, parent_id, title: id, intro: '', accent: null, on_color: null, tint: null, tint2: null, image_url: null, sort_order, visibility: 'public', posts,
})

const api = vi.hoisted(() => ({
  getLayout: vi.fn(),
  listTopics: vi.fn(),
  listKeywords: vi.fn(),
  listTags: vi.fn(),
  updateTopic: vi.fn(),
  renameKeyword: vi.fn(),
  reorderTopics: vi.fn(),
  createTopic: vi.fn(),
  createKeyword: vi.fn(),
  createPage: vi.fn(),
  createRule: vi.fn(),
  saveOverride: vi.fn(),
  deleteOverride: vi.fn(),
  deletePage: vi.fn(),
  deletePortPage: vi.fn(),
  updatePage: vi.fn(),
  updateRule: vi.fn(),
  // ContentWorkspace, which lends the two settings panels, imports these at load.
  listModules: vi.fn(),
  listAuthors: vi.fn(),
}))
vi.mock('../lib/apiClient', () => api)
vi.mock('../../data/useModules', () => ({
  useModules: () => ({ data: [], postsOf: () => [], reload: () => {} }),
  findPage: () => undefined,
}))
vi.mock('../../portfolio/data', () => ({ usePortSources: () => ({ posts: [], moduleTitles: {}, moduleIds: [], loading: false }) }))
vi.mock('./PortEditors', () => ({
  usePortAdmin: () => ({ pages: [], content: {}, setContentStored: () => {}, setPages: () => {}, loaded: true, design: {} }),
  useSplit: () => ({ size: 520, columns: '520px 7px minmax(0,1fr)', handle: null, dragging: false }),
  ContentTab: ({ only }: { only: string }) => <div>port:{only}</div>,
  Builder: () => null,
  createFromPreset: vi.fn(),
}))

const { ConfigTree } = await import('./ConfigTree')

const rule = { id: 'r1', tier: 'topic', nodes: [], exclude: [], kinds: [], templates: [], sort: 'newest', group_by: 'none', limit_n: null, include_children: true, match: 'any', pinned: [], manual_order: [], new_first: true }
const layout = {
  pages: [
    { id: 'nav', kind: 'nav', title: '', blocks: [], presentation: { items: [] }, aliases: [], visibility: 'public' },
    { id: 'tpl-subject', kind: 'template_subject', title: '', blocks: ['r1'], presentation: {}, aliases: [], visibility: 'public' },
    { id: 'tpl-topic', kind: 'template_topic', title: '', blocks: ['r1'], presentation: {}, aliases: [], visibility: 'public' },
  ],
  overrides: [],
  rules: [rule],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getLayout.mockResolvedValue(layout)
  api.listTopics.mockResolvedValue([topic('coffee', null, 1), topic('sensory', 'coffee', 2, 3), topic('tea', null, 3)])
  api.listKeywords.mockResolvedValue([{ id: 'heat', label: 'heat', posts: 2 }])
  api.listTags.mockResolvedValue([])
  api.updateTopic.mockResolvedValue({})
  api.reorderTopics.mockResolvedValue(undefined)
  api.createTopic.mockImplementation(async (title: string, parent: string | null) => topic(title, parent, 9))
  api.createRule.mockResolvedValue({ id: 'r2' })
  api.saveOverride.mockResolvedValue(undefined)
})

const tree = () => screen.getByRole('navigation', { name: 'Cây cấu hình' })
/** A row of the tree, by the name it starts with. */
const rowButton = (name: string) => within(tree()).getByRole('button', { name: new RegExp(`^.?${name}`) })
const heading = () => screen.getByRole('heading', { level: 2 }).textContent

const renderScreen = async () => {
  render(
    <ConfigTree
      modules={[{ id: 'bean', title: 'Bean', accent: '#7FB87E', parent_id: null, sort_order: 1, kind: 'normal' }] as never[]}
      renderCopy={(key) => <div>copy:{key}</div>}
      renderModule={(id) => <div>module:{id}</div>}
      renderPractice={() => <div>practice</div>}
    />,
  )
  await screen.findByRole('navigation', { name: 'Cây cấu hình' })
  await waitFor(() => rowButton('sensory'))
}

/** jsdom has no DragEvent: build the drop by hand, at a height inside the row. */
const dropOn = (row: HTMLElement, clientY: number, types: ('dragOver' | 'drop')[] = ['dragOver', 'drop']) => {
  const box = { top: 0, height: 40, bottom: 40, left: 0, right: 200, width: 200, x: 0, y: 0, toJSON: () => ({}) }
  row.getBoundingClientRect = () => box as DOMRect
  for (const type of types) {
    const ev = createEvent[type](row)
    Object.defineProperty(ev, 'clientY', { value: clientY })
    fireEvent(row, ev)
  }
}

describe('Cấu hình', () => {
  it('opens on the blog home, with its fields on the right and its public page previewed', async () => {
    await renderScreen()
    expect(heading()).toBe('Trang chủ blog')
    expect(screen.getByText('copy:landing')).toBeTruthy()
    expect(screen.getByTitle(/xem trước/).getAttribute('src')).toBe('/bean/details')
  })

  it('a click on the left only picks; nothing on the left can be typed into', async () => {
    await renderScreen()
    await userEvent.click(rowButton('sensory'))
    expect(screen.getByLabelText('Đang sửa').textContent).toBe('Bean blog › Mục lục › coffee')
    expect(screen.getByLabelText('Tên')).toHaveProperty('value', 'sensory')
    expect(screen.getByTitle(/xem trước/).getAttribute('src')).toBe('/bean/module/sensory')
    expect(within(tree()).queryByRole('textbox')).toBeNull()
  })

  it('a click on a group card opens it on the right, and only its arrow folds it', async () => {
    await renderScreen()
    await userEvent.click(rowButton('Mục lục'))
    expect(heading()).toBe('Mục lục')
    expect(rowButton('sensory')).toBeTruthy()

    await userEvent.click(within(tree()).getByRole('button', { name: 'Gập Mục lục' }))
    expect(within(tree()).queryByRole('button', { name: /^.?sensory/ })).toBeNull()
  })

  it('adds a subject from the tree card, and an entry inside the topic being edited', async () => {
    await renderScreen()
    await userEvent.click(rowButton('Mục lục'))
    await userEvent.type(screen.getByLabelText('Thêm subject'), 'cacao')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm subject' }))
    expect(api.createTopic).toHaveBeenCalledWith('cacao', null)

    await userEvent.click(rowButton('coffee'))
    await userEvent.type(screen.getByLabelText('Thêm mục'), 'aroma{Enter}')
    expect(api.createTopic).toHaveBeenCalledWith('aroma', 'coffee')
  })

  it('drags only from the grip, says where the drop will land, and undoes the move', async () => {
    await renderScreen()
    // The row itself never starts a drag, so a slipping click cannot move a node.
    expect(rowButton('tea').closest('[draggable="true"]')).toBeNull()

    fireEvent.dragStart(screen.getByRole('img', { name: 'Kéo tea' }))
    const coffee = rowButton('coffee').parentElement as HTMLElement
    dropOn(coffee, 20, ['dragOver'])
    expect(await screen.findByText('vào trong coffee')).toBeTruthy()
    dropOn(coffee, 20, ['drop'])

    await waitFor(() => expect(api.reorderTopics).toHaveBeenCalledWith(['coffee', 'sensory', 'tea']))
    expect(api.updateTopic).toHaveBeenCalledWith('tea', { parent_id: 'coffee' })
    expect(await screen.findByText('Đã chuyển tea vào trong coffee')).toBeTruthy()

    // Undo waits for the save, so it cannot race the move it undoes.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn tác' })).toHaveProperty('disabled', false))
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
    await waitFor(() => expect(api.updateTopic).toHaveBeenCalledWith('tea', { parent_id: null }))
    expect(api.reorderTopics).toHaveBeenLastCalledWith(['coffee', 'sensory', 'tea'])
  })

  it('moves the row the moment it is dropped, before the server answers', async () => {
    await renderScreen()
    api.updateTopic.mockReturnValue(new Promise(() => {}))
    fireEvent.dragStart(screen.getByRole('img', { name: 'Kéo tea' }))
    dropOn(rowButton('coffee').parentElement as HTMLElement, 20)
    await waitFor(() => expect((rowButton('tea').parentElement as HTMLElement).style.marginLeft).toBe('16px'))
    expect(screen.getByText(/đang lưu/)).toBeTruthy()
  })

  it('shows a topic’s page beside its fields, and gives it settings of its own', async () => {
    await renderScreen()
    await userEvent.click(rowButton('sensory'))
    // It follows the topic template, which is named but has no row of its own any more.
    expect(screen.getByText(/quy chế chung của trang topic/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '+ cài đặt riêng' }))
    await waitFor(() => expect(api.saveOverride).toHaveBeenCalledWith({ node_type: 'topic', node_id: 'sensory', rule_id: 'r2' }))
  })

  it('sets each site apart under its own heading, which folds', async () => {
    await renderScreen()
    const port = screen.getByRole('region', { name: 'Port' })
    // Mục lục is the blog's: it sits under Bean blog, never under Port.
    expect(within(port).queryByRole('button', { name: /^Mục lục/ })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Bean blog' })).getByRole('button', { name: /^Mục lục/ })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Gập Bean blog' }))
    expect(within(tree()).queryByRole('button', { name: /^.?sensory/ })).toBeNull()
  })

  it('keeps one card per thing: Mục lục is the topic tree, and nothing without a page is left', async () => {
    await renderScreen()
    await userEvent.click(rowButton('Mục lục'))
    expect(screen.getByText('copy:index')).toBeTruthy()
    expect(screen.getByTitle(/xem trước/).getAttribute('src')).toBe('/bean/muc-luc')
    for (const gone of ['Điều hướng', 'Mẫu', 'Lưu trữ', 'Cây chủ đề']) expect(within(tree()).queryByRole('button', { name: new RegExp(`^${gone}`) })).toBeNull()
  })

  it('puts the sidebar and blog-home switches on the subject itself', async () => {
    api.updatePage.mockResolvedValue(undefined)
    await renderScreen()
    await userEvent.click(rowButton('tea'))
    const sidebar = screen.getByRole('checkbox', { name: 'hiện ở thanh bên' })
    // A subject not yet in the stored list is shown.
    expect(sidebar).toHaveProperty('checked', true)
    await userEvent.click(sidebar)
    expect(api.updatePage).toHaveBeenCalledWith('nav', { presentation: { items: [{ ref: 'topic:tea', sidebar: false, home: true }] } })
  })

  it('walks the tree with the arrow keys and folds with ← →', async () => {
    await renderScreen()
    rowButton('coffee').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rowButton('sensory'))
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}')
    expect(within(tree()).queryByRole('button', { name: /^.?sensory/ })).toBeNull()
    await userEvent.keyboard('{ArrowRight}')
    expect(rowButton('sensory')).toBeTruthy()
  })
})
