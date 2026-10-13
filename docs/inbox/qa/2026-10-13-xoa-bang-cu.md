# Xoá bảng `portfolio_pages` và view `topics`

Nhánh `claude/project-thread-oa1vgt` · PR mở ngày 2026-10-13 (số PR ghi ở tiêu đề PR). Nối tiếp `2026-10-13-bang-nodes.md` (PR #72).

## Database: `backend/supabase/migrations/0033_drop_old_node_tables.sql` — chủ site chạy tay
- `drop view public.topics` — cầu tạm của 0032 cho bản code cũ.
- `drop table public.portfolio_pages` — dữ liệu đã chép sang `nodes` (`site = 'port'`) ở 0032.
- Chủ site xác nhận site thật chạy đúng sau PR #72/#73 trước khi viết file này (thread "Mẫu chung cho trang chi tiết", 2026-10-13).
- Đã chạy thử trên Postgres 16 dựng từ 0001–0032: `anon` vẫn đọc `posts` và `nodes`.

## [SỬA LỖI] Chú thích
- `frontend/src/lib/treeMove.ts`: chú thích còn ghi `?vocab=topics`, sửa thành `?vocab=nodes`. Không đổi code.

## Bảng, cột, endpoint
- Xoá: view `topics`, bảng `portfolio_pages`. Không còn code nào đọc ghi hai thứ này (tìm `portfolio_pages`, `from('topics')` trong `frontend/src`, `backend`, `packages`: không còn).
