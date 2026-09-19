/**
 * Nút tải ảnh nằm ở góc một ô ảnh cố định của khuôn bài.
 *
 * Trước đây mọi ảnh của một bài đi qua một hàng chữ ở đầu khung sửa: "ảnh bìa:
 * tải ảnh lên – đặt link – xoá". Một hàng, cho một ô. Những ô ảnh còn lại —
 * cặp ô mở đầu của article, ô vuông ở cột phải, khung ảnh của long-form — thì
 * không có hàng nào cả, nên trên trang chúng đứng mãi ở chữ "chưa có ảnh".
 *
 * Nút đi theo ô. Nhìn thấy ô nào thì bấm vào đúng góc ô ấy, không phải đối
 * chiếu một cái nhãn ở trên đầu với một mảng màu ở giữa trang.
 *
 * Chỉ có mặt trong màn sửa: khuôn bài nhận nó qua `renderPlateAction`, và trang
 * công khai không truyền gì nên không vẽ gì.
 */
import { useRef, useState } from 'react'
import { IconButton } from '../../design/Button'
import { IconTrash, IconUpload } from '../../design/icons'
import { uploadImage } from '../lib/apiClient'
import { useFraming } from './framing'

export type PlateUploadProps = {
  /** Đang có gì trong ô — quyết định nút xoá có mặt hay không. */
  imageUrl: string | null
  /** `ratio` là hình dạng thật của ô, đo lúc bấm; vắng khi không đo được. */
  onPick: (file: File, ratio: number | null) => void | Promise<void>
  /** Gỡ ảnh ra khỏi ô. Vắng thì ô này không gỡ được (ảnh bìa dùng hàng riêng). */
  onClear?: () => void
  /** Ô ảnh của bitesize nhận cả clip; mọi ô khác chỉ nhận ảnh. */
  accept?: string
  label?: string
}

/**
 * Hình dạng thật của ô ảnh chứa nút này, đo từ trang chứ không tra bảng.
 *
 * Mỗi ô ảnh cố định là mốc toạ độ của chính nó (`plateHost`, hoặc sẵn
 * `absolute` như hero của article), nên `offsetParent` của cái góc chính là ô
 * ảnh. Đo như vậy thì thêm một template hay đổi dàn trang một template đã có
 * không kéo theo một bảng tỉ lệ phải giữ cho khớp — và khung cắt luôn đúng
 * bằng ô mà người dùng đang nhìn.
 */
function cellRatio(node: HTMLElement | null): number | null {
  const corner = node?.closest('[data-plate-corner]')
  const cell = corner instanceof HTMLElement ? corner.offsetParent : null
  if (!(cell instanceof HTMLElement)) return null
  const box = cell.getBoundingClientRect()
  if (box.width < 1 || box.height < 1) return null
  return box.width / box.height
}

export function PlateUpload({
  imageUrl,
  onPick,
  onClear,
  accept = 'image/*',
  label = 'tải ảnh lên',
}: PlateUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  async function take(file: File) {
    // Đo trước khi đợi tải lên: lúc tải xong ô vẫn còn đó, nhưng đo sớm thì
    // không phụ thuộc vào việc dàn trang có đổi trong lúc chờ hay không.
    const ratio = cellRatio(wrapRef.current)
    setBusy(true)
    try {
      await onPick(file, ratio)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', gap: 6 }}>
      {/*
        `secondary` chứ không phải `ghost`: nút này nằm trên ảnh chứ không nằm
        trên giấy, nên nó cần nền đặc và viền đậm hơn mới đọc được trên một tấm
        ảnh sáng. Hình dạng vẫn là hình dạng chung — cùng bán kính bo, cùng độ
        dày viền, cùng bộ icon.
      */}
      <IconButton
        level="secondary"
        size="sm"
        label={busy ? 'đang tải…' : label}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <IconUpload size={14} />
      </IconButton>
      {imageUrl && onClear && (
        <IconButton level="danger" size="sm" label="gỡ ảnh khỏi ô này" onClick={onClear}>
          <IconTrash size={14} />
        </IconButton>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Xoá trước khi dùng: chọn lại đúng tệp vừa chọn thì `change` không
          // bắn nữa nếu giá trị cũ còn nguyên.
          e.target.value = ''
          if (file) void take(file)
        }}
      />
    </div>
  )
}

/**
 * Nút tải ảnh tự đẩy tệp lên rồi trả về địa chỉ — dùng cho mọi ô ảnh cố định
 * trừ ảnh bìa.
 *
 * Ảnh bìa đi đường riêng (`setHero` trong `Editor`) vì nó còn phải đo khung
 * hình, lấy poster cho clip và đặt lại khung cắt; những ô còn lại chỉ cần một
 * địa chỉ.
 */
export function PlateImageUpload({
  imageUrl,
  onUrl,
  onClear,
  name = 'ô ảnh của khuôn bài',
}: {
  imageUrl: string | null
  onUrl: (url: string) => void
  onClear?: () => void
  /** Ô nào — hiện trên đầu khung cắt để biết đang căn cho chỗ nào. */
  name?: string
}) {
  const frame = useFraming()
  return (
    <PlateUpload
      imageUrl={imageUrl}
      onPick={async (file, ratio) => {
        const { url } = await uploadImage(file)
        /*
         * Không đo được ô thì vẫn phải mở khung cắt, chỉ là lấy tỉ lệ ô ảnh
         * hay gặp nhất làm khung: tải ảnh lên chỗ nào cũng ra cùng một hộp
         * thoại là điều chủ site chốt, nên bỏ qua bước căn vì một phép đo hụt
         * là đúng cái lệch ấy quay lại.
         */
        onUrl(await frame({ url, name, ratio: ratio ?? 1.5 }))
      }}
      onClear={onClear}
    />
  )
}
