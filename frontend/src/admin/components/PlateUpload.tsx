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

export type PlateUploadProps = {
  /** Đang có gì trong ô — quyết định nút xoá có mặt hay không. */
  imageUrl: string | null
  onPick: (file: File) => void | Promise<void>
  /** Gỡ ảnh ra khỏi ô. Vắng thì ô này không gỡ được (ảnh bìa dùng hàng riêng). */
  onClear?: () => void
  /** Ô ảnh của bitesize nhận cả clip; mọi ô khác chỉ nhận ảnh. */
  accept?: string
  label?: string
}

export function PlateUpload({
  imageUrl,
  onPick,
  onClear,
  accept = 'image/*',
  label = 'tải ảnh lên',
}: PlateUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function take(file: File) {
    setBusy(true)
    try {
      await onPick(file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
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
}: {
  imageUrl: string | null
  onUrl: (url: string) => void
  onClear?: () => void
}) {
  return (
    <PlateUpload
      imageUrl={imageUrl}
      onPick={async (file) => {
        const { url } = await uploadImage(file)
        onUrl(url)
      }}
      onClear={onClear}
    />
  )
}
