/**
 * Ô trang bìa: một băng ngang rộng hết khung sửa, trên đầu mọi template.
 *
 * Ảnh bìa xưa nay đặt qua một hàng chữ ở đầu khung sửa — "ảnh bìa: tải ảnh
 * lên – đặt link – đặt vào khung – xoá" — rồi hàng ấy bỏ đi khi mọi ô ảnh có
 * nút ở góc. Nhưng ô ảnh bìa mà template vẽ thì bé và mỗi khuôn một hình dạng:
 * article là dải dọc rộng 300px bên phải, bitesize là ô ăn theo hình tấm ảnh.
 * Chủ site: *"sao phải cho nó bé tí như kia. cho trang bìa là 1 cái ảnh ngang
 * bài trên đầu ấy?"* — nên chỗ ĐẶT ảnh bìa tách khỏi chỗ ảnh bìa RƠI VÀO.
 *
 * Băng này là chỗ đặt. Nó không phải một phần của trang đã đăng và không đổi
 * dàn trang của trang ấy: ảnh bìa vẫn rơi đúng chỗ template vẽ nó, ngay bên
 * dưới trong cùng khung sửa. Nên trong màn sửa tấm ảnh hiện hai lần — một lần
 * ở đây để đặt, một lần ở dưới vì dưới là trang thật.
 *
 * Hai template không vẽ ô ảnh bìa nào (`cards`, `report`) thì đây là đường
 * DUY NHẤT đặt ảnh bìa cho chúng; trước khi có băng này, bỏ hàng chữ cũ đi là
 * hai khuôn ấy không còn cách nào đặt ảnh bìa cả.
 */
import type { CSSProperties } from 'react'
import { coverStyle } from 'post-renderer'
import { radius } from '../../design/controls'
import { ink, paper, sans } from '../../design/tokens'
import { looksLikeVideo } from '../../lib/mediaShape'
import { PlateUpload } from './PlateUpload'

/**
 * 1200×628 — đúng tỉ lệ tấm ảnh chủ site gửi kèm, và cũng là khung ảnh chia sẻ
 * hay gặp nhất. Một con số chứ không phải chiều cao cố định: khung sửa co giãn
 * theo cửa sổ, mà một băng cao 280px trên màn hẹp thì không còn "ngang" nữa.
 */
const BAND = 1200 / 628

const label: CSSProperties = {
  fontFamily: sans,
  fontSize: 10,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: ink.faint,
  marginBottom: 6,
}

export type CoverBandProps = {
  imageUrl: string | null
  /** `ratio` là hình dạng thật của băng, đo lúc bấm. */
  onPick: (file: File, ratio: number | null) => void
  onLink: (url: string, ratio: number | null) => void
  /** Vắng khi ảnh bìa là clip — khung cắt không vẽ được clip. */
  onReframe?: (ratio: number | null) => void
  onClear: () => void
}

export function CoverBand({ imageUrl, onPick, onLink, onReframe, onClear }: CoverBandProps) {
  const isClip = Boolean(imageUrl && looksLikeVideo(imageUrl))

  return (
    <div style={{ maxWidth: 1320, marginBottom: 18 }}>
      <div style={label}>trang bìa</div>
      <div
        /*
         * Dấu để `PlateUpload` đo được hình dạng băng. Cố ý KHÔNG dùng
         * `data-plate-corner`: dấu ấy là bản kiểm kê ô ảnh cố định của sáu
         * khuôn bài, còn băng này là một hộp của màn sửa.
         */
        data-cover-band=""
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (!file) return
          const box = e.currentTarget.getBoundingClientRect()
          onPick(file, box.height > 0 ? box.width / box.height : null)
        }}
        style={{
          position: 'relative',
          aspectRatio: String(BAND),
          maxHeight: 300,
          borderRadius: radius,
          border: `1px solid ${ink.border}`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          /*
           * Viền liền, không nét đứt: nét đứt là quy ước "chưa thật", mà một ô
           * trống ở đây là một ô đang chờ chứ không phải một ô giả.
           */
          ...(imageUrl && !isClip
            ? coverStyle(imageUrl)
            : { backgroundColor: paper.hover }),
        }}
      >
        {isClip && imageUrl && (
          /*
           * Clip vẽ bằng thẻ `video`, không vẽ bằng nền được. Không cho chạy và
           * không có thanh điều khiển: đây là chỗ nhận ra mình đã đặt cái gì,
           * không phải chỗ xem.
           */
          <video
            src={imageUrl}
            muted
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {!imageUrl && (
          <div style={{ ...label, margin: 0, color: ink.muted }}>chưa có ảnh trang bìa</div>
        )}

        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, lineHeight: 0 }}>
          <PlateUpload
            imageUrl={imageUrl}
            accept="image/*,video/*"
            onPick={onPick}
            onLink={onLink}
            onReframe={onReframe}
            onClear={onClear}
          />
        </div>
      </div>
    </div>
  )
}
