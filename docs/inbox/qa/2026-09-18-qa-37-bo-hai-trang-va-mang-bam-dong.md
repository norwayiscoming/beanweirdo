# QA-37: bỏ hai trang quản trị, và máng `+` bám theo dòng

PR: chưa mở    nhánh: `hotfix/mang-bam-con-tro`
Cắt từ: `origin/main` @ `03f181d`

Hai việc chủ site giao trong cùng một lượt, đi chung một nhánh vì cùng chạm
`Editor.tsx` và `Sidebar.tsx`.

## Đã sửa

### [ĐỔI HÀNH VI] Máng `+` bám theo dòng con trỏ đang ở

Chủ site: *"cái [+] ấy tôi muốn nó đi theo con trỏ chuột chứ giờ cái button [+]
chỉ hiển thị ở hàng bên trên thôi"*.

`.awc-gutter` xưa nay `position: absolute; top: 0` — ghim vào đỉnh
`.awc-rep-block`. Hồi mỗi khối là một dòng thì đỉnh khối cũng là đỉnh dòng, nên
không lộ. Từ khi mấy khối chữ liền nhau gộp vào một ô (`flow.ts`), một dải dài
mấy chục dòng vẫn chỉ có một cái máng nằm ở dòng đầu.

`LiveRun` trong `Editor.tsx` đo `getBoundingClientRect()` của **từng dòng** trong
`.awc-live-input` rồi dời máng xuống dòng con trỏ đang ở. Đo theo hình chữ nhật
thật chứ không chia đều chiều cao: tiêu đề, đoạn văn và danh sách cao khác nhau.

### [ĐỔI HÀNH VI] Chèn vào ngay dưới dòng đang trỏ

Trước: mọi lần chèn đều rơi vào cuối dải (`run.at[1] + 1`).
Sau: `run.at[0] + line + 1` — ngay dưới dòng con trỏ. Dải chữ và element trong
kho khớp nhau một-một theo thứ tự nên chỉ số dòng chính là chỉ số element.

### [ĐỔI HÀNH VI] Máng đậm lên

28px thay 26px, cỡ chữ 18 thay 15, màu `#5C5647` thay `#8C8674`, thêm viền khi
rê chuột.

### [ĐỔI HÀNH VI] `Content management` vào thẳng `/ad-post`

`Sidebar.go` gọi `nav.goCms` không tham số, nên nó dừng ở `/ad` — một địa chỉ
gọi tên màn mà không gọi tên tab. Nay gọi `nav.goCms('posts')`.

### [ĐỔI HÀNH VI] Xoá hẳn hai trang `/ad-design-system` và `/ad-template`

Chủ site: *"xoá trang ... đi không cần route tới trang này và tree cũng không
cần show cái này nữa ... build xong và có skeleton cũng như file markdowns rồi
thì không cần hiển thị UI lên nữa"*.

Xoá `frontend/src/screens/DesignSystem.tsx` (289 dòng) và
`frontend/src/screens/Templates.tsx` (214 dòng), cùng mọi thứ trỏ tới chúng:
mục trong `navItems.ts`, `adminPages`/`screenPage`/nhánh `templateId` trong
`routes.ts`, `goArt`/`goTemplates`/`openTemplate`/`templateId` trong `nav.tsx`
và `App.tsx`, hai `case` trong `Sidebar.go`, mẩu bánh mì trong `crumbs.ts`, hai
màn trong `AREA_SCREENS`, hai từ `adDesignSystem`/`adTemplate` trong
`routeWords.ts` và danh sách khoá của `RoutesPanel`.

**Đo trước khi xoá, vì `Templates` không phải trang luật:** nó vẽ bài mẫu thật
bằng `PostRenderer`, và bảng `templates` trong cơ sở dữ liệu **có dữ liệu**
(Article, Long-form, Info cards…). Nhưng luồng **tạo bài từ mẫu** không đi qua
màn ấy — nó nằm ở ô `<select aria-label="Template">` trong
`admin/screens/MetadataStep.tsx`. Nên xoá màn này mất phòng trưng bày, không
mất đường dùng bài mẫu.

`listTemplates()` trong `Cms.tsx` chỉ nuôi đúng một dòng của sơ đồ trang
(`childrenOf`), nên nó đi theo luôn.

## Đụng dữ liệu

Không đụng bảng, cột hay endpoint nào. Không migration.

Bảng `templates` **vẫn còn nguyên và vẫn được dùng** — `MetadataStep` đọc nó.
Endpoint `GET /rest/v1/templates` nay không còn ai gọi từ màn `Cms`.

Bộ từ đã lưu của chủ site có thể còn hai khoá `adDesignSystem` và `adTemplate`;
`resolveWords` chỉ lấy những khoá có trong `DEFAULT_WORDS` nên khoá thừa bị bỏ
qua, không cần dọn dữ liệu.

## Đụng luật

**Mâu thuẫn, nói thẳng.** Hai luật nhóm **09** trong `logic.ts` nhắc tên
`Templates`:

1. *"Với bài mẫu trong [[secAdmin]]: được tự do chọn màu, vì nó chỉ là khung để
   dựng."* — vẫn đúng: bài mẫu còn, chỉ màn xem không còn.
2. *"Với đường dẫn: bài chính thức đi từ [[landing]] › [[home]] › module, bài
   mẫu đi từ [[secAdmin]] › Templates."* — **nay sai**: không còn đường
   `secAdmin › Templates`.

Lane Tài liệu sửa giúp luật số 2. Tôi không sửa `logic.ts`.

## Kiểm chứng

- `npm test`: **124 file, 1240 test xanh** (giảm 13 test: xoá những test đo đúng
  hai màn vừa bỏ — `area.test.ts`, `crumbs.origin.test.ts`,
  `crumbs.reach.test.ts`, `routes.test.ts`, `prose.test.ts`).
- `npm run build --prefix frontend`: xanh.
- **Chưa mở trình duyệt xem.**

## Chỗ không làm được

**`/undefined`.** Chủ site báo có một link tới `https://beanweirdo.vercel.app/undefined`.
Tôi dò hết mọi chỗ dựng địa chỉ — `toPath` (mọi nhánh đều có bản dự phòng),
`goToArea`, `useRoute.go`, `RoutesPanel.BLOCKS`, cả hai chỗ `href=` còn lại
trong frontend — **không chỗ nào sinh ra được chuỗi ấy** trên `main` hiện tại.

Hai khả năng còn lại, cần chủ site chỉ chỗ bấm mới phân biệt được: hoặc nó đến
từ bản build cũ mà trang phục vụ suốt một tuần (deploy frontend hỏng từ
`084bbbc` tới `f27a6bc`), hoặc nó nằm ở một đường tôi chưa nghĩ ra.

## Chỗ test không chứng minh được

**Máng có bám đúng dòng không.** `LiveRun` đo `getBoundingClientRect()`, thứ
jsdom luôn trả về số không. Đo được ở đây chỉ là component dựng ra không nổ;
việc nó đứng đúng chỗ phải nhìn bằng mắt.
