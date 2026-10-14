# Thẻ xem trước bài: rê chuột 2 giây, hiện 30% bài

Nhánh `claude/project-thread-442o9y` · PR mở ngày 2026-10-14 (số PR ghi ở tiêu đề PR).
Chủ site yêu cầu (ảnh chụp, 2026-10-14): trên danh sách bài của trang port, thôi bắt
click mới hiện thẻ; dừng chuột 2 giây là hiện, trong thẻ có nội dung bài, lộ khoảng
30%, phần còn lại mờ đi, cuối có nút đọc tiếp sang bài, giống bài trả phí của Medium.

## Đã đổi

- **[ĐỔI HÀNH VI]** Thẻ xem trước của trang port (`portfolio/PostPeek.tsx`:
  `usePeek`, `PostPeek`). Trước: click một bài (dòng series, thẻ, chú thích ảnh
  mở đầu, ô ảnh fibonacci) mở hộp thoại giữa màn có ảnh, "trước khi đọc" + lead,
  và "đọc bài →". Sau:
  - Chuột dừng trên bài `HOVER_MS` = 2000ms thì thẻ hiện cạnh bài (phải nếu đủ
    chỗ, không thì trái, không thì giữa). Rời bài và thẻ quá `LEAVE_MS` = 250ms
    thì đóng. Chỉ áp cho `pointerType === 'mouse'`.
  - Click (và chạm trên điện thoại) mở ngay, thẻ ở lại tới khi bấm ×, Esc hoặc
    bấm ra ngoài. Màn hẹp hơn 640px: thẻ nằm giữa trên nền tối.
  - Thẻ cố định 440×600 (thấp hơn nếu cửa sổ thấp), thân bài vẽ bằng
    `PostRenderer` khuôn của chính bài với `mobile`, cuộn được tới `SHOWN` = 30%
    chiều cao bài (không dưới một khung thẻ, không quá 2,5 khung), rồi lớp mờ và
    nút "Đọc tiếp" trỏ tới `postHref` (cùng địa chỉ "đọc bài →" cũ dùng).
  - Hộp thoại cũ (`Summary` trong `PortfolioView.tsx`, CSS `.pf-pop`) đã xoá.
    Dòng "trước khi đọc" + lead không còn trong thẻ.
- **[SỬA LỖI]** không có.

## Đã đụng

- Bảng `posts`: đọc `select('*')` một hàng theo `id` khi thẻ sắp mở (lúc chuột
  vừa vào bài, trước 2 giây), giữ trong bộ nhớ cho cả lượt xem (`loadPost`).
  Trước đây thẻ không đọc thêm gì.
- Không đổi endpoint, cột hay migration.
- `packages/post-renderer/src/PostRenderer.tsx`: chỉ sửa chú thích liệt kê chỗ
  truyền `mobile`.

## Kiểm

Trang thử dựng tạm (đã xoá), dữ liệu giả, Playwright: sau 1s chưa mở, sau 2,5s
mở; vào thẻ cuộn tới cuối thấy nút; rời thẻ thì đóng; điện thoại chạm mở, chạm
ngoài đóng. Ảnh: `/mnt/project-files/the-xem-truoc/`.

## Đề xuất

- Các thành phần `position: fixed` của khuôn (dải mục lục long-form) bị ẩn trong
  thẻ bằng CSS `.pf-peek .post [style*="position: fixed"]`. Nếu khuôn đổi cách
  viết style, selector này cần xem lại.
