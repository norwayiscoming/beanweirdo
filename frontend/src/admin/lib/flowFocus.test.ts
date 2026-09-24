// @vitest-environment jsdom
/**
 * Luật bàn phím trong một khối đứng giữa các dải chữ (`thingKeyDown`).
 *
 * Chủ site: *"viết trong khối xong enter không thoát ra khỏi khối"*. Phần
 * vẽ và đo dòng chỉ kiểm được trong Chrome thật; ở đây kiểm luật: phím nào
 * đưa con trỏ đi đâu.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FLOW_EXIT, thingKeyDown } from './flowFocus'

function mount(values: string[]) {
  document.body.innerHTML = `<div data-flow-root><div data-flow="thing" data-flow-at="0">${values
    .map((v) => `<input value="${v}" />`)
    .join('')}</div></div>`
  const stop = document.querySelector<HTMLElement>('[data-flow=thing]')!
  const inputs = Array.from(stop.querySelectorAll('input'))
  return { stop, inputs }
}

function press(stop: HTMLElement, target: HTMLInputElement, key: string, remove = vi.fn()) {
  target.focus()
  target.setSelectionRange(target.value.length, target.value.length)
  const native = new KeyboardEvent('keydown', { key })
  let prevented = false
  thingKeyDown(
    {
      key,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target,
      currentTarget: stop,
      defaultPrevented: false,
      nativeEvent: native,
      preventDefault: () => {
        prevented = true
      },
    },
    remove,
  )
  return { prevented, remove }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('thingKeyDown', () => {
  it('Enter ở ô có chữ sang ô kế tiếp của cùng khối (nhãn → giá trị)', () => {
    const { stop, inputs } = mount(['nhãn', ''])
    const { prevented } = press(stop, inputs[0], 'Enter')
    expect(prevented).toBe(true)
    expect(document.activeElement).toBe(inputs[1])
  })

  it('Enter ở ô trống thì xin thoát khối', () => {
    const { stop, inputs } = mount(['nhãn', ''])
    const exit = vi.fn()
    stop.addEventListener(FLOW_EXIT, exit)
    press(stop, inputs[1], 'Enter')
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('Enter ở ô cuối của khối cũng thoát, dù ô có chữ', () => {
    const { stop, inputs } = mount(['a', 'b'])
    const exit = vi.fn()
    stop.addEventListener(FLOW_EXIT, exit)
    press(stop, inputs[1], 'Enter')
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('Backspace trong một khối trống trơn thì bỏ khối', () => {
    const { stop, inputs } = mount(['', ''])
    const { remove, prevented } = press(stop, inputs[0], 'Backspace')
    expect(prevented).toBe(true)
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('Backspace không bỏ khối còn chữ ở ô khác', () => {
    const { stop, inputs } = mount(['', 'còn chữ'])
    const { remove } = press(stop, inputs[0], 'Backspace')
    expect(remove).not.toHaveBeenCalled()
  })
})
