# Ghi 01: trang trí luôn hiện ở chỗ của nó

PR: (xem nhánh) · nhánh `claude/project-thread-12dfli`, nối tiếp PR #50.

## [SỬA LỖI] Ảnh trang trí và câu trích biến mất khi trang có ít bài

Chủ site: "các cái deco đâu?" sau khi PR #50 lên.

- Nguyên nhân: `blockLayout` trong `screens/Notes.tsx` (bản PR #50) chỉ vẽ ảnh khi ô 1 có bài và câu trích khi ô 2 có bài. Bài lấp khối từ ô 7 ngược lên, nên với dưới 6–7 bài thì ô 1, ô 2 trống và cả hai món đều không hiện.
- Sửa: `blockLayout` vẽ ảnh của mỗi khối (`PHOTO_SPOT`) và câu trích ở khối trên cùng (`QUOTE_SPOT`) bất kể ô bên cạnh. Vị trí không đổi.
- Tái hiện: trang Ghi với 3 bài, trước khi sửa không có ảnh trang trí hay câu trích nào.

Không đụng bảng, cột, endpoint.
