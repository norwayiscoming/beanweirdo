import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PostDetail, PostTemplate } from '../lib/apiClient'
import { EditorCanvas } from './Editor'
import { GRIP_LABEL } from '../components/RowShell'

function post(template: PostTemplate, body: unknown): PostDetail {
  return {
    id: 'p1',
    module_id: 'sensory',
    en: 'Tiêu đề',
    vi: 'mô tả',
    kind: 'note',
    date_label: '2026.09',
    status: 'draft',
    template,
    hero_image_url: null,
    theme_color: null,
    sort_order: 0,
    slug: 'bai',
    body,
    lead: 'dẫn',
    further_reading: [],
  } as unknown as PostDetail
}

const draw = (template: PostTemplate, body: unknown, onChange = vi.fn()) => {
  render(<EditorCanvas template={template} post={post(template, body)} onChange={onChange} onHeroDrop={vi.fn()} />)
  return onChange
}

/*
 * Before this, these three editors let you write over the words already there
 * and nothing else — a post had exactly as many parts as the template it was
 * copied from, forever. Each test below is one of the four things that were
 * missing.
 */
describe('memo — thân bài là một dải chữ liền mạch', () => {
  /*
   * jsdom không dựng `contenteditable`, nên gõ vào mặt soạn sống ở đây không
   * sinh ra chữ nào. Phần gõ và bôi đen đo bằng Playwright trong Chrome —
   * xem `tools/e2e/live.mjs`. Chỗ này giữ cái jsdom trả lời thật được: mọi
   * khối chữ có nằm chung MỘT mặt soạn không.
   */
  const body = {
    subtitle: 'ba lần rót',
    sections: [
      { h: 'Bean character', items: [{ runs: [{ t: 'Ngọt mía, ' }, { t: 'hậu vị ngắn', em: true }], cont: ['đo lúc drop'] }] },
      { h: 'Pour test', phases: [{ n: '01', label: 'blooming', lines: ['40g'] }] },
    ],
  }

  it('mọi khối chữ vào chung một mặt, nên bôi đen chạy suốt', () => {
    draw('memo', body)
    const surfaces = document.querySelectorAll('.awc-live-input')
    expect(surfaces).toHaveLength(1)
    const text = surfaces[0].textContent ?? ''
    expect(text).toContain('Bean character')
    expect(text).toContain('Ngọt mía')
    expect(text).toContain('Pour test')
    expect(text).toContain('blooming')
  })

  it('chữ nhấn vẽ ra đậm ngay trong mặt soạn, không hiện dấu sao', () => {
    draw('memo', body)
    expect(document.querySelector('.awc-live-bold')?.textContent).toBe('hậu vị ngắn')
    expect(document.querySelector('.awc-live-input')?.textContent).not.toContain('*')
  })

  it('tiêu đề mục vẽ ra thẻ tiêu đề, không ra dấu thăng', () => {
    draw('memo', body)
    expect([...document.querySelectorAll('.awc-live-input h2')].map((el) => el.textContent)).toEqual([
      'Bean character',
      'Pour test',
    ])
  })

  it('danh sách vẽ ra thẻ danh sách thật', () => {
    draw('memo', body)
    const items = [...document.querySelectorAll('.awc-live-input li')].map((el) => el.textContent)
    expect(items.some((t) => t?.includes('Ngọt mía'))).toBe(true)
    expect(items.some((t) => t?.includes('blooming'))).toBe(true)
  })
})
