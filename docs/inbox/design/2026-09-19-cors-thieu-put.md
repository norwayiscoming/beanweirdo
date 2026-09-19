# CORS thiếu `PUT`: hai endpoint đổi thứ tự chết hẳn trên trình duyệt

- Nhánh: `claude/project-thread-r3z436`
- PR: (điền khi mở)
- Lane: Thiết kế (nút/toast/icon khu quản trị) — chạm `backend/lib/cors.ts`, xem
  mục cuối.

Chủ site mở DevTools trên `/ad-config`, kéo một module, rồi báo: *"response đang
không có nhé. đang bị lỗi cors gì ấy."*

## [SỬA LỖI] `Access-Control-Allow-Methods` không liệt kê `PUT`

`backend/lib/cors.ts`, hàm `applyCorsHeaders`. Chuỗi cũ:

```
'GET, POST, PATCH, DELETE, OPTIONS'
```

`frontend/src/admin/lib/apiClient.ts` gửi **PUT** ở đúng hai chỗ:
`reorderPosts` (`PUT /api/posts`) và `reorderModules` (`PUT /api/modules`).

Khu quản trị và API là hai deployment khác nhau nên **mọi** lời gọi đều
cross-origin, và `request` luôn đính `Authorization`, thứ không nằm trong danh
sách an toàn của CORS — nên trình duyệt preflight cả những lời gọi tầm thường.
Preflight trả về một danh sách không có `PUT`, nên hai request ấy **không bao
giờ rời khỏi máy**.

Vì sao im lặng đến thế:

1. Máy chủ không thấy gì — request chưa từng tới.
2. `apiClient` không nhận được response, chỉ nhận một `TypeError` của `fetch`.
3. `dropModule` trong `Cms.tsx` **đã** vẽ thứ tự mới theo kiểu lạc quan trước
   khi gọi API. Nên màn hình đổi, toast lỗi có bật nhưng dễ bỏ qua, và tải lại
   trang là về chỗ cũ.

Đây là **nguyên nhân gốc** của bản báo lỗi "kéo đổi thứ tự không ăn". Hai bản
sửa trước đó (PR #23) sửa hai lỗi thật khác — thanh bên không hỏi lại, và CMS
xếp khác site — nhưng cả hai đều nằm **sau** chỗ tắc này, nên một mình chúng
không đủ.

`reorderPosts` cũng chết theo, tuy chưa ai báo: kéo đổi thứ tự **bài trong một
module** cũng không lưu được.

Nay danh sách là hằng `ALLOWED_METHODS` xuất từ `cors.ts`, có thêm `PUT`.

## [SỬA LỖI] Test chốt: method nào apiClient gửi thì CORS phải cho phép

`frontend/src/admin/lib/apiClient.methods.test.ts`.

Nó **đọc mã nguồn `apiClient.ts`**, gom mọi `method: '…'` bằng regex, rồi buộc
từng cái phải có trong `ALLOWED_METHODS`. Không so hai danh sách viết tay: hai
danh sách viết tay lệch nhau chính là lỗi này.

Kèm một bài chốt cho chính cái regex — nếu nó trượt (ai đó đổi cách viết
request) thì `used` rỗng và các bài kia đỗ vống, nên bài ấy kiểm `used` có ít
nhất bốn phần tử và có `PUT`.

## Về cache preflight: chủ site có thể còn thấy lỗi sau khi deploy

`Access-Control-Max-Age` đang là `86400`. Preflight cũ (cái **không** có `PUT`)
trả 204 nên là một câu trả lời hợp lệ, và trình duyệt **có** cache nó — Chrome
chặn trần ở 2 tiếng.

Nghĩa là deploy xong, trên chính trình duyệt đã dính lỗi, `PUT` có thể vẫn bị
chặn tới hai tiếng. Cách qua ngay: mở DevTools › Network › tick **Disable
cache** rồi tải lại, hoặc thử ở cửa sổ ẩn danh.

Không hạ `Max-Age` xuống vì việc này: con số ấy tiết kiệm một round trip cho
**mọi** lời gọi quản trị, và đây là lần đầu danh sách method đổi kể từ khi nó
được đặt.

## Bảng, cột và endpoint đã đụng

- Không đụng bảng hay cột nào.
- `PUT /api/modules` và `PUT /api/posts` — **không sửa handler**, chỉ sửa header
  CORS đứng trước chúng. Mọi route đều bọc `withCors` nên một chỗ sửa là đủ.

## Đối chiếu ngược với bộ luật

`frontend/src/content/logic.ts`: không luật nào nói về CORS hay tầng vận
chuyển. Không mâu thuẫn.

## Kiểm

- `npm test`: 136 tệp, 1379 bài xanh, 2 bỏ qua.
- **Không đỗ vống**: bỏ `'PUT'` khỏi `ALLOWED_METHODS` thì bài
  `PUT nằm trong Access-Control-Allow-Methods` đỏ — tức là test tái hiện đúng
  lỗi gốc, rồi xanh lại khi vá.

## Ranh giới lane

`backend/lib/cors.ts` không thuộc lane Thiết kế. Sửa vì nó là gốc của chính bản
báo lỗi mà lane này đang cầm, và bản sửa chỉ là thêm một verb vào một danh sách.
Lane Kiến trúc và lane QA đọc mục này để biết.

## Chưa ai nhìn tận mắt

Chỉ chủ site kiểm được trên site thật: kéo một module xong, xem tab Network có
còn báo CORS không, và **tải lại trang** để chắc thứ tự đã lưu thật chứ không
phải chỉ hiện lạc quan. Nhớ tick Disable cache ở lượt thử đầu.

## Đề xuất luật

Không có.
