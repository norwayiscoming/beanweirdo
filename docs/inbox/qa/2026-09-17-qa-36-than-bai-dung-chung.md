# QA-36: memo và bitesize thôi giữ hai bản y hệt của cùng một mặt soạn

PR: chưa mở    nhánh: `hotfix/template-len-kho-element`
Cắt từ: `origin/main` @ 084bbbc — **không** stack lên `hotfix/trinh-soan-giu-dinh-dang` (PR #106).

Nguồn: chủ site, 17/09 — *"bạn có ứng dụng nó cho tất cả các template không?
sao không design nó thành OOP system plugin hay gì để sau các template cứ đăng
ký các module thôi? nhiều cái đã sửa rồi mà các template khác không ăn, cứ phải
sửa từng template thế à?"*

Bước một của câu trả lời. Bước hai — đưa cards, article, longform lên kho
element — chưa làm, xem mục cuối.

## Đo được gì trước khi sửa

Kho element **đã có**: `packages/post-renderer/src/elements/registry.ts`, với
`registerElement` · `getElement` · `allElements` · `findElements`, và mười khối
đã khai: `paragraph` `heading` `meta` `quote` `callout` `list` `metrics`
`chart` `table` `image`. Khuôn đúng như chủ site duyệt 02/09.

Nhưng chỉ một nửa số template đứng trên nó:

| Template | Đọc kho element | Mặt soạn sống (`LiveText`) |
|---|---|---|
| report | ✓ | ✓ |
| memo | ✓ | ✓ |
| bitesize | ✓ | ✓ |
| cards | ✗ | ✗ |
| article | ✗ | ✗ |
| longform | ✗ | ✗ |

Và trong ba cái đã lên, memo với bitesize mỗi bên giữ **một bản y hệt** của
cùng 108 dòng `wrapElement` + `renderAfterElements`. Chỉ khác tên hàm ghi
(`write` với `writeElements`) và mức thụt lề.

## Đã sửa

### [SỬA LỖI] Gộp hai bản trùng khít thành một `useElementBody`

`frontend/src/admin/screens/Editor.tsx`, hàm `useElementBody`. Nhận
`{ elements, write, palette }`, trả `{ wrapElement, renderAfterElements }` để
cắm thẳng vào `PostRenderer`.

`BitesizeEditor` và `MemoEditor` nay gọi nó; không màn nào giữ bản riêng nữa —
`grep -c "wrapElement={(_drawn, i) => {"` trên `Editor.tsx` trả về **0**.

Gọi là [SỬA LỖI] chứ không phải [ĐỔI HÀNH VI]: hai bản vốn đã giống nhau từng
dòng, nên gộp lại không đổi gì trên màn hình. Cái đổi là từ nay sửa một chỗ thì
cả hai cùng ăn.

`Editor.tsx`: 3.469 → 3.383 dòng.

### Vì sao `report` không gộp vào

Thân bài report nằm trong lưới hai cột, có cột ghi chú neo theo `id` khối, có
kéo–thả với vạch rơi (`dragFrom` · `dragOver` · `requestRemove`). Đó là khác
biệt thật chứ không phải trùng lặp: gộp vào sẽ phải mang cả hai đường trong một
hàm và thêm cờ để chọn đường — để riêng thì trung thực hơn.

Ghi lại ở đây để lần sau không ai tưởng là bỏ sót.

## Đụng dữ liệu

Không đụng bảng, cột hay endpoint nào. Không có migration. Không đổi hình dạng
`posts.body`.

## Đụng luật

Không luật nào trong `logic.ts` nói về cách tổ chức mã màn soạn. Không mâu
thuẫn luật nào.

## Kiểm chứng

- `npm test`: **122 file, 1242 test xanh**.
- `npm run build --prefix frontend`: xanh.
- Không thêm test mới: đây là gộp mã, và bộ test hiện có của memo với bitesize
  (`Editor.templates.test.tsx`, `Editor.structure.test.tsx`,
  `Editor.mount.test.tsx`) chính là lưới hứng. Thêm test cho `useElementBody`
  sẽ là kiểm lại đúng thứ chúng đã kiểm.
- **Chưa mở trình duyệt xem.**

## Chỗ test không chứng minh được

Thứ tự `useState` bên trong một hook dùng chung. Hai màn gọi cùng một hook nên
chúng có cùng số ô nhớ; nếu về sau ai đó gọi nó **có điều kiện** thì React sẽ
lệch ô, và không test nào ở đây bắt được.

## Còn nợ — bước hai, chưa bắt đầu

Đưa cards, article, longform lên kho element. Việc này **nằm trong lane Kiến
trúc** (`packages/post-renderer`), chủ site đã cho phép lane QA làm — ghi ở đây
để lane Kiến trúc biết mà không tưởng là có người lấn.

Mỗi template cần: renderer nhận `wrapElement`, một bộ chuyển hình dạng cũ sang
`elements` ở `postToRenderer.ts` (lối memo đã đi: `elements` có thì dùng, không
thì đọc hình dạng cũ), rồi màn soạn gọi `useElementBody`.

- **cards** — thân mỗi thẻ là `parts: CardPart[]` (`method` · `detail` ·
  `callout`). `method.body` → `paragraph`, `detail.rows` → `table`,
  `callout.lines` → `callout`. Ước ~2h.
- **article** — `sections: SectionData[]`; mấy ô cố định (plate, pull, related)
  không phải element và ở nguyên. Ước ~2h.
- **longform** — chỗ khó thật: nó lưu chữ theo `{t, w, s}`
  (`longformText.ts`) còn kho dùng `{t, em, u}` (`elements/runs.ts`). Hai từ
  vựng rời nhau, phải dịch chứ không chỉ nối. Ước ~3h.

## Đề xuất luật

25. Hai màn làm cùng một việc thì dùng cùng một đoạn mã, hoặc phải nói ra được
    chúng khác nhau chỗ nào. Bản sao thứ hai không sai lúc chép; nó sai ở lần
    sửa sau, khi chỉ một trong hai được sửa.
