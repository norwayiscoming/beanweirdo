/**
 * Vẽ một dãy element lấy từ kho.
 *
 * Trước đây mỗi khuôn bài tự viết lấy vòng lặp này — tra `getElement`, dựng
 * `View`, rồi bọc nó cho màn soạn. Cùng mười dòng, chép ra từng nơi. Chép ra
 * thì lần sửa sau chỉ có một bản được sửa, và khuôn nào bị quên thì tụt lại mà
 * không ai thấy.
 *
 * Nên nó là một chỗ. Khuôn nào có một dãy element thì gọi cái này.
 */
import { Fragment, type ReactNode } from 'react'
import type { Palette } from '../palette'
import { getElement } from './registry'
import { toElements, type StoredElement } from './read'

export type ElementListProps = {
  elements: unknown
  palette: Palette
  /** Bố cục điện thoại, truyền xuống từ khuôn bài — element không tự đo. */
  mobile?: boolean
  /**
   * Cho màn soạn bọc từng element bằng tay nắm và nút chèn của nó.
   *
   * Trả `null` là không vẽ gì cả ở chỗ ấy: mặt soạn gộp cả một dải chữ vào một
   * ô, nên những element sau trong cùng dải không có gì để vẽ riêng.
   */
  wrap?: (drawn: ReactNode, index: number, element: StoredElement) => ReactNode
}

export function ElementList({ elements, palette, mobile, wrap }: ElementListProps) {
  return (
    <>
      {toElements(elements).map((el, i) => {
        const definition = getElement(el.type)
        const drawn = definition ? (
          <definition.View attributes={el} palette={palette} index={i} mobile={mobile} />
        ) : null
        return <Fragment key={el.id ?? i}>{wrap ? wrap(drawn, i, el) : drawn}</Fragment>
      })}
    </>
  )
}
