# Ghi 01: bài cùng cỡ nhưng đặt lệch nhau

Nhánh `claude/project-thread-12dfli`, PR mở sau PR #47.

## [ĐỔI HÀNH VI] Vị trí thẻ bài

- Trước (PR #47): ba bài một hàng, mọi thẻ `span 4`, không lệch.
- Sau: mọi thẻ vẫn bốn trên mười hai cột và khung ảnh 4:3, nhưng hai thẻ một hàng,
  mỗi thẻ bắt đầu ở một cột khác và tụt xuống một khoảng khác, theo `SCATTER` trong
  `screens/Notes.tsx` (chu kỳ sáu). Bản hẹp: thẻ rộng 84%, đổi bên trái/phải, lệch
  0–36px (`SCATTER_MOBILE`).
- Chỉ lệch xuống (margin dương), không thẻ nào kéo lên chồng thẻ trên.
- Trang trí vẫn ở chân trang như PR #47.

Lý do: chủ site 2026-09-24 sau khi thấy PR #47, "tôi muốn sự hơi lộn xộn ấy chứ không
theo hàng như kia". PR #47 đã merge trước tin đó.

Test: `Notes.inline.test.tsx` đổi kỳ vọng; bộ lọc thẻ nay đọc `[data-note]` vì
`FooterImage` cũng mang `9 / span 4`.
