/** Elements that are a picture, or stand where one will be. */
import { cropStyle, fillStyle } from '../focus'
import { sans } from '../tokens'
import { registerElement, type ElementViewProps } from './registry'

export type ImageAttrs = { type: 'image'; id?: string; caption: string; imageUrl?: string | null }

export const image = registerElement<ImageAttrs>({
  name: 'image',
  title: 'Ảnh',
  category: 'media',
  description: 'Một tấm ảnh, chú thích tuỳ chọn. Chưa có ảnh thì là ô màu chờ.',
  keywords: ['ảnh', 'hình', 'image', 'photo', 'chú thích'],
  attributes: {
    imageUrl: { type: 'string', note: 'địa chỉ ảnh; rỗng thì vẽ ô màu chờ', optional: true },
    caption: { type: 'string', note: 'chú thích dưới ảnh' },
  },
  blank: () => ({ type: 'image', caption: '', imageUrl: null }),
  View: ({ attributes, palette, index, testId, render }: ElementViewProps<ImageAttrs>) => (
    <div
      data-testid={testId}
      style={{
        /*
         * A photo cut by hand takes the shape it was cut to; one placed before
         * cropping existed keeps the 250px strip it was published with.
         */
        ...(cropStyle(attributes.imageUrl) ?? { height: 250, ...fillStyle(attributes.imageUrl, palette.tint) }),
        display: 'flex',
        alignItems: 'flex-end',
        padding: 20,
        margin: '0 0 20px',
      }}
    >
      <div style={{ fontFamily: sans, fontSize: 10, color: palette.ink }}>
        {render?.renderImageCaption ? render.renderImageCaption(attributes.caption, index) : attributes.caption}
      </div>
    </div>
  ),
})
