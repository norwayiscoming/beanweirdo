// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const topic = (id: string, parent_id: string | null, sort_order: number, posts = 0) => ({
  id, parent_id, title: id, intro: '', accent: null, on_color: null, tint: null, tint2: null, image_url: null, sort_order, status: 'published', posts,
})

const api = vi.hoisted(() => ({
  getLayout: vi.fn(),
  listNodes: vi.fn(),
  listKeywords: vi.fn(),
  listTags: vi.fn(),
  updateNode: vi.fn(),
  renameKeyword: vi.fn(),
  reorderNodes: vi.fn(),
  createNode: vi.fn(),
  createKeyword: vi.fn(),
  createPage: vi.fn(),
  createRule: vi.fn(),
  saveOverride: vi.fn(),
  deleteOverride: vi.fn(),
  deletePage: vi.fn(),
  updatePage: vi.fn(),
  updateSite: vi.fn(),
  updateRule: vi.fn(),
  listPosts: vi.fn(),
  updatePost: vi.fn(),
  deleteNode: vi.fn(),
  deleteKeyword: vi.fn(),
}))
vi.mock('../lib/apiClient', () => api)
vi.mock('../../data/useModules', () => ({
  useModules: () => ({ data: [], postsOf: () => [], reload: () => {} }),
  findPage: () => undefined,
}))
vi.mock('../../portfolio/data', () => ({ usePortSources: () => ({ posts: [], moduleTitles: {}, moduleIds: [], loading: false }) }))
const portPage = (id: string, status: string, sort_order: number) => ({ id, title: id, slug: id.toLowerCase(), status, parent_id: null, sort_order })
vi.mock('./PortEditors', () => ({
  usePortAdmin: () => ({
    pages: [portPage('Biz-hkd', 'draft', 0), portPage('Alpha', 'published', 1), portPage('Beta', 'published', 2), portPage('Draft', 'draft', 3)],
    // Beta was put first on the top bar and given its own label; home sits second.
    content: { header: { brand: '', right: '', links: [{ key: 'page:Beta', label: 'Bê' }] }, home: { title: 'port', intro: '', features: [] }, footer: {}, about: {} },
    setContentStored: () => {},
    setPages: () => {},
    loaded: true,
    design: { palettes: { biz: { name: "biz", c500: "#123456" } } },
  }),
  useSplit: () => ({ size: 520, columns: '520px 7px minmax(0,1fr)', handle: null, dragging: false }),
  ContentTab: ({ only }: { only: string }) => <div>port:{only}</div>,
  Builder: () => null,
  createFromPreset: vi.fn(),
  PRESET_CHOICES: [{ value: 'bibi', label: 'mẫu bibi' }, { value: 'bibe', label: 'mẫu bibe' }, { value: 'blank', label: 'trang trống' }],
}))

vi.mock('./AuthorsPanel', () => ({ AuthorsPanel: () => <div>authors-panel</div> }))

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
  localStorage.clear()
  api.getLayout.mockResolvedValue(layout)
  api.listNodes.mockResolvedValue([topic('coffee', null, 1), topic('sensory', 'coffee', 2, 3), topic('tea', null, 3)])
  api.listKeywords.mockResolvedValue([{ id: 'heat', label: 'heat', posts: 2 }])
  api.listTags.mockResolvedValue([])
  api.updateNode.mockResolvedValue({})
  api.reorderNodes.mockResolvedValue(undefined)
  api.createNode.mockImplementation(async (title: string, parent: string | null) => topic(title, parent, 9))
  api.createRule.mockResolvedValue({ id: 'r2' })
  api.saveOverride.mockResolvedValue(undefined)
  api.updateSite.mockResolvedValue({})
})

const tree = () => screen.getByRole('navigation', { name: 'Cây cấu hình' })
/** A card of the tree, by the name it starts with. */
const card = (name: string) => within(tree()).getByRole('button', { name: new RegExp(`^${name}`) })
/** A row of a list on the right, by its name (the number is hidden from readers). */
const listRow = (list: string, name: string) => within(screen.getByRole('list', { name: list })).getByRole('button', { name: new RegExp(`^${name}`) })
/** The names and facts of a list on the right, without the numbers. */
const rowsOf = (list: string) => within(screen.getByRole('list', { name: list })).getAllByRole('listitem').map((li) => li.querySelector('.cfg-item')?.textContent?.replace(/^\d+/, ''))
const heading = () => screen.getByRole('heading', { level: 2 }).textContent
const crumbs = () => screen.getByLabelText('Đang sửa').textContent

/** Opens on bean, the tab most of these tests are about; `tab` picks another. */
const renderScreen = async (tab = 'bean', openAuthors = false) => {
  localStorage.setItem('beanweirdo.config.tab', tab)
  render(
    <ConfigTree
      modules={[{ id: 'bean', title: 'Bean', accent: '#7FB87E', parent_id: null, sort_order: 1, kind: 'normal' }] as never[]}
      renderCopy={(key) => <div>copy:{key}</div>}
      renderModule={(id) => <div>module:{id}</div>}
      renderPractice={() => <div>practice</div>}
      openAuthors={openAuthors}
    />,
  )
  await screen.findByRole('navigation', { name: 'Cây cấu hình' })
  if (tab === 'bean' && !openAuthors) await waitFor(() => expect(card('Mục lục').textContent).toContain('2 subject'))
}

/** Opens a topic the way the owner does: the Mục lục card, then down the lists. */
const openTopic = async (...path: string[]) => {
  await userEvent.click(card('Mục lục'))
  for (const [i, name] of path.entries()) await userEvent.click(listRow(i === 0 ? 'Các mục' : 'Mục con', name))
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
const li = (el: HTMLElement) => el.closest('li') as HTMLElement

describe('Cấu hình', () => {
  it('opens on bean’s home, with its fields on the right and its public page previewed', async () => {
    await renderScreen()
    expect(heading()).toBe('Trang chủ bean')
    expect(screen.getByText('copy:landing')).toBeTruthy()
    expect(screen.getByTitle(/xem trước/).getAttribute('src')).toBe('/bean/details')
  })

  it('keeps only the cards on the left; what a card holds is listed on the right, and the crumbs go back', async () => {
    await renderScreen()
    expect(within(tree()).queryByRole('button', { name: /coffee|sensory|heat/ })).toBeNull()
    expect(within(tree()).queryByRole('textbox')).toBeNull()

    await openTopic('coffee', 'sensory')
    expect(crumbs()).toBe('bean › Mục lục › coffee')
    expect(screen.getByLabelText('Tên')).toHaveProperty('value', 'sensory')
    expect(screen.getByTitle(/xem trước/).getAttribute('src')).toBe('/bean/module/sensory')
    // The card stays lit while something inside it is open.
    expect(card('Mục lục').getAttribute('aria-current')).toBe('true')

    await userEvent.click(within(screen.getByLabelText('Đang sửa')).getByRole('button', { name: 'coffee' }))
    expect(screen.getByLabelText('Tên')).toHaveProperty('value', 'coffee')
    await userEvent.click(within(screen.getByLabelText('Đang sửa')).getByRole('button', { name: 'Mục lục' }))
    expect(heading()).toBe('Mục lục')
  })

  it('adds a subject in Mục lục, and an entry inside the topic being edited', async () => {
    await renderScreen()
    await userEvent.click(card('Mục lục'))
    // The group lists its subjects; adding one is the last line, and nothing is created before Lưu.
    expect(rowsOf('Các mục')).toEqual(['coffee0 bài', 'tea0 bài'])
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }))
    await userEvent.type(screen.getByLabelText('Thêm'), 'cacao')
    expect(api.createNode).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(api.createNode).toHaveBeenCalledWith({ site: 'blog', title: 'cacao', parent_id: null })

    await userEvent.click(listRow('Các mục', 'coffee'))
    await userEvent.click(screen.getByRole('button', { name: 'Thêm mục con' }))
    await userEvent.type(screen.getByLabelText('Thêm mục con'), 'aroma{Enter}')
    expect(api.createNode).toHaveBeenCalledWith({ site: 'blog', title: 'aroma', parent_id: 'coffee' })
  })

  it('drags only from the grip, says where the drop will land, and undoes the move', async () => {
    await renderScreen()
    await userEvent.click(card('Mục lục'))
    // The row itself never starts a drag, so a slipping click cannot move a node.
    expect(listRow('Các mục', 'tea').closest('[draggable="true"]')).toBeNull()

    fireEvent.dragStart(screen.getByRole('img', { name: 'Kéo tea' }))
    const coffee = li(listRow('Các mục', 'coffee'))
    dropOn(coffee, 20, ['dragOver'])
    expect(await screen.findByText('vào trong coffee')).toBeTruthy()
    dropOn(coffee, 20, ['drop'])

    await waitFor(() => expect(api.reorderNodes).toHaveBeenCalledWith(['coffee', 'sensory', 'tea']))
    expect(api.updateNode).toHaveBeenCalledWith('tea', { parent_id: 'coffee' })
    expect(await screen.findByText('Đã chuyển tea vào trong coffee')).toBeTruthy()

    // Undo waits for the save, so it cannot race the move it undoes.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn tác' })).toHaveProperty('disabled', false))
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
    await waitFor(() => expect(api.updateNode).toHaveBeenCalledWith('tea', { parent_id: null }))
    expect(api.reorderNodes).toHaveBeenLastCalledWith(['coffee', 'sensory', 'tea'])
  })

  it('moves the row the moment it is dropped, before the server answers', async () => {
    await renderScreen()
    await userEvent.click(card('Mục lục'))
    api.updateNode.mockReturnValue(new Promise(() => {}))
    fireEvent.dragStart(screen.getByRole('img', { name: 'Kéo tea' }))
    dropOn(li(listRow('Các mục', 'coffee')), 20)
    await waitFor(() => expect(rowsOf('Các mục')).toEqual(['coffee0 bài']))
    expect(screen.getByText(/đang lưu/)).toBeTruthy()
  })

  it('shows a topic’s page beside its fields, and gives it settings of its own', async () => {
    await renderScreen()
    await openTopic('coffee', 'sensory')
    // It follows the topic template, which is named but has no row of its own any more.
    expect(screen.getByText(/quy chế chung của trang topic/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '+ cài đặt riêng' }))
    await waitFor(() => expect(api.saveOverride).toHaveBeenCalledWith({ node_type: 'topic', node_id: 'sensory', rule_id: 'r2' }))
  })

  it('has three tabs: beanweirdo holds the root and what both sites share, biz and bean their own pages', async () => {
    await renderScreen('root')
    expect(heading()).toBe('Trang chủ')
    for (const name of ['Trang chủ', 'Mục lục', 'Khung chung', 'Tag', 'Tác giả', 'Ghi 02']) expect(card(name)).toBeTruthy()
    expect(within(tree()).queryByRole('button', { name: /^Phần chung/ })).toBeNull()
    // About sits on the top bar, so in Mục lục, and opens with its signature.
    await userEvent.click(card('Mục lục'))
    await userEvent.click(listRow('Thanh trên', 'About'))
    expect(crumbs()).toBe('beanweirdo › Mục lục')
    expect(screen.getByText('port:sign')).toBeTruthy()
    await userEvent.click(card('Khung chung'))
    expect(screen.getByText('port:header')).toBeTruthy()
    expect(screen.getByText('port:footer')).toBeTruthy()

    // biz opens on its home, the page the owner named; its Mục lục holds the rest.
    await userEvent.click(screen.getByRole('tab', { name: 'biz' }))
    expect(card('Trang chủ biz').getAttribute('aria-current')).toBe('true')
    expect(crumbs()).toBe('biz')
    await userEvent.click(card('Mục lục'))
    expect(rowsOf('Các mục')).toEqual(['Alpha/alpha', 'Beta/beta', 'Draftnháp · /draft'])
  })

  it('opens /ad-authors on the authors card of beanweirdo', async () => {
    await renderScreen('bean', true)
    expect(heading()).toBe('Tác giả')
    expect(screen.getByText('authors-panel')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'beanweirdo' }).getAttribute('aria-selected')).toBe('true')
    await userEvent.click(screen.getByRole('tab', { name: 'bean' }))
    expect(heading()).toBe('Trang chủ bean')
  })

  it('drags beanweirdo’s Mục lục into the top bar order, keeping labels and home in place', async () => {
    await renderScreen('root')
    await userEvent.click(card('Mục lục'))
    // A draft is not on the top bar; it lives in biz.
    expect(screen.queryByRole('img', { name: 'Kéo Draft' })).toBeNull()

    fireEvent.dragStart(screen.getByRole('img', { name: 'Kéo About' }))
    const beta = li(listRow('Thanh trên', 'Bê'))
    // The middle of a row is not "inside" on a flat list.
    dropOn(beta, 15, ['dragOver'])
    expect(await screen.findByText('trước Bê')).toBeTruthy()
    dropOn(beta, 15, ['drop'])
    await waitFor(() =>
      expect(api.updateSite).toHaveBeenCalledWith({
        portfolio: { header: { brand: '', right: '', links: [{ key: 'about' }, { key: 'home' }, { key: 'page:Beta', label: 'Bê' }, { key: 'page:Alpha' }] } },
      }),
    )
  })

  it('drags biz’s Mục lục the way bean’s drags, inside another page too', async () => {
    await renderScreen('biz')
    fireEvent.dragStart(screen.getByRole('img', { name: 'Kéo Draft' }))
    dropOn(li(listRow('Các mục', 'Alpha')), 20)
    await waitFor(() => expect(api.reorderNodes).toHaveBeenCalledWith(['Alpha', 'Draft', 'Beta']))
    expect(api.updateNode).toHaveBeenCalledWith('Draft', { parent_id: 'Alpha' })
  })

  it('keeps one card per thing: Mục lục is the topic tree, and nothing without a page is left', async () => {
    await renderScreen()
    await userEvent.click(card('Mục lục'))
    expect(screen.getByText('copy:index')).toBeTruthy()
    expect(screen.getByTitle(/xem trước/).getAttribute('src')).toBe('/bean/muc-luc')
    for (const gone of ['Điều hướng', 'Mẫu', 'Lưu trữ', 'Cây chủ đề', 'Phần chung']) expect(within(tree()).queryByRole('button', { name: new RegExp(`^${gone}`) })).toBeNull()
  })

  it('puts the menu and home switches on the subject itself, named as the port names them', async () => {
    api.updatePage.mockResolvedValue(undefined)
    await renderScreen()
    await openTopic('tea')
    const menu = screen.getByRole('switch', { name: 'Hiện trên menu' })
    // A subject not yet in the stored list is shown.
    expect(menu.getAttribute('aria-checked')).toBe('true')
    await userEvent.click(menu)
    expect(api.updatePage).toHaveBeenCalledWith('nav', { presentation: { items: [{ ref: 'topic:tea', sidebar: false, home: true }] } })
  })

  it('deletes from the ⋮ of the item: a topic moves its posts first and can be undone', async () => {
    api.listPosts.mockResolvedValue([{ id: 'p1', topic_id: 'sensory', keywords: [] }])
    api.getLayout.mockResolvedValue(layout)
    api.updatePost.mockResolvedValue({})
    api.deleteNode.mockResolvedValue(undefined)
    await renderScreen()
    await openTopic('coffee', 'sensory')
    await userEvent.click(screen.getByRole('button', { name: 'Thao tác' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Xoá…' }))
    await userEvent.selectOptions(screen.getByLabelText('Chuyển 3 bài sang'), 'tea')
    await userEvent.click(screen.getByRole('button', { name: 'Chuyển bài và xoá sensory' }))
    await waitFor(() => expect(api.deleteNode).toHaveBeenCalledWith('sensory'))
    expect(api.updatePost).toHaveBeenCalledWith('p1', { topic_id: 'tea' })
    expect(await screen.findByText('1 bài → tea · đã xoá sensory')).toBeTruthy()
  })

  it('deletes from a row’s own ⋮ in the list, which opens the item with its delete panel', async () => {
    await renderScreen()
    await userEvent.click(card('Mục lục'))
    await userEvent.click(screen.getByRole('button', { name: 'Thao tác coffee' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Xoá…' }))
    expect(screen.getByLabelText('Tên')).toHaveProperty('value', 'coffee')
    // A topic with children cannot go, and says why.
    expect(screen.getByText(/còn 1 mục con/)).toBeTruthy()
    expect(api.deleteNode).not.toHaveBeenCalled()
  })

  it('keeps Xoá in the same place on a page that cannot be deleted, greyed with the reason', async () => {
    await renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Thao tác' }))
    const del = screen.getByRole('menuitem', { name: /Xoá/ })
    expect(del).toHaveProperty('disabled', true)
    expect(del.textContent).toContain('trang hệ thống')
  })

  it('adds a biz page, named, from a chosen preset', async () => {
    const { createFromPreset } = await import('./PortEditors')
    vi.mocked(createFromPreset).mockResolvedValue({ id: 'n1', title: 'reading room', slug: 'reading-room', status: 'draft' } as never)
    await renderScreen('biz')
    // A page is deleted from its row.
    expect(screen.getByRole('button', { name: 'Thao tác Beta' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Thêm trang' }))
    await userEvent.type(screen.getByLabelText('Thêm trang'), 'reading room')
    await userEvent.click(screen.getByRole('button', { name: 'mẫu bibe' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(createFromPreset).toHaveBeenCalledWith('bibe', 'reading room', expect.anything(), [], null))
  })

  it('walks the cards with the arrow keys', async () => {
    await renderScreen()
    card('Trang chủ bean').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(card('Mục lục'))
    await userEvent.keyboard('{ArrowDown}{ArrowUp}')
    expect(document.activeElement).toBe(card('Mục lục'))
  })
})
