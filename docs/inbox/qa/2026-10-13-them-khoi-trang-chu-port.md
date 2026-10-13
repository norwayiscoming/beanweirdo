# Trang chủ port: nút "+ Thêm khối"

Nhánh `claude/port-home-add-block-1y0dlh` · PR mở ngày 2026-10-13 (số PR ở tiêu đề PR).

Chủ site (2026-10-13, ảnh Cấu hình › Port › Trang chủ port): chỉ có hai khối strat & ops và art & culture, không có nút thêm khối thứ ba.

## [ĐỔI HÀNH VI] Thêm khối ngay ở Trang chủ port
- Trước: muốn thêm khối phải sang Mục lục, mở từng trang, bật "Hiện ở trang chủ". Màn Trang chủ port chỉ sửa và xoá (×) khối có sẵn.
- Sau: cuối danh sách khối có nút "+ Thêm khối" (`AddFeature` trong `PortEditors.tsx`). Mở ra chọn một trang port chưa có khối, hoặc "+ Trang mới" (tên + bắt đầu từ mẫu bibi/bibe/trống, giống "Thêm trang" ở Mục lục). Lưu thì thêm một mục vào `home.features`; trang mới tạo bằng `createFromPreset` như Mục lục (`newPortPage` trong `ConfigTree.tsx`), vẫn là nháp.
- × vẫn chỉ bỏ khối khỏi trang chủ (tắt "Hiện ở trang chủ"), không xoá trang.
- Nhãn trên danh sách đổi thành "Khối trên trang chủ · mỗi khối là một trang port, kéo để đổi thứ tự".

## [ĐỔI HÀNH VI] Khối của trang nháp vẫn giữ trong admin
- Trước: `ContentTab` lọc `home.features` theo trang đã đăng, nên khối của trang nháp biến mất khỏi admin và bị xoá khỏi danh sách ở lần lưu kế tiếp.
- Sau: lọc theo trang chưa lưu trữ; khối của trang nháp hiện kèm chữ "nháp · hiện khi trang được đăng". Trang công khai không đổi: `homeCards` trong `portfolio/data.ts` vẫn bỏ qua trang chưa đăng.

## Đã rà, không đổi
- Trang chủ blog không có danh sách khối tương đương (chỉ có công tắc "Hiện ở trang chủ" trên từng mục, `NavFlags`), nên không thêm gì bên blog.
- Lỗi có sẵn, không sửa ở đây: bấm × hết mọi khối thì `home.features` rỗng và trang chủ quay về hiện mọi trang đã đăng (`homeCards`).

## Bảng, cột, endpoint
- `site_settings.data.portfolio.home.features` (ghi, như trước, qua `updateSite`).
- `nodes` (tạo trang port mới qua `createNode`, như "Thêm trang" ở Mục lục).

## Kiểm tra
- `ConfigTree.test.tsx` (mock thêm `PRESET_CHOICES`). Xem tay trên `frontend/cms-harness.html`: chọn trang có sẵn và tạo trang mới đều ra khối mới.
