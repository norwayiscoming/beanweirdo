# QA: article — khuôn cuối còn lệch, nay dùng chung bộ soạn thảo

PR: chưa mở    nhánh: `hotfix/article-chuan-chung`
Cắt từ: `origin/main` @ 03f181d — không stack lên nhánh nào.

Nguồn: chủ site, 18/09 — *"check article đi nó đang theo khối đấy nó cứ thêm
phần ấy trong khi tôi muốn nó thành dạng markdown hết như long form cơ mà?"*

Tiếp nối 108989c (long-form vào kho element). Article là khuôn thứ sáu và là
khuôn cuối còn giữ đường riêng.

## Đo được gì trước khi sửa

`frontend/src/admin/screens/Editor.tsx`, hàm `ArticleEditor`:

| Chỗ | Trước lượt này |
|---|---|
| `renderAfterSections` | `<AddRow label="phần" …>` — một nút, chỉ thêm được vào cuối, chỉ thêm được một `section` rỗng |
| máng `+` ở dải chữ | không có |
| `plus` trên `RowShell` | không truyền |

Năm khuôn kia (`report` · `memo` · `bitesize` · `cards` qua `useElementBody`,
`longform` qua `LongformEditor`) đều đã là `InsertPlus` + `blankReportBlock`.
Article là cái duy nhất còn `AddRow`.

`packages/post-renderer/src/Article.tsx` vẽ mỗi phần tử của `post.sections`
bằng đúng một khuôn: `h3` cho `s.h`, một `div` cho `s.p`, khung ảnh cho `s.fig`.
Một khối lấy từ kho (`{type: 'table', …}`) đi qua chỗ ấy thì vẽ ra một `h3`
rỗng và một `div` rỗng — nghĩa là mất hẳn khỏi trang.

`frontend/src/admin/lib/articleFlow.ts`, `flowsSection` trả `true` cho mọi
phần tử không có `fig` — kể cả khối của kho. Gộp vào dải chữ thì
`runToMarkdown` viết nó thành chuỗi rỗng, và `writeSectionRun` ghi ngược lại
là xoá nó.

## Đã sửa

### [ĐỔI HÀNH VI] `sections` chứa được khối của kho, và trang vẽ ra

`packages/post-renderer/src/Article.tsx`: thêm `isStoredElement` (nhận ra khối
của kho bằng khoá `type`), và trong vòng lặp `post.sections.map` thì phần tử
nào là khối của kho sẽ vẽ bằng `<ElementList elements={[s]} palette={palette}
mobile={mobile} />` thay cho khuôn `h3`/`p`/`fig`.

`palette` lấy `paletteFrom(post.band?.bg ?? garden.leaf, post.band?.fg)` — cùng
màu nền dải đầu trang mà chính file này đã dùng ở khối `background`.

- Trước: `body` của article chỉ nhận `{h, p, fig?}`; thứ khác vẽ ra hai ô rỗng.
- Sau: `{h, p, fig?}` và khối của kho cùng đi được trong một `body`, y như
  long-form từ 108989c.

Cách lưu **không** đổi: vẫn là một mảng JSON trong `posts.body`, không migration,
không cột mới. Kiểu `SectionData` để nguyên và chỗ chèn dùng ép kiểu — đúng lối
108989c đã đi với `LongformBlock`.

### [ĐỔI HÀNH VI] `flowsSection` loại khối của kho ra khỏi dải chữ

`frontend/src/admin/lib/articleFlow.ts`: thêm `isStoredElement`, và
`flowsSection` nay là `s !== undefined && !s.fig && !isStoredElement(s)`.

- Trước: khối của kho bị gộp vào dải markdown, và lần ghi kế tiếp xoá nó.
- Sau: nó đứng riêng như `fig` — `toSectionRuns` trả về `{kind: 'thing'}`.

### [ĐỔI HÀNH VI] `+ PHẦN` thành cái máng `+` dùng chung

`frontend/src/admin/screens/Editor.tsx`, hàm `ArticleEditor`: bỏ `AddRow`, thêm
hàm `insertPlus(at, insertAtIndex)` dựng `InsertPlus` và chèn
`blankReportBlock(t)`. Cắm vào ba chỗ, đúng ba chỗ `useElementBody` và
`LongformEditor` đang cắm:

1. máng trái của dải chữ — chèn ngay sau dải (`run.at[1] + 1`);
2. `plus` của `RowShell` — chèn ngay sau khối đang trỏ (`i + 1`);
3. `renderAfterSections` — máng ở chân bài, `opacity: 1`.

- Trước: một nút `+ PHẦN`, chỉ thêm `{h: '', p: ''}` vào cuối.
- Sau: menu `+` của kho (`mode="things"`), chèn được vào giữa bài.

`AddRow` vẫn còn trong `RowShell.tsx` — `CardsEditor` dùng nó cho `+ thẻ`.

### [SỬA LỖI] `RowShell` gọi đúng tên thứ sắp xoá

Cùng hàm: `noun={isStoredElement(sections[i]) ? 'khối' : 'phần'}`. Trước đây mọi
hàng đều xưng "phần", nên nút xoá một cái bảng vẫn nói "xoá phần".

## Đụng dữ liệu

Không đụng bảng, cột hay endpoint nào. Không migration. Hình dạng `posts.body`
của article **được nới rộng** (nhận thêm khối của kho) chứ không đổi.

**Đính chính một tiền đề.** Người giao việc nói "cơ sở dữ liệu KHÔNG có bài
article nào". Tôi tự đọc lại qua REST (`GET /rest/v1/posts?select=id,en,template,status`):
11 bài, trong đó **có một bài article đang `published`** —
`0a3d2669-8914-42a3-ad91-b70d9ae3c503`, *"AI twin, viết hộ hay shadow
writer."*.

Đọc tiếp `body` của nó: một mảng 8 phần tử, **mọi phần tử đúng hai khoá
`["h","p"]`**, không cái nào có `fig`, không cái nào có `type`. Nên
`isStoredElement` trả `false` cho cả 8, `flowsSection` trả `true` cho cả 8 y
như trước, và cả bài vẫn gộp thành **một** ô markdown. Bản sửa không chạm vào
bài này.

Chỉ đọc, không ghi. Bảng `posts`, cột `id` · `en` · `template` · `status` ·
`body`. Endpoint: `GET /rest/v1/posts`.

## Đụng luật

`frontend/src/content/logic.ts`:

- **10.2** — *"Với [[article]]: ảnh phụ thả trôi trong thân bài, không dồn
  xuống chân bài."* Bản sửa đi cùng chiều: `image` của kho nay chèn được vào
  giữa thân bài chứ không chỉ nối vào cuối.
- **09** — *"Ngoài hai điều đó, một template được trình bày khác hẳn mọi
  template còn lại."* Không mâu thuẫn: chỗ đổi là **mặt soạn**, không phải cách
  trang in ra. Article vẫn vẽ `{h, p, fig}` bằng khuôn riêng của nó.

Không luật nào nói về menu `+` hay về kho element.

## Kiểm chứng

- `npm test`: **124 file, 1252 xanh, 2 skipped**.
- `npm run build --prefix frontend`: xanh.
- Thêm **một** test: `packages/post-renderer/src/Article.test.tsx`, *"draws a
  store element sitting in the body beside ordinary sections"*. Nó kiểm đúng
  cái mới — một `{type: 'table'}` nằm trong `sections` thì chữ trong bảng hiện
  ra. Không thêm test nào cho phần gộp mã của `ArticleEditor`: bộ test sẵn có
  (`Editor.templates.test.tsx`, `Editor.flow.test.tsx`,
  `Editor.structure.test.tsx`) là lưới hứng cho chỗ ấy.
- Không xoá test nào: rà cả `frontend/src` và `packages` thì không test nào mô
  tả nút `+ PHẦN` cũ.
- **Chưa mở trình duyệt xem.** `/practice` sau cổng đăng nhập, và lane này
  không tự gõ mật khẩu.

## Chỗ test không chứng minh được

1. **Bảng và biểu đồ chèn vào article chưa sửa được tại chỗ.** `RowShell` bọc
   bản vẽ của `ElementList` — là bản đọc, không có ô nhập. Đây **không phải
   thứ lượt này làm hỏng**: `LongformEditor` cũng vậy kể từ 108989c
   (`wrapBlock` trả `{drawn}` trong `RowShell`). Bốn khuôn dùng
   `useElementBody` thì có `ReportBlockFields`. Nếu chủ site muốn sửa được
   ngay trên article thì đó là một việc riêng, và nên làm cho cả article lẫn
   long-form một lượt.
2. **Bề ngang máng `+` trong cột article.** `.awc-rep-block` thụt trái 122px;
   cột thân bài của article là `2.1fr` của một lưới hai cột, hẹp hơn cột của
   report. Dải chữ đã dùng `awc-rep-block` từ trước nên bề ngang không đổi,
   nhưng phải nhìn mới biết có chật không.
3. **`isStoredElement` nhận diện bằng khoá `type`.** Nếu về sau ai thêm `type`
   vào chính `SectionData` thì mọi section sẽ bị coi là khối của kho. Chọn
   `type` chứ không chọn "không có `h` và không có `p`" vì cách sau nuốt luôn
   một section vừa tạo mà chưa gõ chữ nào.

## Lệch lane

`packages/post-renderer/src/Article.tsx` và `Article.test.tsx` thuộc lane Kiến
trúc. Người giao việc chỉ định đụng vào, cùng lý do và cùng cách 108989c đã đụng
`Longform.tsx`. Ghi ở đây để lane Kiến trúc biết mà không tưởng là có người lấn.

Không đụng `docs/SPEC.html` và `frontend/src/content/logic.ts`.

## Đề xuất luật

26. Một khối của kho phải sửa được ở **mọi** khuôn bài nhận nó vào. Vẽ ra mà
    không gõ lại được là nửa đường: người viết chèn được một cái bảng rồi không
    điền được vào nó.
