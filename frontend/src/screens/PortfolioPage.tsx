import { useEffect } from 'react'
import { useNav } from '../lib/nav'
import { PortAbout, PortHome, PortfolioView } from '../portfolio/PortfolioView'
import { buildChrome, homeCards, onwardOf, usePortChrome, usePostHref, usePortSources, usePublicPort } from '../portfolio/data'
import { portPagePath } from '../lib/routes'

/**
 * The public portfolio pages: / (main page), /about, the child sites' homes
 * (/biz, /bean) and biz's pages (/biz/<slug>). Full width, without the site's
 * left rail — every page wears the portfolio's own header and footer (06.1, 06.17).
 */
function NotFound() {
  return <div style={{ padding: '120px 34px', fontFamily: 'Georgia, serif', fontSize: 34 }}>không có trang này</div>
}

export function PortfolioPage() {
  const nav = useNav()
  const { page, design, loading } = usePublicPort(nav.slug, nav.portSite)
  const chrome = usePortChrome()
  const src = usePortSources()
  const postHref = usePostHref()

  // A site's home opened by its slug (/biz-hkd, /biz/been-hkd) moves to the site's own address.
  useEffect(() => {
    if (!page?.home_of || nav.portSite === page.home_of) return
    window.history.replaceState({}, '', portPagePath(page))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [page, nav.portSite])

  if (loading || chrome.loading) return null
  if (!page) return <NotFound />
  return (
    <PortfolioView
      title={page.title}
      intro={page.intro}
      palette={page.look}
      blocks={page.blocks}
      design={design}
      posts={src.posts}
      moduleTitles={src.moduleTitles}
      postHref={postHref}
      onward={onwardOf(page)}
      chrome={buildChrome(chrome.content, chrome.pages, `page:${page.id}`)}
    />
  )
}

export function PortfolioHome() {
  const { design, loading } = usePublicPort(null)
  const chrome = usePortChrome()
  if (loading || chrome.loading) return null
  return (
    <PortHome
      design={design}
      chrome={buildChrome(chrome.content, chrome.pages, 'home')}
      cards={homeCards(chrome.content, chrome.pages, design)}
    />
  )
}

export function PortfolioAbout() {
  const { design, loading } = usePublicPort(null)
  const chrome = usePortChrome()
  if (loading || chrome.loading) return null
  return (
    <PortAbout
      design={design}
      chrome={buildChrome(chrome.content, chrome.pages, 'about')}
      posts={chrome.pages.filter((p) => p.status === 'published').map((p) => ({ label: p.title, url: portPagePath(p) }))}
    />
  )
}
