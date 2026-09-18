/**
 * The nine marks the back office draws.
 *
 * They were Unicode characters typed straight into JSX, which meant every
 * machine drew them with whatever face had the glyph and nothing could set
 * their weight. Two different characters carried the same meaning — `✕` in
 * thirteen places and `×` in eleven — and the pin was the emoji `📌` held at
 * `opacity: .18`, which is not visible.
 *
 * Square caps and mitred joins, not round: at 14–18px a rounded 2.2 stroke
 * reads soft, and these sit next to 11–12px text that is not soft.
 *
 * Colour is always `currentColor`, so an icon inherits the button around it
 * and there is no second place to keep the two in step.
 */
import type { CSSProperties } from 'react'

type IconProps = {
  /** Side of the square box, in px. */
  size?: number
  style?: CSSProperties
}

function svg(size: number, style: CSSProperties | undefined, children: JSX.Element) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none', ...style }}
    >
      {children}
    </svg>
  )
}

export const IconClose = ({ size = 16, style }: IconProps) =>
  svg(size, style, <path d="M6 6l12 12M18 6L6 18" />)

export const IconTrash = ({ size = 16, style }: IconProps) =>
  svg(
    size,
    style,
    <>
      <path d="M4 6.5h16M9.5 6.5V3.5h5v3" />
      <path d="M6.5 6.5L7.5 20.5h9l1-14" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </>,
  )

export const IconDrag = ({ size = 16, style }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block', flex: 'none', ...style }}
  >
    <rect x="8" y="5" width="2.6" height="2.6" />
    <rect x="13.4" y="5" width="2.6" height="2.6" />
    <rect x="8" y="10.7" width="2.6" height="2.6" />
    <rect x="13.4" y="10.7" width="2.6" height="2.6" />
    <rect x="8" y="16.4" width="2.6" height="2.6" />
    <rect x="13.4" y="16.4" width="2.6" height="2.6" />
  </svg>
)

/**
 * One chevron, turned by `open`, replacing four characters that all meant the
 * same thing in different places: `▾`, `▸`, `+` and `−`.
 */
export const IconChevron = ({ size = 16, open = false, style }: IconProps & { open?: boolean }) =>
  svg(size, { transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s ease', ...style },
    <path d="M5 9l7 7 7-7" />)

export const IconEdit = ({ size = 16, style }: IconProps) =>
  svg(
    size,
    style,
    <>
      <path d="M4 20h4L19.5 8.5 15.5 4.5 4 16v4z" />
      <path d="M14 6l4 4" />
    </>,
  )

export const IconCopy = ({ size = 16, style }: IconProps) =>
  svg(
    size,
    style,
    <>
      <rect x="9" y="9" width="11" height="11" />
      <path d="M5 15V5h10" />
    </>,
  )

export const IconPin = ({ size = 16, style }: IconProps) =>
  svg(
    size,
    style,
    <>
      <path d="M12 16.5V22" />
      <path d="M9 2.5h6l-1 6 3 3v2.5H7V11.5l3-3-1-6z" />
    </>,
  )

export const IconUpload = ({ size = 16, style }: IconProps) =>
  svg(
    size,
    style,
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 17v3h16v-3" />
    </>,
  )

export const IconPlus = ({ size = 16, style }: IconProps) =>
  svg(size, style, <path d="M12 4v16M4 12h16" />)

export const IconCheck = ({ size = 16, style }: IconProps) =>
  svg(size, style, <path d="M4 12.5l5 5L20 6.5" />)

export const IconAlert = ({ size = 16, style }: IconProps) =>
  svg(size, style, <path d="M12 4v10M12 18v2" />)
