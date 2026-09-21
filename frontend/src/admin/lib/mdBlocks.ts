/**
 * Markdown của một dải, cắt ra đúng những khối mặt soạn **vẽ ra**.
 *
 * Nút `+` chèn vào chỗ con trỏ đang đứng, mà chỗ ấy chỉ biết được bằng một
 * con số: khối thứ mấy trong mặt soạn. Trước 2026-09-21 con số ấy đem cộng
 * thẳng vào chỉ số khối trong kho — và hai thứ đó không khớp nhau:
 *
 * - article: một `section` vẽ ra **hai** khối (`## tiêu đề` rồi đoạn văn), nên
 *   con trỏ ở khối thứ ba của một dải hai phần cho ra chỉ số 4, tức rơi ra
 *   ngoài dải, xuống tận cuối bài. Đúng cái chủ site thấy.
 * - longform: cả dải nối bằng **một** dấu xuống dòng, nên năm đoạn văn vẽ ra
 *   *một* khối; con số luôn là 0 và khối chèn vào luôn nằm sau đoạn đầu.
 *
 * Nên chỗ này không đếm khối trong kho nữa. Nó cắt chính chuỗi markdown của
 * dải, theo đúng luật Lexical gom dòng thành khối, rồi hai nửa ấy đi qua
 * `markdownToRun` của từng màn để dựng lại. Không còn phép cộng chỉ số nào.
 */

const HEADING = /^ {0,3}#{1,6}\s/
const QUOTE = /^ {0,3}>/
const BULLET = /^\s*[-*+]\s/
const NUMBER = /^\s*\d+[.)]\s/
const FENCE = /^ {0,3}```/

/** Loại của một dòng, đủ để biết nó có gom được với dòng trước không. */
type Kind = 'heading' | 'quote' | 'ul' | 'ol' | 'para' | 'code'

function kindOf(line: string): Kind {
  if (FENCE.test(line)) return 'code'
  if (HEADING.test(line)) return 'heading'
  if (QUOTE.test(line)) return 'quote'
  if (NUMBER.test(line)) return 'ol'
  if (BULLET.test(line)) return 'ul'
  return 'para'
}

/**
 * Dòng này có nối vào khối đang mở không — đo từ chính Lexical, xem
 * `mdBlocks.test.ts`, chứ không suy từ CommonMark.
 *
 * Ba luật đáng nhớ, vì cả ba đều trái với cảm giác thường:
 * 1. Danh sách **nuốt** dòng chữ thường ngay sau nó (`- a\n- b\np3` ra một
 *    khối, không phải hai); trích dẫn cũng vậy.
 * 2. Một dòng trống **không** cắt hai danh sách cùng kiểu — chúng vẫn gộp làm
 *    một. Nhưng dòng trống rồi đến chữ thường thì cắt.
 * 3. Tiêu đề luôn đứng một mình, không nuốt gì và không bị nuốt.
 */
function joins(open: Kind, next: Kind, afterBlank: boolean): boolean {
  if (afterBlank) return (open === 'ul' || open === 'ol') && next === open
  if (open === 'heading' || next === 'heading') return false
  if (open === 'code' || next === 'code') return false
  if (open === 'para') return next === 'para'
  return next === open || next === 'para'
}

/**
 * Một dải markdown thành đúng những khối mặt soạn vẽ ra, theo thứ tự.
 *
 * Dải rỗng vẫn cho **một** khối: mặt soạn rỗng vẫn vẽ một đoạn văn trống, và
 * chỗ gọi cần một chỗ để chèn vào.
 */
export function mdBlocks(text: string): string[] {
  const out: string[] = []
  let open: Kind | null = null
  let blank = false
  let fenced = false
  for (const line of text.split('\n')) {
    if (fenced) {
      out[out.length - 1] += `\n${line}`
      if (FENCE.test(line)) {
        fenced = false
        open = null
      }
      continue
    }
    if (line.trim() === '') {
      blank = true
      continue
    }
    const next = kindOf(line)
    if (open !== null && joins(open, next, blank)) {
      out[out.length - 1] += `\n${line}`
      // Khối vẫn là khối cũ: chữ thường nối vào danh sách thì nó vẫn là danh
      // sách, và dòng kế tiếp phải đo theo danh sách chứ không theo chữ.
    } else {
      out.push(line)
      open = next
    }
    blank = false
    if (next === 'code' && open === 'code') fenced = true
  }
  return out.length === 0 ? [''] : out
}

/**
 * Cắt dải làm đôi ngay **sau** khối thứ `index`.
 *
 * `index` ngoài khoảng thì kẹp vào hai đầu: con trỏ chưa từng đặt vào dải nào
 * thì chèn vào đầu dải còn hơn là ném xuống cuối bài.
 */
export function splitAfterBlock(text: string, index: number): [string, string] {
  const parts = mdBlocks(text)
  const cut = Math.min(Math.max(index + 1, 0), parts.length)
  return [parts.slice(0, cut).join('\n\n'), parts.slice(cut).join('\n\n')]
}
