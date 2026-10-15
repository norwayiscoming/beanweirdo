# Sửa tên bài và slug ở ngăn "Thông tin bài"

PR: (số PR ghi ở mô tả PR) · nhánh `claude/project-thread-y8z0tm`

Chủ site (2026-10-15): tên bài không khớp với heading trong bài, và không có chỗ
nào sửa tên; muốn sửa được từ danh sách và trong ngăn bên, có slug tự sinh từ
tên (không dấu, khoảng trắng thành "-"), và thứ tự ngăn: tên bài → slug → tác
giả → module…

## Tìm thấy

- Tên bài luôn là cột `posts.en`, không bao giờ đọc từ heading
  (`postTitle` trong `frontend/src/lib/postText.ts`, `toLongformData` trong
  `frontend/src/lib/postToRenderer.ts`). Nó được đặt một lần ở hộp "Bài mới";
  heading trong thân bài viết riêng nên hai thứ trôi khỏi nhau.
- Khuôn long-form không có ô sửa tên trên trang (`LongformEditor` trong
  `Editor.tsx` không truyền `renderTitle`; `Longform` của post-renderer cũng
  không nhận) — trước PR này bài long-form không đổi tên được ở đâu cả.

## Thay đổi

1. **[ĐỔI HÀNH VI]** Ngăn "Thông tin bài" (`PostSettings`) có ô **Tên bài** ở
   đầu, ghi `en` qua đúng đường patch của màn soạn / danh sách. Bài đã đăng thì
   tên mới vào bản nháp như mọi chữ khác (`DRAFT_FIELDS` trong
   `backend/lib/drafts.ts`), ngăn nói điều đó. Tên rỗng bị bỏ qua.
   Nếu heading đầu bài (`proseOf`) khác tên, dưới ô hiện heading ấy kèm nút
   "Dùng làm tên".
2. **[ĐỔI HÀNH VI]** Thứ tự ngăn: trước là Vị trí (Chủ đề, Tag) · Người viết ·
   Hiển thị (Template, Màu mượn từ, Màu bài) · Địa chỉ & quyền xem. Sau là
   Tên & người viết (Tên bài, Slug, Địa chỉ cũ, Tác giả) · Vị trí (Màu mượn từ,
   Chủ đề, Tag) · Hiển thị (Template, Màu bài, Quyền xem). Ô "Địa chỉ" đổi tên
   thành "Slug" và dời lên, không thêm ô thứ hai.
3. **[ĐỔI HÀNH VI]** Slug gõ tay được làm sạch như tên (`titleSlug` trong
   `frontend/src/lib/postSlug.ts`): "Cà phê Đặc" → `ca-phe-dac`. Trước: gõ có
   dấu thì máy chủ từ chối.
4. **[ĐỔI HÀNH VI]** Đăng lần đầu một bài chưa có slug: địa chỉ lấy theo tên
   (`slugToPublish(id, title)` trong `usePostAddresses.tsx`, thêm `-2`, `-3`
   khi trùng bài khác hoặc địa chỉ cũ còn chuyển hướng). Trước: luôn
   `module-pYYMMDD`. Tên không có chữ/số nào thì vẫn rơi về kiểu cũ.
5. **[ĐỔI HÀNH VI]** Slug đang trùng với slug-từ-tên thì đổi tên kéo slug theo
   (máy chủ giữ slug cũ trong `post_slugs` để link cũ vẫn tới). Slug đặt tay
   giữ nguyên. Bài đã đăng mà chưa có slug (đang dùng địa chỉ theo ngày) **không**
   tự đổi — không có gì chuyển hướng từ địa chỉ theo ngày — chỉ đổi khi bấm
   "Lấy theo tên" hoặc gõ tay.
6. `toSlug` / `uniqueSlug` riêng trong `PortEditors.tsx` thay bằng `titleSlug` /
   `freeSlug` dùng chung.

## Bảng, cột, endpoint

- Ghi: `posts.en` (hoặc `post_drafts.data.en` với bài đã đăng), `posts.slug`,
  `post_slugs` — qua `PATCH /api/posts/:id` và `POST /api/posts/:id/status`
  (có sẵn, không đổi backend, không SQL).

## Kiểm

- `usePostAddresses.test.ts`: slug theo tên lúc đăng, tránh chỗ trùng.
- Harness `cms-harness.html?screen=edit`: đổi tên trong ngăn thì tiêu đề trên
  trang đổi theo; gõ "Đường Sữa đá" vào Slug lưu thành `duong-sua-da`.
