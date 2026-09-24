// @vitest-environment jsdom
/**
 * The contract every block in the `+` menu keeps, in every template.
 *
 * The menu reads the element registry, so a new element shows up in `+` the
 * moment it is registered — and nothing else forces it to obey the keyboard
 * rules the owner fixed on 2026-09-24 ("keyboard centered ... failed nếu không
 * có keyboard"). This test walks the menu itself rather than a hand-kept list,
 * so a block added later is checked without anyone remembering to add it here.
 *
 * What jsdom can answer: the block sits inside a flow shell (which is where
 * the Enter / arrow / Backspace rules live), it has a place the keyboard can
 * land, and Cmd+Enter from inside it opens a text line after it. Typing into
 * Lexical is measured in Chromium instead — see `frontend/harness.html`.
 */
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PostDetail } from '../lib/apiClient'
import { blankReportBlock } from '../lib/postData'
import { EditorCanvas, menuNames } from './Editor'

const TEMPLATES = ['report', 'memo', 'bitesize', 'cards', 'article', 'longform'] as const

function draw(template: (typeof TEMPLATES)[number], thing: unknown) {
  const blocks = [{ ...(thing as object), id: 'b1' }]
  // Memo and bitesize keep their body as `{ elements }`, cards one body per
  // card, the others a bare list.
  const body =
    template === 'memo' || template === 'bitesize'
      ? { elements: blocks }
      : template === 'cards'
        ? [{ n: '01', hue: '#3A6EA5', title: 'Thẻ', sub: '', tag: '', groups: [], parts: [], elements: blocks }]
        : blocks
  const onChange = vi.fn()
  const view = render(
    <EditorCanvas
      template={template}
      post={
        {
          id: 'p1', module_id: 'sensory', en: 'T', vi: 'm', kind: 'note', date_label: '2026.09',
          status: 'draft', hero_image_url: null, theme_color: null, sort_order: 0, slug: 'b',
          further_reading: [], lead: '', template, body,
        } as unknown as PostDetail
      }
      onChange={onChange}
      onHeroDrop={vi.fn()}
    />,
  )
  // A card draws its body only while it is open.
  if (template === 'cards') fireEvent.click(view.container.querySelector('[aria-expanded="false"]')!)
  return { onChange, view }
}

/** Where the keyboard lands inside a block: a field, or the block's first button. */
const landing = (thing: HTMLElement) =>
  Array.from(
    thing.querySelectorAll<HTMLElement>(
      'input:not([type=file]):not([type=hidden]), textarea, [role=textbox], [contenteditable=true], button',
    ),
  ).filter((el) => !el.closest('.awc-gutter'))

const typed = (thing: HTMLElement) =>
  landing(thing).filter((el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)

describe('mọi khối trong menu + giữ cùng một luật bàn phím', () => {
  const names = menuNames('', 'things')

  it('menu + có khối để kiểm', () => {
    expect(names.length).toBeGreaterThan(5)
  })

  for (const template of TEMPLATES) {
    for (const name of names) {
      it(`${template} · ${name}`, () => {
        const { onChange, view } = draw(template, blankReportBlock(name))
        const thing = view.container.querySelector<HTMLElement>('[data-flow="thing"]')
        // Outside a flow shell there are no Enter / arrow / Backspace rules at all.
        expect(thing, 'khối không nằm trong vỏ data-flow="thing"').not.toBeNull()
        expect(thing!.closest('[data-flow-root]'), 'khối không nằm trong data-flow-root').not.toBeNull()
        expect(landing(thing!).length, 'khối không có chỗ nào cho bàn phím đứng').toBeGreaterThan(0)

        // Cmd+Enter from any field of the block leaves it for a new text line.
        const field = typed(thing!)[0]
        if (!field) return
        onChange.mockClear()
        act(() => {
          field.focus()
          fireEvent.keyDown(field, { key: 'Enter', metaKey: true })
        })
        expect(onChange, 'Cmd+Enter không mở dòng chữ sau khối').toHaveBeenCalled()
      })
    }
  }
})
