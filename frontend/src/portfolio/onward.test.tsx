// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PortfolioView } from './PortfolioView'
import { resolveDesign } from './tokens'
import type { Block } from './blocks'

const hero: Block = { id: 'h', type: 'head', title: 'bean', intro: '' }
const about: Block = { id: 'a', type: 'about', head: 'x', text: '', image: '', links: [] }

const view = (blocks: Block[], onward?: { href: string; label: string }) =>
  render(
    <PortfolioView
      title="bean"
      intro=""
      palette="biz"
      blocks={blocks}
      design={resolveDesign({})}
      posts={[]}
      moduleTitles={{}}
      postHref={() => '#'}
      onward={onward}
    />,
  ).container

describe('nút đi xuống một tầng của cây site', () => {
  it('đứng ngay dưới hero, trước mọi khối khác', () => {
    const c = view([hero, about], { href: '/bean/details', label: 'details' })
    const link = c.querySelector('a.onward') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/bean/details')
    const order = [...c.querySelectorAll('[data-block], a.onward')].map((el) => el.getAttribute('data-block') ?? 'onward')
    expect(order).toEqual(['h', 'onward', 'a'])
  })

  it('lên đầu trang khi trang không mở bằng hero', () => {
    const c = view([about], { href: '/bean/details', label: 'details' })
    const order = [...c.querySelectorAll('[data-block], a.onward')].map((el) => el.getAttribute('data-block') ?? 'onward')
    expect(order).toEqual(['onward', 'a'])
  })

  it('không có gì ở trang không dẫn xuống đâu', () => {
    expect(view([hero]).querySelector('a.onward')).toBeNull()
  })
})
