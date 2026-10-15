# Làm lại trang bài /p/ — nhánh `claude/config-one-tree-539wvd`

PR: (số PR ghi ở mô tả PR; nhánh trên). Không đụng bảng, cột hay endpoint nào.

## [ĐỔI HÀNH VI] Đầu bài chung thay cho dải màu của từng khuôn

- Trước: trên `/p/<slug>` mỗi khuôn vẫn vẽ dải màu + tên bài riêng; bảng thông tin
  (`PostProps`) nằm trong ô `breadcrumb`, tức là **trên** tên bài, trên nền dải màu.
- Sau: prop `breadcrumb` của post-renderer đổi thành `head`
  (`packages/post-renderer/src/PostRenderer.tsx: Chrome`). Khi có `head`, cả sáu
  khuôn bỏ dải màu và tên bài của mình, đặt `head` ở đầu cột chữ.
- `head` do app vẽ: `frontend/src/components/PostHead.tsx: PostHead` — ảnh bìa,
  tên bài, lead, rồi bảng Tác giả · Chủ đề · Tag · Hiện ở · Ngày · Đọc trên nền
  trang, kẻ một đường trên và dưới. `PostProps` trong `Byline.tsx` bị xoá.
- Article (`Article.tsx`): dưới `head` bỏ cột phụ "bài liên quan" và ảnh chi tiết;
  pull quote và plates chỉ hiện khi có dữ liệu. `screens/Article.tsx` thôi tìm bài
  lân cận (`renderRelatedItem`, `renderEyebrow` xoá).
- Longform: dưới `head` ẩn rail mục lục nổi bên phải và h1 đầu tiên (trùng tên bài).
- Memo: dưới `head` bỏ ô ảnh hero (ảnh bìa đã ở `head`) và đường kẻ dưới đầu bài.
- Bitesize: dưới `head` bỏ dòng ngày và tên bài.
- Preview admin (`admin/screens/Preview.tsx`) dùng cùng `PostHead`.

## [ĐỔI HÀNH VI] Cột trái của /p/

- `screens/PostRail.tsx: PostRail` đo mép trái của `[data-post-head]` và đặt cột trái
  (rộng 200, cách 48) ngay cạnh cột chữ. Không đủ chỗ (cards, màn hẹp, điện thoại)
  thì hiện một dòng "← Quay lại" phía trên thay cho cột.
- Mục lục "Trong bài này" bỏ tiêu đề trong `head`, bỏ ký tự ▾ ▸ của tiêu đề gập.

## Đề xuất

- Không có.
