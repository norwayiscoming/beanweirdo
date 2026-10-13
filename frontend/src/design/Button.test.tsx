import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button, IconButton } from './Button'
import { IconClose } from './icons'

describe('Button', () => {
  it('mặc định là type="button" nên không tự gửi form quanh nó', () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={submit}>
        <Button onClick={vi.fn()}>Lưu</Button>
      </form>,
    )
    expect(screen.getByRole('button', { name: 'Lưu' })).toHaveAttribute('type', 'button')
  })

  it('cấp và cỡ đi thẳng vào class', () => {
    render(
      <Button level="danger" size="sm">
        Xoá
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Xoá' }).className).toBe('ab ab-danger ab-sm')
  })

  it('icon bên trong không cướp mất tên của nút', () => {
    render(<Button icon={<IconClose size={14} />}>Đóng lại</Button>)
    expect(screen.getByRole('button', { name: 'Đóng lại' })).toBeInTheDocument()
  })
})

describe('IconButton', () => {
  it('luôn có tên đọc được, vì nội dung của nó chỉ là một hình', () => {
    render(
      <IconButton label="Bỏ ảnh này">
        <IconClose />
      </IconButton>,
    )
    const b = screen.getByRole('button', { name: 'Bỏ ảnh này' })
    expect(b).toHaveAttribute('title', 'Bỏ ảnh này')
    expect(b.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
