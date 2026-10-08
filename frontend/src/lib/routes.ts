import type { Area } from './area'
import type { Origin, Screen } from './nav'
import { activeWords, DEFAULT_WORDS, pastWords, type RouteWords } from './routeWords'

/**
 * Every address the site answers to, in one table.
 *
 * The screen used to live only in React state, so the address bar stayed on `/`
 * however far in you walked: back and forward did nothing, a page could not be
 * linked to, and reloading dropped you at the front door. Templates was the one
 * exception, and it had to grow its own history handling to get there — which
 * is the argument for putting all of it in one place instead.
 *
 * Reading and writing are the same table read in two directions, so an address
 * that can be produced can always be parsed back.
 */
export type Where = {
  area: Area
  screen: Screen
  /** Which module a module page or an article belongs to. */
  moduleId?: string
  /** The post being read, edited or previewed — by slug, never by id. */
  slug?: string
  /** The template open inside the Templates screen. */
  templateId?: string
  /** Which tab of Content management is open. */
  tab?: CmsTab
  /** Which tab of Portfolio is open. */
  portTab?: PortTab
  /** Which door an article was opened through — see `Origin`. */
  from?: Origin
}

/**
 * Module ids are short in the database (`biochem`) and spelled out in the
 * address (`biochemistry`). Only the ones that differ are listed; the rest pass
 * through, which keeps this from becoming a list nobody remembers to update.
 */
/** Prefix of a tag page's id: `tag-heat` is the page of tag `heat`. */
export const TAG_PAGE = 'tag-'

export const moduleToUrl = (id: string, w: RouteWords = activeWords()) => w.modules[id] ?? id

function moduleFromUrl(name: string, w: RouteWords = activeWords()): string {
  for (const [id, spelt] of Object.entries(w.modules)) if (spelt === name) return id
  return name
}

/** The admin screens that live at their own `/ad-…` address. */
const adminPages = (w: RouteWords): Record<string, Screen> => ({
  [`${w.admin}-${w.adPost}`]: 'cms',
  [`${w.admin}-${w.adConfig}`]: 'cms',
  [`${w.admin}-${w.adTree}`]: 'cms',
  [`${w.admin}-${w.adAuthors}`]: 'cms',
  [`${w.admin}-${w.adSitemap}`]: 'cms',
  [`${w.admin}-${w.adPageContent}`]: 'cms',
  [`${w.admin}-${w.adTaxonomy}`]: 'cms',
  [`${w.admin}-${w.adDisplay}`]: 'cms',
  [`${w.admin}-${w.adArchive}`]: 'archive',
  // Portfolio folded into the CMS (port pages in Quản lý trang, its design in
  // Cài đặt hiển thị); its old addresses still land there.
  [`${w.admin}-${w.adPortfolio}`]: 'cms',
  [`${w.admin}-${w.adPortContent}`]: 'cms',
  [`${w.admin}-${w.adPortDesign}`]: 'cms',
})

/** Nội dung (posts and the vocabularies filing them) · Cấu hình (every page and its settings) · Cài đặt hiển thị · Tác giả. */
export type CmsTab = 'posts' | 'pages' | 'display' | 'authors'

/** Portfolio has two tabs: port pages (create, arrange) and the design system. */
export type PortTab = 'pages' | 'content' | 'design'
const portTabs = (w: RouteWords): Record<string, PortTab> => ({
  [`${w.admin}-${w.adPortfolio}`]: 'pages',
  [`${w.admin}-${w.adPortContent}`]: 'content',
  [`${w.admin}-${w.adPortDesign}`]: 'design',
})

/**
 * Which tab of Content management an `/ad-…` address opens on.
 *
 * `/ad` names the screen without naming a tab, and opens on the first one. The
 * two tabs are separate addresses because they are separate places to be — a
 * link to the settings should not open the post list.
 *
 * `/ad-sitemap`, `/ad-page-content`, `/ad-config` were tabs that are now one
 * tab. They still read, because links to them are already out there; only
 * `/ad-cau-hinh` is written from here on.
 */
const cmsTabs = (w: RouteWords = activeWords()): Record<string, CmsTab> => ({
  [`${w.admin}-${w.adPost}`]: 'posts',
  // Cấu hình and Quản lý trang are one tab since 2026-10-08; every old address lands on it.
  [`${w.admin}-${w.adConfig}`]: 'pages',
  [`${w.admin}-${w.adTree}`]: 'pages',
  [`${w.admin}-${w.adAuthors}`]: 'authors',
  // Phân loại folded into Nội dung; its old address still lands there.
  [`${w.admin}-${w.adTaxonomy}`]: 'posts',
  [`${w.admin}-${w.adSitemap}`]: 'pages',
  // Nội dung trang folded into Quản lý trang, now Cấu hình; its old address still lands there.
  [`${w.admin}-${w.adPageContent}`]: 'pages',
  [`${w.admin}-${w.adDisplay}`]: 'display',
  [`${w.admin}-${w.adPortfolio}`]: 'pages',
  [`${w.admin}-${w.adPortContent}`]: 'pages',
  [`${w.admin}-${w.adPortDesign}`]: 'display',
})
const pageOfTab = (w: RouteWords): Record<CmsTab, string> => ({
  posts: `${w.admin}-${w.adPost}`,
  pages: `${w.admin}-${w.adTree}`,
  display: `${w.admin}-${w.adDisplay}`,
  authors: `${w.admin}-${w.adAuthors}`,
})

const screenPage = (w: RouteWords): Partial<Record<Screen, string>> => ({
  archive: `${w.admin}-${w.adArchive}`,
})

/** `/ad-post/edit=<slug>` and its two siblings. */
const postActions = (w: RouteWords): Record<string, Screen> => ({
  [w.edit]: 'postEdit',
  [w.view]: 'postPreview',
})
const actionOfScreen = (w: RouteWords): Partial<Record<Screen, string>> => ({
  postEdit: w.edit,
  postPreview: w.view,
})

/**
 * The port's about page, `/about`. A fixed word rather than one of the owner's:
 * the API refuses it as a port page slug, so the two can never collide.
 */
const ABOUT = 'about'

/**
 * Where the portfolio lived before it became the root (`/portfolio/<slug>`).
 * Only read, never written: links to it are already out there.
 */
const OLD_PORTFOLIO = 'portfolio'

/**
 * Where an address points.
 *
 * The site is a tree: the portfolio at `/`, its pages at `/<slug>`, and the
 * bean blog one level under its own port page, at `/bean/…`. Anything that is
 * not an address of the blog, the journal or the back office is therefore a
 * port page's slug — and one that does not exist says so, rather than quietly
 * opening something else.
 */
export function parsePath(pathname: string, search = '', w: RouteWords = activeWords()): Where {
  // Địa chỉ viết bằng một bộ từ cũ vẫn phải mở ra đúng chỗ — đổi tên một trang
  // không được làm chết những link đã phát ra. Đọc được rồi thì `useRoute` viết
  // lại nó bằng bộ từ đang dùng.
  for (const words of [w, DEFAULT_WORDS, ...pastWords()]) {
    const hit = readPath(pathname, search, words)
    if (hit) return hit
  }
  return readPort(pathname.split('/').filter(Boolean))
}

/** `/`, `/about` and `/<slug>`: the portfolio, which owns the root. */
function readPort(seg: string[]): Where {
  if (!seg[0]) return { area: 'public', screen: 'portfolioHome' }
  if (seg[0] === ABOUT) return { area: 'public', screen: 'portfolioAbout' }
  return { area: 'public', screen: 'portfolioPage', slug: seg[0] }
}

/** Một lượt đọc bằng đúng một bộ từ. `null` nghĩa là bộ từ này không nhận ra. */
function readPath(pathname: string, search: string, w: RouteWords): Where | null {
  const seg = pathname.split('/').filter(Boolean)
  const head = seg[0] ?? ''
  const adPrefix = `${w.admin}-`

  if (head === w.practice) return { area: 'practice', screen: 'hours' }

  // ── admin ────────────────────────────────────────────────────────────────
  // `/admin` is the address the back office used to live at. It is still read
  // here — a bookmark from before this table existed should land where it
  // always did — but nothing produces it any more, so opening one rewrites
  // itself to `/ad` on arrival.
  if (head === w.admin || head === 'admin' || head.startsWith(adPrefix)) {
    const preview = new URLSearchParams(search).get('preview')
    if (preview) return { area: 'admin', screen: 'postPreview', slug: preview }

    if (head === `${w.admin}-${w.adPost}` && seg[1]) {
      // `edit=<slug>` rather than `edit/<slug>`: the verb and its object are
      // one step, so the address cannot be truncated into a half-meaning.
      const [verb, slug] = seg[1].split('=')
      const screen = postActions(w)[verb]
      if (screen) return { area: 'admin', screen, slug: slug || undefined }
    }
    const screen = adminPages(w)[head]
    if (screen === 'portfolio') return { area: 'admin', screen, portTab: portTabs(w)[head] }
    if (screen) return { area: 'admin', screen, tab: cmsTabs(w)[head] }
    return { area: 'admin', screen: 'cms' }
  }

  // ── public ───────────────────────────────────────────────────────────────
  if (head === w.bean && seg[1]) return readBlog(seg.slice(1), search, w, true)
  // The blog used to sit at the root (`/post/<slug>`, `/muc-luc`…) and the
  // portfolio under `/portfolio`. Both moved; their old addresses still read,
  // and `useRoute` rewrites them to where they live now.
  if (head === OLD_PORTFOLIO) return readPort(seg.slice(1))
  return readBlog(seg, search, w, false)
}

/** The blog's pages, read from what follows `/bean/`. */
function readBlog(seg: string[], search: string, w: RouteWords, nested: boolean): Where | null {
  const [head, arg] = seg
  // Only under `/bean/`: at the root `details` was never an address.
  if (nested && head === w.details && !arg) return { area: 'public', screen: 'landing' }
  if (head === w.index) return { area: 'public', screen: 'home' }
  if (head === w.notes) return { area: 'public', screen: 'notes' }
  if (head === w.module && arg) return { area: 'public', screen: 'module', moduleId: moduleFromUrl(arg, w) }
  // A tag's own page (migration 0028): the page id is `tag-<id>`.
  if (head === w.tag && arg) return { area: 'public', screen: 'module', moduleId: `${TAG_PAGE}${arg}` }
  if (head === w.post && arg) {
    // A reader arriving cold came through neither a module nor the admin list,
    // and `module` is the trail that makes sense to show them.
    const from = (new URLSearchParams(search).get('from') as Origin | null) ?? 'module'
    return { area: 'public', screen: 'article', slug: arg, from }
  }
  return null
}

/** The address for a place. The exact inverse of `parsePath`. */
export function toPath(where: Where, w: RouteWords = activeWords()): string {
  if (where.area === 'practice') return `/${w.practice}`
  const adHome = `/${w.admin}`
  const adPost = `/${w.admin}-${w.adPost}`
  const blog = `/${w.bean}`

  if (where.area === 'admin') {
    const action = actionOfScreen(w)[where.screen]
    if (action) return where.slug ? `${adPost}/${action}=${where.slug}` : `${adPost}/${action}`
    if (where.screen === 'article') return where.slug ? `${blog}/${w.post}/${where.slug}?from=admin` : adHome
    if (where.screen === 'cms') return where.tab ? `/${pageOfTab(w)[where.tab]}` : adHome
    if (where.screen === 'portfolio')
      return `/${w.admin}-${where.portTab === 'design' ? w.adPortDesign : where.portTab === 'content' ? w.adPortContent : w.adPortfolio}`
    const page = screenPage(w)[where.screen]
    return page ? `/${page}` : adHome
  }

  switch (where.screen) {
    case 'landing':
      return `${blog}/${w.details}`
    case 'home':
      return `${blog}/${w.index}`
    case 'notes':
      return `${blog}/${w.notes}`
    case 'portfolioPage':
      return where.slug ? `/${where.slug}` : '/'
    case 'portfolioAbout':
      return `/${ABOUT}`
    case 'module':
      if (where.moduleId?.startsWith(TAG_PAGE)) return `${blog}/${w.tag}/${where.moduleId.slice(TAG_PAGE.length)}`
      return where.moduleId ? `${blog}/${w.module}/${moduleToUrl(where.moduleId, w)}` : `${blog}/${w.details}`
    case 'article':
      // The door is worth carrying so the trail reads back the way in, but
      // `module` is the default and does not need saying.
      return where.slug
        ? `${blog}/${w.post}/${where.slug}${where.from && where.from !== 'module' ? `?from=${where.from}` : ''}`
        : `${blog}/${w.details}`
    default:
      return '/'
  }
}
