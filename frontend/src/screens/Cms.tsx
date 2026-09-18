import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { NAV } from '../content/navItems'
import { displayNumber } from '../lib/postText'
import { onlyLive, orderPosts } from '../lib/postOrder'
import { resolveSite, SITE_DEFAULTS, type NavGroup, type SiteCopy, type SiteOverrides } from '../content/site'
import {
  createModule,
  deleteModule,
  listPosts,
  reorderModules,
  reorderPosts,
  updateModule,
  updatePost,
  updateSite,
  uploadImage,
  type Module,
  type PostSummary,
} from '../admin/lib/apiClient'
import {
  transitionStatus,
  getSite,
  createTag,
  renameTag,
  deleteTag,
  type Tag,
} from '../admin/lib/apiClient'
import {
  forgetModules,
  forgetTags,
  listModulesCached,
  listTagsCached,
} from '../admin/lib/lists'
import { tagColor } from '../lib/notesFilter'
import { PostsPanel } from '../admin/components/PostsPanel'
import { RoutesPanel } from '../admin/components/RoutesPanel'
import { ModuleImages } from '../admin/components/ModuleImages'
import { captionColumn, formShapeOf, imageColumn } from '../admin/moduleForm'
import { FocusPicker } from '../admin/components/FocusPicker'
import { coverStyle } from '../lib/imageFocus'
import { rootsOf } from '../lib/contentTree'
import { moduleMapRow, type MapRow } from '../lib/siteMapRows'
import { useSlotSwap, type SlotSwap } from '../admin/lib/useSlotSwap'
import { FeatureCellsEditor } from '../admin/components/FeatureCellsEditor'
import type { FeatureOverride } from '../content/notes'
import { ink, paper, sans, serif } from '../design/tokens'
import { Button, IconButton } from '../design/Button'
import { IconChevron, IconClose, IconDrag, IconPlus, IconTrash, IconUpload } from '../design/icons'
import { useToast } from '../design/Toaster'
import { Hover } from '../lib/Hover'
import { useNav } from '../lib/nav'

const sectionHead: CSSProperties = {
  fontFamily: sans,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '.2em',
  textTransform: 'uppercase',
  color: ink.muted,
  borderBottom: `2px solid ${ink.base}`,
  paddingBottom: 9,
  marginBottom: 18,
}

const fieldLabel: CSSProperties = {
  fontFamily: sans,
  fontSize: 10,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: ink.faint,
  marginBottom: 6,
}

const boxed: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: paper.white,
  border: `1px solid ${paper.rule}`,
  color: ink.base,
  fontFamily: sans,
  fontSize: 13,
  padding: '9px 12px',
  outline: 'none',
}

const serifInput: CSSProperties = { ...boxed, fontFamily: serif, fontSize: 22 }
const serifItalicInput: CSSProperties = { ...serifInput, fontStyle: 'italic', color: ink.green }
const area: CSSProperties = {
  ...boxed,
  fontWeight: 300,
  fontSize: 13.5,
  lineHeight: 1.5,
  padding: '10px 12px',
  resize: 'vertical',
}

const grid = (columns: string, marginBottom = 14): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: columns,
  gap: 22,
  marginBottom,
})

const one = 'minmax(0,1fr)'
const two = 'minmax(0,1fr) minmax(0,1fr)'
const three = 'repeat(3,minmax(0,1fr))'

/**
 * Fields are sized by what they hold, not by dividing the row evenly. A colour
 * is seven characters and a layout is one of three words, so both stay narrow
 * and the name takes the slack; a sentence gets its own full-width row.
 */
const nameRow = 'minmax(0,1fr) 112px 124px 128px'
const nameRowPlain = 'minmax(0,1fr) 112px'

/**
 * What a module row counts.
 *
 * Ghi 02 keeps daily ticks, not posts, so counting posts there would always
 * read zero and mean nothing. Everywhere else the count is posts — and an
 * empty module still appears on the site, so saying otherwise was wrong:
 * group 05 has it that a created public module always shows.
 */
function countLabel(id: string, live: number): string {
  if (id === 'ghi02') return 'checkbox hàng ngày'
  // Counting every post a module ever had said "6 bài" for a module with
  // nothing on the site at all.
  return live ? `${live} bài` : 'chưa có bài nào trên trang'
}

/** The three tabs, named once so the site map and the tab bar cannot drift. */
const TABS = [
  { k: 'posts', t: 'Tạo bài đăng' },
  { k: 'map', t: 'Sơ đồ trang' },
  { k: 'content', t: 'Sửa nội dung' },
] as const

/**
 * The seven things Sửa nội dung holds, in the order they appear.
 *
 * They were one uninterrupted scroll: landing copy, tags, two page blurbs, the
 * index, every module with its image editors nested inside, then the admin
 * blurb. Changing one word in the last block meant scrolling past all six.
 */
const CONTENT_SECTIONS = [
  { id: 'landing', t: 'Trang chủ' },
  { id: 'tag', t: 'Tag' },
  { id: 'notes', t: 'Ghi chép' },
  { id: 'archive', t: 'Lưu trữ' },
  { id: 'index', t: 'Mục lục' },
  { id: 'modules', t: 'Module' },
  { id: 'admin', t: 'Quản trị' },
] as const

/**
 * The bar that jumps between them.
 *
 * It sits along the top rather than down the left: the forms below run to two
 * and three columns inside 1080px, and a rail would take that back out of the
 * widest rows.
 */
function ContentIndex() {
  const [at, setAt] = useState<string>(CONTENT_SECTIONS[0].id)

  useEffect(() => {
    // jsdom has no IntersectionObserver; the bar still jumps, it just does not
    // light up, which is not worth a polyfill in tests.
    if (typeof IntersectionObserver === 'undefined') return
    const seen = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio)
        // Whichever heading is showing most of itself is the one you are at.
        let best: string | null = null
        let ratio = 0
        for (const [id, r] of seen) if (r > ratio) [best, ratio] = [id, r]
        if (best) setAt(best)
      },
      { rootMargin: '-64px 0px -70% 0px', threshold: [0, 0.5, 1] },
    )
    for (const s of CONTENT_SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [])

  return (
    <nav
      aria-label="Mục trên trang"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        padding: '12px 0 13px',
        marginBottom: 8,
        background: paper.cream,
        borderBottom: `1px solid ${paper.rule}`,
      }}
    >
      {CONTENT_SECTIONS.map((x) => (
        <button
          key={x.id}
          type="button"
          className="ab ab-ghost ab-sm"
          aria-current={at === x.id ? 'true' : undefined}
          style={at === x.id ? { background: ink.base, borderColor: ink.base, color: paper.cream } : undefined}
          onClick={() => document.getElementById(x.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
        >
          {x.t}
        </button>
      ))}
    </nav>
  )
}


/**
 * The rows under a page, however deep they run.
 *
 * Each step in indents by the same amount rather than by a different rule per
 * level, so the fourth level needs nothing written for it.
 */
function MapKids({ rows, depth = 0 }: { rows: MapRow[]; depth?: number }) {
  return (
    <>
      {rows.map((k, ki) => (
        <div key={`${k.label}-${ki}`}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              padding: `4px 0 4px ${26 + depth * 18}px`,
              borderLeft: `1px solid ${paper.rule}`,
              margin: '4px 0 0 6px',
              fontFamily: sans,
              fontWeight: 300,
              fontSize: 12.5,
              color: ink.soft,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>{k.label}</div>
            {k.desc && <div style={{ color: ink.muted }}>{k.desc}</div>}
          </div>
          {k.kids.length > 0 && <MapKids rows={k.kids} depth={depth + 1} />}
        </div>
      ))}
    </>
  )
}

/** Names where a field turns up on the site — identification, not instruction. */
function Where({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        letterSpacing: '.04em',
        textTransform: 'none',
        fontStyle: 'italic',
        opacity: 0.85,
      }}
    >
      {' · '}
      {children}
    </span>
  )
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  )
}

/**
 * Caption + optional photo for one image slot. The caption always exists (it
 * describes what the slot wants); the photo replaces the tinted placeholder on
 * the public screens once uploaded.
 */
type SlotDragProps = ReturnType<SlotSwap['slotProps']> & {
  marked?: boolean
  /** Chỗ để cầm — ô nhập chú thích nuốt cú nhấn giữ, tay nắm thì không. */
  handle?: ReturnType<SlotSwap['handleProps']>
}

function ImageSlot({
  label,
  caption,
  url,
  onCaption,
  onUpload,
  onClear,
  onPlace,
  ratio,
  drag,
}: {
  label: string
  caption: string
  url: string | null
  onCaption: (v: string) => void
  /** Uploads and returns the stored URL, so the frame can be set straight away. */
  onUpload: (f: File) => Promise<string | null>
  onClear: () => void
  /** The same photo, carrying a focal point. */
  onPlace: (url: string) => void
  /** Width ÷ height of the frame this photo fills on the public page. */
  ratio: number
  /** Kéo sang khung khác để hai ảnh đổi chỗ. */
  drag?: SlotDragProps
}) {
  const [placing, setPlacing] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const { marked, handle, ...dragProps } = drag ?? { marked: false, handle: undefined }
  return (
    <div {...dragProps} style={{ outline: marked ? `2px solid ${ink.base}` : undefined, outlineOffset: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {handle && (
          <div
            {...handle}
            title="Kéo sang khung khác để đổi chỗ hai ảnh"
            aria-label={`kéo ${label} sang khung khác`}
            style={{ lineHeight: 0, color: ink.faint, cursor: 'grab', userSelect: 'none' }}
          >
            <IconDrag size={15} />
          </div>
        )}
        <div style={fieldLabel}>{label}</div>
      </div>
      {/*
        * Ghi khi rời ô, không phải từng phím — như mọi ô chữ khác trên màn này.
        * Ghi từng phím nghĩa là mỗi ký tự xoá đi là một lượt lưu, và ô nhấp
        * nháy theo từng nhịp bàn phím.
        */}
      <input
        defaultValue={caption}
        key={caption}
        onBlur={(e) => onCaption(e.target.value)}
        style={{ ...boxed, padding: '8px 11px' }}
      />
      {url ? (
        <div
          style={{
            marginTop: 7,
            aspectRatio: '16/9',
            ...coverStyle(url),
            border: `1px solid ${paper.rule}`,
          }}
        />
      ) : (
        <div
          style={{
            marginTop: 7,
            aspectRatio: '16/9',
            border: `1px solid ${paper.rule}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontFamily: sans, fontSize: 11, color: ink.faint }}>chưa có ảnh</div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
        {/*
          A `<label>` wrapping a hidden file input is what this was: it could be
          clicked but not tabbed to, and it was drawn with a dashed 1px rule
          that read as a drop zone rather than a control. A real button that
          forwards the click keeps the keyboard in play.
        */}
        <input
          ref={file}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
          style={{ display: 'none' }}
        />
        <Button
          size="sm"
          level="secondary"
          onClick={() => file.current?.click()}
          icon={<IconUpload size={14} />}
        >
          {url ? 'Đổi ảnh' : 'Tải ảnh lên'}
        </Button>
        {url && (
          <Button size="sm" onClick={() => setPlacing(url)}>
            Đặt vào khung
          </Button>
        )}
        <Button size="sm" onClick={() => setLinking(!linking)} aria-expanded={linking}>
          Dán link
        </Button>
        {url && (
          <IconButton size="sm" level="danger" label="Bỏ ảnh này" onClick={onClear}>
            <IconClose size={15} />
          </IconButton>
        )}
      </div>

      {linking && (
        /*
         * Ảnh có thể nằm ở nơi khác. Lưu đường dẫn thay vì bản sao thì không
         * để lại trong kho thứ không cần ở đó — đổi lại, ảnh chỉ bền bằng chỗ
         * đang giữ nó.
         */
        <input
          autoFocus
          defaultValue={url ?? ''}
          placeholder="dán link ảnh rồi Enter"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLinking(false)
            if (e.key !== 'Enter') return
            const v = (e.target as HTMLInputElement).value.trim()
            setLinking(false)
            if (!v) return onClear()
            onPlace(v)
            setPlacing(v)
          }}
          onBlur={() => setLinking(false)}
          style={{ ...boxed, padding: '7px 10px', marginTop: 7, fontSize: 12 }}
        />
      )}

      {placing && (
        <FocusPicker
          url={placing}
          ratio={ratio}
          name={label}
          onCancel={() => setPlacing(null)}
          onSave={(next) => {
            onPlace(next)
            setPlacing(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Content management — the site's own back office.
 *
 * Three tabs. "Tạo bài đăng" is where everything written is written — posts
 * under modules and Ghi 01 notes alike, one list, because a note is a kind of
 * entry rather than a separate thing to administer.
 * "Sơ đồ trang" is a read-through map of every page in the sidebar, where the
 * three section names are editable in place. "Sửa nội dung" edits the site
 * copy, the three opening plates, and every module: its colours, its layout,
 * its image slots, and its list of posts (drag to reorder, which renumbers
 * them server-side).
 *
 * Everything saves on blur — there is no page-level save button (System
 * conventions, rule 08).
 */
/**
 * Thêm, đổi tên, xoá tag.
 *
 * Cùng một khuôn với tag của Ghi 02, kể cả phần khó nhất của nó: xoá một tag
 * thì phải nói trước những gì đang đeo nó sẽ về đâu. Xoá lặng lẽ là để lại bài
 * trỏ vào một tag không còn tồn tại — nó biến mất khỏi mọi thanh lọc mà vẫn nằm
 * đó, đúng cái lỗi "viết xong rồi không tìm thấy được".
 */
function TagsPanel() {
  const [tags, setTags] = useState<Tag[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<{ id: string; wearing: { posts: string[]; notes: string[] } } | null>(null)
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = () => void listTagsCached().then(setTags)
  useEffect(load, [])

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    try {
      await fn()
      setErr(null)
      // Bỏ bản đang giữ trước khi đọc lại, nếu không `load()` trả về đúng cái
      // danh sách mà lượt ghi vừa rồi đã làm cho cũ.
      forgetTags()
      load()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      {err && <div role="alert" style={{ fontSize: 12, color: '#8E1E42' }}>{err}</div>}
      {tags.map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: tagColor(t.label), flex: 'none' }} />
          <input
            defaultValue={t.label}
            key={t.label}
            aria-label={`tên tag ${t.label}`}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== t.label) void run(t.id, () => renameTag(t.id, v))
            }}
            style={{ ...boxed, maxWidth: 260, padding: '5px 9px', fontSize: 13 }}
          />
          <IconButton
            size="sm"
            level="danger"
            label={`Xoá tag ${t.label}`}
            disabled={busy === t.id}
            onClick={() =>
              void run(t.id, async () => {
                try {
                  await deleteTag(t.id)
                } catch (e) {
                  // Máy chủ từ chối vì còn thứ đang đeo, và trả về danh sách ấy.
                  const w = (e as { payload?: { wearing?: { posts: string[]; notes: string[] } } }).payload?.wearing
                  if (!w) throw e
                  setAsking({ id: t.id, wearing: w })
                }
              })
            }
          >
            <IconTrash size={14} />
          </IconButton>
          {asking?.id === t.id && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: ink.mid }}>
              {asking.wearing.posts.length + asking.wearing.notes.length} thứ đang đeo — chuyển sang
              <select
                aria-label="chuyển sang tag"
                defaultValue=""
                onChange={(e) => {
                  const to = e.target.value === '' ? null : e.target.value
                  setAsking(null)
                  void run(t.id, () => deleteTag(t.id, to))
                }}
                style={{ ...boxed, width: 'auto', padding: '3px 6px', fontSize: 11.5 }}
              >
                <option value="">(bỏ trống)</option>
                {tags.filter((o) => o.id !== t.id).map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </span>
          )}
        </div>
      ))}
      {adding ? (
        <input
          autoFocus
          placeholder="tên tag mới rồi Enter"
          onKeyDown={(e) => {
            if (e.key === 'Escape') return setAdding(false)
            if (e.key !== 'Enter') return
            const v = (e.target as HTMLInputElement).value.trim()
            setAdding(false)
            if (v) void run('new', () => createTag(v))
          }}
          onBlur={() => setAdding(false)}
          style={{ ...boxed, maxWidth: 260, padding: '5px 9px', fontSize: 13 }}
        />
      ) : (
        <div style={{ alignSelf: 'flex-start' }}>
          <Button size="sm" onClick={() => setAdding(true)} icon={<IconPlus size={14} />}>
            Tag mới
          </Button>
        </div>
      )}
    </div>
  )
}

export function Cms() {
  const nav = useNav()
  const toast = useToast()
  // Tab nằm trong địa chỉ, không nằm trong state: ba tab là ba chỗ khác nhau
  // để đứng, nên một đường link tới sơ đồ trang không được mở ra danh sách bài.
  const tab = nav.cmsTab
  const [site, setSite] = useState<SiteOverrides>({})
  const [modules, setModules] = useState<Module[]>([])
  // The site map names what Templates holds, so it has to know.
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [openModule, setOpenModule] = useState<string | null>(null)
  const [dragModule, setDragModule] = useState<string | null>(null)
  const [overModule, setOverModule] = useState<string | null>(null)
  const [dragEntry, setDragEntry] = useState<string | null>(null)
  /** Đang hỏi lại trước khi xoá sạch nội dung đã sửa của cả trang. */
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, m, p] = await Promise.all([getSite(), listModulesCached(), listPosts('all')])
      setSite(s)
      setModules(m)
      setPosts(p)
    } catch (e) {
      toast.fromError(e)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  /*
   * Cùng một hàm trang công khai dùng. Màn này từng giữ phép hoà riêng của nó,
   * và đó là lý do sửa được một chỗ mà lỗi vẫn còn: ba bản sao của một luật.
   */
  const copy = useMemo(() => resolveSite(site), [site])

  async function saveSite(patch: SiteOverrides) {
    setSite((s) => ({ ...s, ...patch, sections: { ...s.sections, ...patch.sections } }))
    try {
      setSite(await updateSite(patch))
    } catch (e) {
      toast.fromError(e)
    }
  }

  const setCopy = (key: keyof SiteCopy) => (v: string) => void saveSite({ [key]: v } as SiteOverrides)

  /*
   * Mỗi ô chữ lưu cả khi đang gõ, không chỉ khi rời ô.
   *
   * Chỉ lưu khi rời ô là một cái bẫy im lặng: gõ xong rồi tải lại trang, hoặc
   * đóng tab, hoặc bấm sang tab khác — ô vừa gõ chưa hề được lưu, và không có
   * gì trên màn hình cho biết. Chủ site soạn xong cả trang rồi mất sạch đúng vì
   * chuyện này.
   *
   * Chờ một nhịp ngắn sau khi ngừng gõ để không gửi một lượt lưu cho mỗi ký tự.
   */
  const pending = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const queueCopy = (key: keyof SiteCopy, v: string) => {
    clearTimeout(pending.current[key])
    pending.current[key] = setTimeout(() => setCopy(key)(v), 700)
  }

  /*
   * Chữ đang gõ dở, đè lên chữ lấy từ máy chủ.
   *
   * Ô nhập trước đây là `defaultValue` — React chỉ đọc nó đúng một lần, lúc ô
   * được vẽ ra. Biểu mẫu này vẽ ngay khi mở màn, còn nội dung thật thì về sau
   * một nhịp mạng, nên mọi ô đứng nguyên ở chữ mặc định trong mã: trang công
   * khai hiện bản mới, CMS hiện bản cũ, và không ô nào sai chính tả để mà ngờ.
   *
   * Nên ô đọc thẳng từ `copy`, và chỉ khi người dùng đang gõ thì bản nháp mới
   * đè lên — đè để con trỏ không nhảy về đầu dòng mỗi lượt lưu tự động.
   */
  const [draft, setDraft] = useState<Partial<Record<keyof SiteCopy, string>>>({})
  const dropDraft = (key: keyof SiteCopy) =>
    setDraft((d) => {
      const next = { ...d }
      delete next[key]
      return next
    })

  /** Cả hai lối lưu cho một ô: nhịp ngắn khi đang gõ, và ngay khi rời ô. */
  const field = (key: keyof SiteCopy) => ({
    value: draft[key] ?? (copy[key] as string),
    onChange: (e: { target: { value: string } }) => {
      setDraft((d) => ({ ...d, [key]: e.target.value }))
      queueCopy(key, e.target.value)
    },
    onBlur: (e: { target: { value: string } }) => {
      clearTimeout(pending.current[key])
      setCopy(key)(e.target.value)
      dropDraft(key)
    },
  })

  /*
   * Kéo một ảnh sang khung khác thì hai bên đổi chỗ, và chú thích đi theo ảnh
   * của nó. Trước đó đổi thứ tự nghĩa là xoá rồi tải lại từng cái — mỗi lần
   * như vậy mất luôn chú thích và điểm căn khung đã chỉnh.
   */
  const plateSwap = useSlotSwap((a, b) => {
    const at = (slot: number) => ({
      caption: copy[`plate${slot as 1 | 2 | 3}` as const],
      url: copy[`plateImg${slot as 1 | 2 | 3}` as const],
    })
    const [one, two] = [at(a), at(b)]
    void saveSite({
      [`plate${a}`]: two.caption,
      [`plateImg${a}`]: two.url,
      [`plate${b}`]: one.caption,
      [`plateImg${b}`]: one.url,
    } as SiteOverrides)
  })

  async function savePlate(slot: 1 | 2 | 3 | 4, file: File): Promise<string | null> {
    try {
      const { url } = await uploadImage(file)
      await saveSite({ [`plateImg${slot}`]: url } as SiteOverrides)
      return url
    } catch (e) {
      toast.fromError(e)
      return null
    }
  }

  async function patchModule(id: string, patch: Partial<Module>) {
    setModules((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    forgetModules()
    try {
      await updateModule(id, patch)
    } catch (e) {
      toast.fromError(e)
    }
  }

  async function dropModule(targetId: string) {
    const src = dragModule
    setDragModule(null)
    setOverModule(null)
    if (!src || src === targetId) return
    const order = modules.map((m) => m.id)
    const i = order.indexOf(src)
    const j = order.indexOf(targetId)
    if (i < 0 || j < 0) return
    order.splice(j, 0, order.splice(i, 1)[0])
    setModules(order.map((id) => modules.find((m) => m.id === id)!))
    forgetModules()
    try {
      setModules(await reorderModules(order))
    } catch (e) {
      toast.fromError(e)
    }
  }

  /**
   * A module's posts, in the order the site shows them.
   *
   * This used to sort by `sort_order` alone. With every value null — which is
   * the normal state, since a number there means somebody dragged the post
   * somewhere — the sort changed nothing and the list stayed in the API's
   * order, `updated_at`, most recently edited first. So the numbers 01…06 named
   * an order the site never used, and the drag handle rearranged a list that
   * did not match the page it was arranging.
   */
  const postsOf = (module_id: string) =>
    orderPosts(posts.filter((p) => p.module_id === module_id))

  /**
   * The posts a reader can actually see in this module.
   *
   * The editor listed every post a module had ever had — drafts, archived,
   * deleted — and numbered them 01…06 as if that were their running order on
   * the site. It was not: sensory had one post published and five archived, and
   * roasting had none at all while the editor said "6 bài". So the numbers named
   * places no reader would ever count to, and the drag handle rearranged
   * archived posts in among live ones.
   */
  const liveOf = (module_id: string) => onlyLive(postsOf(module_id))

  async function patchPost(id: string, patch: { en?: string; vi?: string; date_label?: string }) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    try {
      await updatePost(id, patch)
    } catch (e) {
      toast.fromError(e)
    }
  }

  async function dropEntry(module_id: string, targetId: string) {
    const src = dragEntry
    setDragEntry(null)
    if (!src || src === targetId) return
    // Only the posts on the page can be arranged, and only they are given a
    // `sort_order` — the column means "the owner put this here", so writing it
    // on an archived post would claim a placement nobody made.
    const order = liveOf(module_id).map((p) => p.id)
    const i = order.indexOf(src)
    const j = order.indexOf(targetId)
    if (i < 0 || j < 0) return
    order.splice(j, 0, order.splice(i, 1)[0])
    try {
      const updated = await reorderPosts(module_id, order)
      setPosts((ps) => ps.filter((p) => p.module_id !== module_id).concat(updated))
    } catch (e) {
      toast.fromError(e)
    }
  }


  async function removeEntry(id: string) {
    try {
      await transitionStatus(id, 'delete')
      setPosts((ps) => ps.filter((p) => p.id !== id))
    } catch (e) {
      toast.fromError(e)
    }
  }

  /**
   * What an admin page holds, for the pages that hold something nameable.
   *
   * Content management holds its own three tabs. Phần còn lại giữ luật và
   * tham chiếu, thứ chính trang ấy bày ra tốt hơn một dòng trong sơ đồ.
   */
  function childrenOf(key: string): MapRow[] {
    if (key === 'cms') return TABS.map((t) => ({ label: t.t, desc: '', kids: [] }))
    return []
  }

  /**
   * The site map: every page, and what each one actually holds.
   *
   * It used to be assembled from two sources that disagreed. Ghi 01 and Ghi 02
   * are modules *and* nav entries, so each was listed twice — once with the
   * hand-typed name from `navItems.ts`, once with the real one from the
   * database — and Ghi 02, which is private, turned up under Public as well as
   * Practice. A page that is a module now names itself from that module and
   * carries its posts; a module with a page of its own is not listed again.
   *
   * Rows the admin cannot open do not belong on a map of the site, and rows
   * that hold something say what they hold, so nothing here is written by hand
   * twice.
   */
  const moduleRow = (m: Module): MapRow => moduleMapRow(modules, m, liveOf)

  const tree: { group: NavGroup; color: string; rows: MapRow[] }[] = (
    [
      { group: 'Public', color: ink.green },
      { group: 'Practice', color: '#C25C7C' },
      { group: 'Admin', color: '#6FA8C0' },
    ] as { group: NavGroup; color: string }[]
  ).map((g) => {
    const rows: MapRow[] = []
    // Modules that a nav entry already speaks for — listing them again is the
    // duplicate this map used to show.
    const spokenFor = new Set(NAV.map((n) => n.moduleId).filter(Boolean) as string[])

    for (const item of NAV.filter((n) => n.group === g.group && !n.hiddenFromSidebar)) {
      // Reading modules sit under Trang chủ, the gallery that shows them.
      if (g.group === 'Public' && item.key === 'notes') {
        // Only the modules nothing else holds. Everything filed inside one is
        // reached by recursing into it, so a module is drawn exactly once
        // however deep it sits — the flat loop that used to be here listed a
        // sub-module beside its own parent.
        for (const m of rootsOf(modules).filter((x) => !spokenFor.has(x.id))) {
          rows.push(moduleRow(m))
        }
      }

      const m = item.moduleId ? modules.find((x) => x.id === item.moduleId) : undefined
      rows.push({
        // The database wins where it has something to say; the nav entry is the
        // fallback for a module that has not loaded or does not exist yet.
        label: m?.title ?? item.label,
        desc: m?.concept ? `module · ${m.concept}` : item.desc,
        kids: m ? moduleRow(m).kids : childrenOf(item.key),
      })
    }
    return { ...g, rows }
  })

  const postCount = posts.length

  return (
    <div style={{ background: paper.cream, color: ink.base, minHeight: '100vh' }}>
      <div style={{ background: '#DDEBF0', color: '#0E2C38', padding: '44px 56px 30px' }}>
        <Breadcrumbs style={{ opacity: 0.75 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 44,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: serif,
                fontWeight: 400,
                fontSize: 70,
                lineHeight: 1,
                letterSpacing: '-.04em',
                margin: 0,
              }}
            >
              {copy.cmsTitle}
            </h1>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 300,
                fontSize: 13.5,
                lineHeight: 1.5,
                marginTop: 10,
                maxWidth: 430,
                opacity: 0.85,
              }}
            >
              {copy.cmsIntro}
            </div>
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: 11,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              opacity: 0.7,
              paddingBottom: 8,
            }}
          >
            {modules.length} module · {postCount} bài
          </div>
        </div>

        {/*
          Three places to stand, so three real buttons. They were `<div onClick>`,
          which meant the only way into the other two tabs was the mouse — and
          `aria-pressed` now says which one you are on rather than leaving it to
          the fill colour alone.
        */}
        <div style={{ display: 'flex', gap: 6, marginTop: 26, flexWrap: 'wrap' }}>
          {TABS.map((x) => (
            <button
              key={x.k}
              type="button"
              className="ab-tab"
              aria-pressed={tab === x.k}
              onClick={() => nav.goCms(x.k)}
            >
              {x.t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'posts' && (
        <div style={{ padding: '34px 56px 130px', maxWidth: 1080 }}>
          <PostsPanel onChanged={() => void load()} />
        </div>
      )}

      {tab === 'map' && (
        <div style={{ padding: '34px 56px 130px', maxWidth: 1080 }}>
          {tree.map((g) => (
            <div key={g.group} style={{ marginBottom: 40 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: `2px solid ${ink.base}`,
                  paddingBottom: 9,
                  marginBottom: 6,
                }}
              >
                <div style={{ width: 9, height: 9, background: g.color }} />
                <input
                  value={copy.sections[g.group]}
                  onChange={(e) =>
                    setSite((s) => ({ ...s, sections: { ...s.sections, [g.group]: e.target.value } }))
                  }
                  onBlur={(e) => void saveSite({ sections: { [g.group]: e.target.value } })}
                  title="Tên section — đồng bộ với sidebar"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 0,
                    outline: 'none',
                    color: ink.base,
                    fontFamily: sans,
                    fontSize: 10.5,
                    fontWeight: 500,
                    letterSpacing: '.2em',
                    textTransform: 'uppercase',
                    padding: '0 0 1px',
                  }}
                />
              </div>
              {g.rows.map((r, i) => (
                <div key={`${r.label}-${i}`} style={{ borderBottom: '1px solid #F0EBDB', padding: '11px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                    <div
                      style={{
                        fontFamily: serif,
                        fontSize: 21,
                        lineHeight: 1.1,
                        letterSpacing: '-.02em',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {r.label}
                    </div>
                    <div style={{ fontFamily: sans, fontWeight: 300, fontSize: 12, color: ink.muted }}>
                      {r.desc}
                    </div>
                  </div>
                  <MapKids rows={r.kids} />
                </div>
              ))}
            </div>
          ))}

          <RoutesPanel
            stored={site.routes}
            modules={modules}
            onSave={(routes) => saveSite({ routes } as SiteOverrides)}
          />
        </div>
      )}

      {tab === 'content' && (
        <div style={{ padding: '0 56px 130px', maxWidth: 1080 }}>
          <ContentIndex />
          <div id="landing" style={{ ...sectionHead, scrollMarginTop: 64 }}>Trang chủ — landing</div>
          <div style={grid(two)}>
            <Field label="Nhãn trên cùng">
              <input
                {...field('lEyebrow')}
                style={boxed}
              />
            </Field>
            <Field label="Nhãn xem mục lục">
              <input {...field('lCta')} style={boxed} />
            </Field>
            <Field
              label={
                <>
                  Tên lớn — dòng 1 · chữ <span style={{ color: '#F2A0A5' }}>ӕ</span> phóng to màu hồng
                </>
              }
            >
              <input
                {...field('lTitle1')}
                style={serifInput}
              />
            </Field>
            <Field label="Tên lớn — dòng 2 (nghiêng, xanh)">
              <input
                {...field('lTitle2')}
                style={serifItalicInput}
              />
            </Field>
            <Field label="Đoạn dẫn — cột 1">
              <textarea
                {...field('lIntro1')}
                rows={4}
                style={area}
              />
            </Field>
            <Field label="Đoạn dẫn — cột 2">
              <textarea
                {...field('lIntro2')}
                rows={4}
                style={area}
              />
            </Field>
          </div>

          {/*
            * Trang Ghi chép và trang Lưu trữ.
            *
            * Năm dòng của trang Ghi chép từng nằm cứng trong mã, còn hai dòng
            * của trang Lưu trữ thì có trong dữ liệu nhưng chưa bao giờ có ô để
            * sửa — khai ra rồi bỏ đó cũng là không sửa được.
            */}
          {/*
            * Tag dùng chung cho cả ghi chép lẫn bài đăng — sửa ở đây, ăn cả hai
            * chỗ. Trước đây bốn dạng ghi viết cứng trong code, muốn đổi một chữ
            * là phải sửa code.
            */}
          <div id="tag" style={{ ...sectionHead, margin: '34px 0 18px', scrollMarginTop: 64 }}>Tag</div>
          <TagsPanel />

          <div id="notes" style={{ ...sectionHead, margin: '34px 0 18px', scrollMarginTop: 64 }}>Trang Ghi chép</div>
          <div style={grid(two)}>
            <Field label="Tiêu đề trang">
              <input {...field('notesTitle')} style={serifInput} />
            </Field>
            <Field label="Dòng dưới tiêu đề">
              <input {...field('notesSubtitle')} style={serifItalicInput} />
            </Field>
          </div>
          <div style={grid(two, 18)}>
            <Field label="Đoạn dẫn — góc phải">
              <textarea {...field('notesIntro')} rows={3} style={{ ...area, fontSize: 14 }} />
            </Field>
            <Field label="Dòng hướng dẫn — dưới đoạn dẫn">
              <textarea {...field('notesHint')} rows={3} style={{ ...area, fontSize: 14 }} />
            </Field>
          </div>
          <div style={grid(two, 18)}>
            <Field label="Lời kết — cuối trang">
              <input {...field('notesEnd')} style={serifItalicInput} />
            </Field>
            <Field label="Lời kết — dòng phụ">
              <input {...field('notesEndNote')} style={boxed} />
            </Field>
          </div>

          <div id="archive" style={{ ...sectionHead, margin: '34px 0 18px', scrollMarginTop: 64 }}>Trang Lưu trữ</div>
          <div style={grid(two)}>
            <Field label="Tiêu đề trang">
              <input {...field('archiveTitle')} style={serifInput} />
            </Field>
            <Field label="Dòng phụ — cạnh số bài">
              <input {...field('archiveNote')} style={boxed} />
            </Field>
          </div>

          <div id="index" style={{ ...sectionHead, margin: '34px 0 18px', scrollMarginTop: 64 }}>Mục lục</div>
          <div style={grid(two)}>
            <Field label="Tiêu đề — dòng 1">
              <input {...field('t1')} style={serifInput} />
            </Field>
            <Field label="Tiêu đề — dòng 2 (nghiêng, xanh)">
              <input
                {...field('t2')}
                style={serifItalicInput}
              />
            </Field>
          </div>
          <div style={grid(two, 18)}>
            <Field label="Đoạn dẫn — dạng danh sách">
              <textarea
                {...field('blurb')}
                rows={3}
                style={{ ...area, fontSize: 14 }}
              />
            </Field>
            <Field label="Đoạn dẫn — dạng cột">
              <textarea
                {...field('blurbShort')}
                rows={3}
                style={{ ...area, fontSize: 14 }}
              />
            </Field>
          </div>
          <div style={grid(three, 40)}>
            {([1, 2, 3] as const).map((slot) => (
              <ImageSlot
                key={slot}
                label={`Chú thích ảnh ${slot}`}
                caption={copy[`plate${slot}` as const]}
                url={copy[`plateImg${slot}` as const] || null}
                onCaption={(v) => void saveSite({ [`plate${slot}`]: v } as SiteOverrides)}
                onUpload={(f) => savePlate(slot, f)}
                onClear={() => void saveSite({ [`plateImg${slot}`]: '' } as SiteOverrides)}
                onPlace={(next) => void saveSite({ [`plateImg${slot}`]: next } as SiteOverrides)}
                ratio={16 / 9}
                drag={{
                  ...plateSwap.slotProps(slot),
                  handle: plateSwap.handleProps(slot),
                  marked: plateSwap.over === slot,
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              borderBottom: `2px solid ${ink.base}`,
              paddingBottom: 9,
              marginBottom: 6,
              scrollMarginTop: 64,
            }}
            id="modules"
          >
            <div
              style={{
                fontFamily: sans,
                fontSize: 10.5,
                fontWeight: 500,
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: ink.muted,
              }}
            >
              Module — kéo thẻ để đổi thứ tự
            </div>
            <Button
              level="primary"
              icon={<IconPlus size={16} />}
              onClick={async () => {
                try {
                  const m = await createModule()
                  forgetModules()
                  setModules((ms) => ms.concat([m]))
                  setOpenModule(m.id)
                  toast.ok(`Đã tạo module “${m.title}”`)
                } catch (e) {
                  toast.fromError(e)
                }
              }}
            >
              Module mới
            </Button>
          </div>

          {modules.map((m, mi) => {
            // Only what a reader sees. Order is a fact about the page, so a
            // post that is not on the page has no place in this list — the
            // drafts and the archive are managed on Tạo bài đăng.
            const entries = liveOf(m.id)
            const open = openModule === m.id
            // Which fields this module actually uses — see admin/moduleForm.ts.
            const shape = formShapeOf(m)
            return (
              <div
                key={m.id}
                draggable
                onDragStart={() => setDragModule(m.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (overModule !== m.id) setOverModule(m.id)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  void dropModule(m.id)
                }}
                onDragEnd={() => {
                  setDragModule(null)
                  setOverModule(null)
                }}
                style={{
                  borderBottom: '1px solid #F0EBDB',
                  padding: '13px 0',
                  opacity: dragModule === m.id ? 0.45 : 1,
                }}
              >
                {overModule === m.id && dragModule !== m.id && (
                  <div style={{ height: 2, background: ink.base, margin: '-13px 0 11px' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <Hover
                    title="Kéo để đổi thứ tự"
                    style={{
                      fontFamily: sans,
                      lineHeight: 0,
                      color: ink.faint,
                      cursor: 'grab',
                      flex: 'none',
                    }}
                    hoverStyle={{ color: ink.base }}
                  >
                    <IconDrag size={16} />
                  </Hover>
                  {/*
                    The arrow and the module name were two separate `<div onClick>`
                    doing the same thing, so a keyboard could reach neither. One
                    button carrying both is also one tab stop instead of two.
                  */}
                  <IconButton
                    size="sm"
                    label={open ? `Đóng ${m.title}` : `Mở ${m.title}`}
                    aria-expanded={open}
                    onClick={() => setOpenModule(open ? null : m.id)}
                  >
                    <IconChevron size={14} open={open} />
                  </IconButton>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: m.accent, flex: 'none' }} />
                  <div
                    style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: '.16em', color: ink.faint, width: 26, flex: 'none' }}
                  >
                    {String(mi + 1).padStart(2, '0')}
                  </div>
                  <button
                    type="button"
                    className="ab-disclose"
                    aria-expanded={open}
                    onClick={() => setOpenModule(open ? null : m.id)}
                    style={{
                      fontFamily: serif,
                      fontSize: 24,
                      lineHeight: 1.1,
                      letterSpacing: '-.025em',
                      color: ink.base,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {m.title}
                  </button>
                  <div style={{ fontFamily: sans, fontWeight: 300, fontSize: 12, color: ink.muted, flex: 'none' }}>
                    {countLabel(m.id, entries.length)}
                  </div>
                  <IconButton
                    size="sm"
                    level="danger"
                    label={`Xoá module ${m.title}`}
                    onClick={async () => {
                      try {
                        await deleteModule(m.id)
                        forgetModules()
                        setModules((ms) => ms.filter((x) => x.id !== m.id))
                        setPosts((ps) => ps.filter((p) => p.module_id !== m.id))
                        setOpenModule(null)
                        toast.ok(`Đã xoá module “${m.title}”`)
                      } catch (e) {
                        toast.fromError(e)
                      }
                    }}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </div>

                {open && (
                  <div style={{ padding: '16px 0 6px 39px' }}>
                    <div style={grid(shape.concept ? nameRow : nameRowPlain)}>
                      <Field label="Tên module">
                        <input
                          defaultValue={m.title}
                          onBlur={(e) => void patchModule(m.id, { title: e.target.value })}
                          style={boxed}
                        />
                      </Field>
                      <Field label="Màu">
                        <div style={{ position: 'relative' }}>
                          <span
                            style={{
                              position: 'absolute',
                              left: 10,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 13,
                              height: 13,
                              border: `1px solid ${paper.rule}`,
                              background: m.accent,
                            }}
                          />
                          <input
                            defaultValue={m.accent}
                            onBlur={(e) => void patchModule(m.id, { accent: e.target.value })}
                            style={{ ...boxed, paddingLeft: 31 }}
                          />
                        </div>
                      </Field>
                      {shape.layout && (
                        <Field label="Dàn trang">
                          <select
                            value={m.layout}
                            onChange={(e) => void patchModule(m.id, { layout: e.target.value })}
                            style={boxed}
                          >
                            <option value="band">band</option>
                            <option value="specimen">specimen</option>
                            <option value="sequence">sequence</option>
                          </select>
                        </Field>
                      )}
                      {shape.concept && (
                        <Field label="Concept">
                          <input
                            defaultValue={m.concept}
                            onBlur={(e) => void patchModule(m.id, { concept: e.target.value })}
                            style={boxed}
                          />
                        </Field>
                      )}
                    </div>

                    {shape.blurb && (
                      <div style={grid(one)}>
                        <Field label={<>Mô tả ngắn<Where>hiện ở Mục lục</Where></>}>
                          <textarea
                            defaultValue={m.blurb}
                            onBlur={(e) => void patchModule(m.id, { blurb: e.target.value })}
                            rows={2}
                            style={area}
                          />
                        </Field>
                      </div>
                    )}

                    {shape.longDesc && (
                      <div style={grid(one)}>
                        <Field label={<>Mô tả dài<Where>hiện ở Trang chủ và đầu trang module</Where></>}>
                          <textarea
                            defaultValue={m.long_desc}
                            onBlur={(e) => void patchModule(m.id, { long_desc: e.target.value })}
                            rows={3}
                            style={area}
                          />
                        </Field>
                      </div>
                    )}

                    {shape.designNotes && (
                      <div style={grid(two)}>
                        <Field label={<>Treatment<Where>hiện ở Design system</Where></>}>
                          <textarea
                            defaultValue={m.treatment}
                            onBlur={(e) => void patchModule(m.id, { treatment: e.target.value })}
                            rows={3}
                            style={area}
                          />
                        </Field>
                        <Field label={<>Ghi chú dàn trang<Where>hiện ở Design system</Where></>}>
                          <textarea
                            defaultValue={m.layout_note}
                            onBlur={(e) => void patchModule(m.id, { layout_note: e.target.value })}
                            rows={3}
                            style={area}
                          />
                        </Field>
                      </div>
                    )}

                    {shape.featureCells && (
                      <FeatureCellsEditor
                        overrides={(m.feature_cells as FeatureOverride[] | null) ?? []}
                        onChange={(next) => void patchModule(m.id, { feature_cells: next })}
                        onUpload={async (n, f) => {
                          try {
                            const { url } = await uploadImage(f)
                            const prev = (m.feature_cells as FeatureOverride[] | null) ?? []
                            const rest = prev.filter((o) => o.n !== n)
                            const current = prev.find((o) => o.n === n) ?? { n }
                            await patchModule(m.id, {
                              feature_cells: [...rest, { ...current, img: url }].sort((a, b) => a.n - b.n),
                            })
                            return url
                          } catch (e) {
                            toast.fromError(e)
                            return null
                          }
                        }}
                      />
                    )}

                    {shape.images.map((group) => (
                      <ModuleImages
                        key={group.label}
                        m={m}
                        group={group}
                        onCaption={(slot, v) =>
                          void patchModule(m.id, { [captionColumn(group, slot)]: v })
                        }
                        onUpload={async (slot, f) => {
                          try {
                            const { url } = await uploadImage(f)
                            await patchModule(m.id, { [imageColumn(group, slot)]: url })
                            return url
                          } catch (e) {
                            toast.fromError(e)
                            return null
                          }
                        }}
                        onClear={(slot) => void patchModule(m.id, { [imageColumn(group, slot)]: null })}
                        onSwap={(a, b) => {
                          // Ảnh và chú thích của nó đi cùng nhau — đổi chỗ ảnh
                          // mà bỏ chú thích lại là gán nhầm lời cho hình.
                          const cell = (slot: 1 | 2 | 3 | 4) => ({
                            img: (m as Record<string, unknown>)[imageColumn(group, slot)] ?? null,
                            cap: (m as Record<string, unknown>)[captionColumn(group, slot)] ?? null,
                          })
                          const [one, two] = [cell(a), cell(b)]
                          void patchModule(m.id, {
                            [imageColumn(group, a)]: two.img,
                            [captionColumn(group, a)]: two.cap,
                            [imageColumn(group, b)]: one.img,
                            [captionColumn(group, b)]: one.cap,
                          })
                        }}
                        onPlace={(slot, url) =>
                          void patchModule(m.id, { [imageColumn(group, slot)]: url })
                        }
                      />
                    ))}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        borderTop: '1px solid #E8E2CE',
                        paddingTop: 14,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: sans,
                          fontSize: 10,
                          fontWeight: 500,
                          letterSpacing: '.18em',
                          textTransform: 'uppercase',
                          color: ink.muted,
                        }}
                      >
                        Bài trong module
                      </div>
                      {/*
                        Writing a post starts in one place. This list is for
                        reading the order and changing it, so the button hands
                        over to the wizard rather than dropping a blank draft
                        in from the side.
                      */}
                      <Button
                        size="sm"
                        onClick={() => nav.newPost()}
                        icon={<IconPlus size={14} />}
                      >
                        Bài mới
                      </Button>
                    </div>

                    {entries.map((e, i) => (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={() => setDragEntry(e.id)}
                        onDragOver={(ev) => ev.preventDefault()}
                        onDrop={(ev) => {
                          ev.preventDefault()
                          void dropEntry(m.id, e.id)
                        }}
                        onDragEnd={() => setDragEntry(null)}
                        style={{
                          display: 'grid',
                          // Titles are short names; descriptions are sentences,
                          // and the ones that got cut off were always these.
                          gridTemplateColumns: '44px minmax(0,0.72fr) minmax(0,1.6fr) 74px 48px',
                          gap: 10,
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid #EFEADA',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Hover
                            title="Kéo để đổi thứ tự"
                            style={{ lineHeight: 0, color: ink.faint, cursor: 'grab' }}
                            hoverStyle={{ color: ink.base }}
                          >
                            <IconDrag size={14} />
                          </Hover>
                          <div style={{ fontFamily: sans, fontSize: 10.5, letterSpacing: '.12em', color: ink.faint }}>
                            {displayNumber(i)}
                          </div>
                        </div>
                        <input
                          defaultValue={e.en}
                          onBlur={(ev) => void patchPost(e.id, { en: ev.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'transparent',
                            border: 0,
                            color: ink.base,
                            fontFamily: sans,
                            fontSize: 13.5,
                            padding: '4px 2px',
                            outline: 'none',
                          }}
                        />
                        <input
                          defaultValue={e.vi}
                          onBlur={(ev) => void patchPost(e.id, { vi: ev.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'transparent',
                            border: 0,
                            color: ink.soft,
                            fontFamily: sans,
                            fontWeight: 300,
                            fontSize: 13,
                            padding: '4px 2px',
                            outline: 'none',
                          }}
                        />
                        <input
                          defaultValue={e.date_label}
                          onBlur={(ev) => void patchPost(e.id, { date_label: ev.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'transparent',
                            border: 0,
                            color: ink.muted,
                            fontFamily: sans,
                            fontSize: 12,
                            padding: '4px 2px',
                            outline: 'none',
                          }}
                        />
                        <IconButton
                          size="sm"
                          level="danger"
                          label={`Bỏ “${e.en}” khỏi module`}
                          onClick={() => void removeEntry(e.id)}
                        >
                          <IconClose size={14} />
                        </IconButton>
                      </div>
                    ))}

                  </div>
                )}
              </div>
            )
          })}

          <div id="admin" style={{ ...sectionHead, margin: '44px 0 18px', scrollMarginTop: 64 }}>{copy.sections.Admin}</div>
          <div style={grid(two, 20)}>
            <Field label="Design system — tiêu đề dòng 1">
              <input
                {...field('artT1')}
                style={{ ...serifInput, fontSize: 20 }}
              />
            </Field>
            <Field label="Design system — tiêu đề dòng 2 (nghiêng, xanh)">
              <input
                {...field('artT2')}
                style={{ ...serifItalicInput, fontSize: 20 }}
              />
            </Field>
            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Design system — đoạn dẫn">
                <textarea
                  {...field('artIntro')}
                  rows={3}
                  style={area}
                />
              </Field>
            </div>
            <Field label="System conventions — tiêu đề">
              <input
                {...field('logicTitle')}
                style={{ ...serifInput, fontSize: 20 }}
              />
            </Field>
            <Field label="System conventions — đoạn dẫn">
              <textarea
                {...field('logicIntro')}
                rows={2}
                style={area}
              />
            </Field>
            <Field label="Content — tiêu đề">
              <input
                {...field('cmsTitle')}
                style={{ ...serifInput, fontSize: 20 }}
              />
            </Field>
            <Field label="Content — đoạn dẫn">
              <textarea
                {...field('cmsIntro')}
                rows={2}
                style={area}
              />
            </Field>
          </div>

          {/*
            The most destructive control on the screen was the faintest thing
            on it — 10.5px in `ink.faint`, styled as a footnote, and it wiped
            every copy field on the site with no way back. It asks first now,
            and the question is a second press rather than a `confirm()` the
            browser can suppress.
          */}
          <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {resetting ? (
              <>
                <span style={{ fontFamily: sans, fontSize: 12.5, color: ink.danger }}>
                  Xoá mọi chữ đã sửa trên toàn bộ trang, không hoàn tác được. Chắc chưa?
                </span>
                <Button
                  level="danger"
                  onClick={async () => {
                    setResetting(false)
                    // Every field back to its shipped default: clear the whole blob.
                    try {
                      setSite(await updateSite(Object.fromEntries(
                        Object.keys(SITE_DEFAULTS)
                          .filter((k) => k !== 'sections')
                          .map((k) => [k, '']),
                      ) as SiteOverrides))
                      await load()
                      toast.ok('Đã trả toàn bộ nội dung về bản gốc')
                    } catch (e) {
                      toast.fromError(e)
                    }
                  }}
                >
                  Xoá hết, trả về gốc
                </Button>
                <Button onClick={() => setResetting(false)}>Thôi</Button>
              </>
            ) : (
              <Button level="danger" onClick={() => setResetting(true)}>
                Trả về nội dung gốc…
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
