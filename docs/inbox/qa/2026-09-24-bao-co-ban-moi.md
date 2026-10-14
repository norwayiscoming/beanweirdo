# PR #31 · nhánh `claude/project-thread-8y1gww`

Chủ site hỏi "clear bớt cache đi được không?". Tôi hiểu là: bớt chuyện phải
Ctrl+Shift+R sau mỗi lần deploy.

## [ĐỔI HÀNH VI] Tab đang mở tự báo khi có bản mới

- Trước: tab đã mở chạy bản cũ mãi tới khi tải lại tay, không có dấu hiệu gì.
- Sau: khi tab trở lại hiển thị và mỗi 5 phút (`CHECK_EVERY_MS`), trang tải `/`
  với `cache: 'no-store'`, so script `/assets/index-*.js` với script đang chạy
  (`entryScript` trong `frontend/src/components/NewVersionNotice.tsx`). Khác
  thì hiện ô "Trang vừa có bản mới." với nút "Tải lại". Không tự tải lại.
- Hiện ở mọi khu (công khai và quản trị), vì được gắn trong `App` (`App.tsx`).
- Không chạy ở dev server: không có script băm tên nên `entryScript` trả null.
- Tái hiện: `vite build`, `vite preview`, mở trang, build lại với một chữ
  khác, quay lại tab → ô hiện ra.

## [ĐỔI HÀNH VI] Preflight chỉ được nhớ 10 phút

- Trước: `Access-Control-Max-Age: 86400` (Chrome cắt còn 2 tiếng).
- Sau: 600 giây, hằng `PREFLIGHT_MAX_AGE_S` trong `backend/lib/cors.ts`
  (`applyCorsHeaders`). Test `cors.test.ts` đổi theo.
- Giá: mỗi endpoint thêm một lượt OPTIONS mỗi 10 phút.

## [SỬA LỖI] Header cache của frontend ghi rõ

- `frontend/vercel.json`: `no-cache` cho mọi đường dẫn ngoài `/assets/`,
  `public, max-age=31536000, immutable` cho `/assets/*`. Mặc định của Vercel
  vốn đã là `max-age=0, must-revalidate` cho trang, nên hành vi gần như không
  đổi; đây là để không phụ thuộc vào mặc định đó.

## Đã đụng

- Endpoint: `GET /` của frontend (đọc thêm, 1 lần mỗi 5 phút mỗi tab).
- Header: `Access-Control-Max-Age` trên mọi route backend.
- Không đụng bảng hay cột nào.
