import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALLOWED_METHODS } from '../../../../backend/lib/cors'

/*
 * Backend phải cho phép đúng những method mà apiClient gửi đi.
 *
 * Đã xảy ra 2026-09-19: `Access-Control-Allow-Methods` liệt kê GET, POST,
 * PATCH, DELETE, OPTIONS — thiếu **PUT**. Hai endpoint dùng PUT (đổi thứ tự
 * module, đổi thứ tự bài trong module) chết hẳn trên trình duyệt: preflight trả
 * về danh sách không có PUT nên request không bao giờ rời máy. Máy chủ không
 * thấy lỗi, apiClient không nhận được response, còn CMS thì đã vẽ thứ tự mới
 * theo kiểu lạc quan — nên nhìn thì thấy đổi, tải lại là về chỗ cũ.
 *
 * Không tra bằng cách đọc danh sách viết tay: đọc thẳng mã nguồn apiClient, để
 * ai thêm một verb mới mà quên khai báo thì đỏ ngay.
 */

// `process.cwd()` như Button.test.tsx: tệp này chạy trong jsdom nên
// `import.meta.url` là một URL http, không phải file.
const SOURCE = resolve(process.cwd(), 'frontend/src/admin/lib/apiClient.ts')

describe('CORS cho phép đúng những method apiClient gửi', () => {
  const used = [
    ...new Set(
      Array.from(readFileSync(SOURCE, 'utf8').matchAll(/method:\s*'([A-Z]+)'/g), (m) => m[1]),
    ),
  ].sort()

  it('tìm thấy các method trong apiClient', () => {
    // Nếu regex trượt (đổi cách viết request) thì bài dưới đỗ vống — chốt ở đây.
    expect(used.length).toBeGreaterThanOrEqual(4)
    expect(used).toContain('PUT')
  })

  it.each(used)('%s nằm trong Access-Control-Allow-Methods', (method) => {
    expect(ALLOWED_METHODS).toContain(method)
  })
})
