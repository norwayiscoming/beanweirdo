import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The workspace is a tab inside Content management — the area's AuthGate
// covers it, so there is no per-screen gate left to stub out.
const editPost = vi.fn()
vi.mock('../../lib/nav', () => ({
  useNav: () => ({ screen: 'cms', area: 'admin', postId: null, newPost: vi.fn(), editPost, previewPost: vi.fn(), goCms: vi.fn() }),
}))
vi.mock('../../data/usePostAddresses', () => ({ usePostAddresses: () => ({ slugOf: (id: string) => id }) }))

const post = (id: string, over: Record<string, unknown>) => ({
  id,
  module_id: 'm',
  en: id,
  vi: '',
  kind: 'note',
  date_label: '2026.06',
  status: 'published',
  template: 'article',
  hero_image_url: null,
  theme_color: null,
  thumbnail_url: null,
  sort_order: null,
  pinned: false,
  topic_id: 'sensory',
  keywords: [],
  visibility: 'public',
  slug: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  published_at: null,
  ...over,
})

const topics = [
  { id: 'bean-weirdo', parent_id: null, title: 'bean weirdo', intro: '', accent: null, on_color: null, tint: null, tint2: null, image_url: null, sort_order: 1, status: 'published', posts: 0 },
  { id: 'sensory', parent_id: 'bean-weirdo', title: 'sensory', intro: '', accent: null, on_color: null, tint: null, tint2: null, image_url: null, sort_order: 2, status: 'published', posts: 1 },
  { id: 'art', parent_id: null, title: 'art', intro: '', accent: null, on_color: null, tint: null, tint2: null, image_url: null, sort_order: 3, status: 'published', posts: 0 },
  { id: 'book-film', parent_id: 'art', title: 'book & film', intro: '', accent: null, on_color: null, tint: null, tint2: null, image_url: null, sort_order: 4, status: 'published', posts: 2 },
]

let posts: ReturnType<typeof post>[] = []
const api = vi.hoisted(() => ({
  listPosts: vi.fn(),
  listNodes: vi.fn(),
  listKeywords: vi.fn(),
  listAuthors: vi.fn(),
  listTags: vi.fn(),
  transitionStatus: vi.fn(),
  updatePost: vi.fn(),
  deleteTag: vi.fn(),
  createTag: vi.fn(),
  listModules: vi.fn(),
  getPost: vi.fn(),
}))
vi.mock('../lib/apiClient', () => api)

const { ContentWorkspace } = await import('./ContentWorkspace')

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  editPost.mockReset()
  api.listPosts.mockImplementation(() => Promise.resolve(posts))
  api.listNodes.mockResolvedValue(topics)
  api.listKeywords.mockResolvedValue([])
  api.listAuthors.mockResolvedValue([{ id: 'a1', name: 'Norway', slug: 'norway', avatar_url: null, bio: '', active: true, created_at: '', post_count: 1 }])
  api.listTags.mockResolvedValue([{ id: 'note', label: 'note' }, { id: 'book-film', label: 'book-film' }])
  api.transitionStatus.mockResolvedValue({})
  api.updatePost.mockResolvedValue({})
  api.listModules.mockResolvedValue([])
  api.getPost.mockImplementation((id: string) => Promise.resolve({ ...posts.find((p) => p.id === id), body: [], old_slugs: [], authors: [] }))
  api.listModules.mockResolvedValue([])
  api.deleteTag.mockResolvedValue({ deleted: 'book-film', moved: { posts: [], notes: [] } })
  api.createTag.mockImplementation((label: string) => Promise.resolve({ id: label, label }))
  posts = [
    post('Senses of Flavors', { status: 'draft' }),
    post('Detachment', { kind: 'book-film', topic_id: 'book-film', date_label: '2025.02', excerpt: 'Một dòng xem trước' }),
    post('Wings of Desire', { kind: 'book-film', topic_id: 'book-film', date_label: '2021.10' }),
    post('Chlorogenic Acids', { status: 'deleted' }),
  ]
})

// Every action sits behind the post's ⋮; a click on the post itself opens it.
const pick = async (title: string, action: string) => {
  await userEvent.click(screen.getByRole('button', { name: `Thao tác ${title}` }))
  await userEvent.click(screen.getByRole('menuitem', { name: action }))
}

describe('ContentWorkspace', () => {
  it('lists the live posts and publishes a draft from its row', async () => {
    render(<ContentWorkspace />)
    expect(await screen.findByRole('button', { name: 'Senses of Flavors' })).toBeInTheDocument()
    // The trash stays out of the list until it is asked for.
    expect(screen.queryByRole('button', { name: 'Chlorogenic Acids' })).not.toBeInTheDocument()
    await pick('Senses of Flavors', 'Đăng')
    expect(api.transitionStatus).toHaveBeenCalledWith('Senses of Flavors', 'publish')
    // Choosing a menu line or ticking the box must not also open the post.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Detachment' }))
    expect(editPost).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('Một dòng xem trước'))
    expect(editPost).toHaveBeenCalledWith('Detachment')
  })

  it('edits a post\'s info from its info line without opening the post', async () => {
    render(<ContentWorkspace />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin bài Detachment' }))
    const panel = await screen.findByRole('complementary', { name: 'Thông tin bài' })
    await userEvent.selectOptions(within(panel).getByLabelText('Chủ đề'), 'book-film')
    expect(api.updatePost).toHaveBeenCalledWith('Detachment', { topic_id: 'book-film' })
    expect(editPost).not.toHaveBeenCalled()
  })

  it('shows the trash on its own, with restore and permanent delete', async () => {
    render(<ContentWorkspace />)
    await screen.findByRole('button', { name: 'Senses of Flavors' })
    await userEvent.click(screen.getByRole('tab', { name: /^Thùng rác/ }))
    expect(screen.queryByRole('button', { name: 'Senses of Flavors' })).not.toBeInTheDocument()
    await pick('Chlorogenic Acids', 'Khôi phục')
    expect(api.transitionStatus).toHaveBeenCalledWith('Chlorogenic Acids', 'restore-trash')
    await pick('Chlorogenic Acids', 'Xoá vĩnh viễn')
    expect(api.transitionStatus).toHaveBeenCalledWith('Chlorogenic Acids', 'permanently-delete')
  })

  it('files posts by template — dạng bài is retired', async () => {
    posts[1] = { ...posts[1], template: 'bitesize' }
    render(<ContentWorkspace />)
    await screen.findByRole('button', { name: 'Senses of Flavors' })
    expect(screen.queryByRole('button', { name: /^Sửa note/ })).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Phân loại' })).getByRole('button', { name: /^bitesize/ }))
    expect(screen.getByRole('button', { name: 'Detachment' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Senses of Flavors' })).not.toBeInTheDocument()
  })

  it('moves the selected posts to a topic and puts each back on undo', async () => {
    render(<ContentWorkspace />)
    await screen.findByRole('button', { name: 'Senses of Flavors' })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Senses of Flavors' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Detachment' }))
    const bar = screen.getByRole('toolbar', { name: 'Sửa nhiều bài' })
    await userEvent.selectOptions(within(bar).getByRole('combobox', { name: 'Chủ đề' }), 'art')
    expect(api.updatePost).toHaveBeenCalledWith('Senses of Flavors', { topic_id: 'art' })
    expect(api.updatePost).toHaveBeenCalledWith('Detachment', { topic_id: 'art' })

    api.updatePost.mockClear()
    await userEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }))
    await vi.waitFor(() => expect(api.updatePost).toHaveBeenCalledWith('Detachment', { topic_id: 'book-film' }))
    expect(api.updatePost).toHaveBeenCalledWith('Senses of Flavors', { topic_id: 'sensory' })
  })
  it('filters by any metadata from one search bar, in step with the left column', async () => {
    posts[2] = { ...posts[2], authors: ['a1'] }
    render(<ContentWorkspace />)
    await screen.findByRole('button', { name: 'Senses of Flavors' })
    const box = screen.getByRole('combobox', { name: 'Lọc bài' })

    // Free text reads the topic's parent too, accent-blind.
    await userEvent.type(box, 'bean weirdo')
    expect(screen.getByRole('button', { name: 'Senses of Flavors' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Detachment' })).not.toBeInTheDocument()

    // @ picks an author; the pick becomes a chip and lights the rail's twin entries.
    await userEvent.clear(box)
    await userEvent.type(box, '@nor{Enter}')
    expect(screen.getByRole('button', { name: 'Wings of Desire' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Detachment' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Norway' }))
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Phân loại' })).getByRole('button', { name: /^bean weirdo/ }))
    expect(screen.getByRole('button', { name: 'Bỏ lọc bean weirdo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Detachment' })).not.toBeInTheDocument()
  })

  it('pins a post from its row, whichever page lists it', async () => {
    render(<ContentWorkspace />)
    await screen.findByRole('button', { name: 'Senses of Flavors' })
    await pick('Detachment', 'Ghim')
    expect(api.updatePost).toHaveBeenCalledWith('Detachment', { pinned: true })
  })
})
