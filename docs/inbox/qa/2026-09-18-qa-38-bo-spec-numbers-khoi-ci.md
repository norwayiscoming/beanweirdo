# QA-38: bỏ `spec-numbers` khỏi CI

PR: chưa mở    nhánh: `hotfix/spec-so-migration`
Cắt từ: `origin/main`

## [ĐỔI HÀNH VI] CI thôi chạy `node tools/spec-numbers.mjs --check`

Chủ site: *"xoá cái test đó khỏi CI flow luôn, sao CI flow phải có cái này"*.

Bỏ bước ấy khỏi `.github/workflows/test.yml`. CI nay còn đúng `npm ci` và
`npm test` (typecheck ba project + toàn bộ vitest).

**Công cụ vẫn còn** ở `tools/spec-numbers.mjs` và chạy tay được:

```
node tools/spec-numbers.mjs           # in số thật
node tools/spec-numbers.mjs --check   # thoát 1 nếu SPEC.html ghi khác
```

## Hệ quả, nói thẳng

Bước này sinh ra có lý do, ghi ngay trong file CI: *"SPEC quotes figures that go
stale the moment a file is added. The docs lane reported the same two wrong
numbers three times before this ran here; now the count fails the build instead
of a person."*

Bỏ nó đi nghĩa là **con số lệch trong SPEC không còn ai chặn**. Ngay lúc này đã
có một chỗ lệch chưa sửa:

```
SPEC.html lệch:
  migration: SPEC ghi 23, thật là 26
```

Tôi đã sửa thử `docs/SPEC.html:202` (`23` → `26`) và `--check` in `SPEC.html
khớp.`, nhưng **đã revert**: file ấy thuộc lane Tài liệu, và chủ site chọn bỏ
bước kiểm chứ không chọn sửa số. Lane Tài liệu quyết có sửa hay không.

Đổi lại, cái được là thật: CI đỏ liên tục làm hỏng chính thứ nó bảo vệ — khi
mọi lần chạy đều đỏ thì một lần đỏ **thật** không ai nhận ra. Deploy frontend
chết một tuần (`084bbbc` → `f27a6bc`) mà không ai thấy là ví dụ đã xảy ra. Từ
nay CI đỏ nghĩa là test đỏ.

## Không đụng

- `docs/SPEC.html` — trả về nguyên trạng, vẫn ghi 23.
- Hai số hiệu migration trùng `0017`, `0018` — vốn đã nằm trong danh sách cho
  qua của công cụ, không phải nguyên nhân đỏ.

## Đụng dữ liệu

Không. Không migration, không bảng, không endpoint.

## Đụng luật

Không luật nào trong `logic.ts` nói về CI.
