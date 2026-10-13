-- Bỏ hai thứ 0032 giữ lại tạm: bảng `portfolio_pages` và view `topics`.
--
-- 0032 chép trang port sang `nodes` (site = 'port') và đổi tên `topics` thành
-- `nodes`, nhưng giữ bảng cũ và một view cùng tên để bản code cũ chạy được
-- trong lúc chờ deploy. Code mới (PR #72) không còn đọc ghi hai thứ này; chủ
-- site xác nhận site chạy đúng ngày 2026-10-13.
--
-- Không đụng `portfolio_design` — vẫn là design token của port.
--
-- Số hiệu 0033: 0032 là migration cuối đã chạy.

begin;

drop view if exists public.topics;
drop table if exists public.portfolio_pages;

commit;

-- Kiểm tra: dán kết quả câu này lại cho Claude. Mong đợi: một dòng, cot_con = 'nodes'.
select string_agg(table_name, ', ' order by table_name) as cot_con
from information_schema.tables
where table_schema = 'public' and table_name in ('nodes', 'topics', 'portfolio_pages');
