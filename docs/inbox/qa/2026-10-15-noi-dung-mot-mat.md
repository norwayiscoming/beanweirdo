# Tab Nội dung: cột lọc và danh sách bài chung một khung

PR: (số PR ghi ở mô tả PR) · nhánh `claude/project-thread-n3le4b`

Chủ site (2026-10-15) không thích việc trang bị chia thành hai khung riêng,
một khung ngắn và một khung dài.

## Thay đổi

1. **[ĐỔI HÀNH VI]** Trong `ContentWorkspace`, cột lọc bên trái (`rail`) và
   danh sách bài (`list`) không còn mỗi bên một khung viền và nền riêng, cách
   nhau 14px. Giờ cả hai nằm trong một khung (`.cw-ws`), ngăn cách bằng một
   đường kẻ dọc, nên hai cột luôn kết thúc ở cùng một độ cao. Phần trong của
   cột lọc dính trên đầu màn khi cuộn danh sách dài (`position: sticky`). Khung
   ngoài dùng `overflow: clip` vì `hidden` sẽ làm sticky không chạy.

## Bảng, cột, endpoint đã đụng

Không có. Chỉ đổi giao diện.
