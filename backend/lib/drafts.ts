// Pending edits of a published post — see migration 0028.
//
// A published post keeps two versions: the `posts` row is what the site shows,
// and a `post_drafts` row holds the fields edited since, under the same column
// names. The editor's autosave writes there; Publish copies them across.

import { firstImageIn } from './posts.js'
import type { getSupabase } from './supabase.js'

type Supabase = ReturnType<typeof getSupabase>

/**
 * The fields that are the post's content — what a reader would see change.
 *
 * Everything else a PATCH can carry is filing, not content: `module_id` (moved
 * from the list's menu), `sort_order` (a drag in the list), `pinned`. Those
 * still apply at once, because holding a drag back until the next Publish
 * would look to the owner like the drag had failed.
 */
export const DRAFT_FIELDS = [
  'en',
  'vi',
  'body',
  'theme_color',
  'hero_image_url',
  'hero_caption',
  'plate_images',
  'lead',
  'pull_quote',
  'further_reading',
  'date_label',
] as const

export function splitDraftPatch(patch: Record<string, unknown>): {
  content: Record<string, unknown>
  rest: Record<string, unknown>
} {
  const content: Record<string, unknown> = {}
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if ((DRAFT_FIELDS as readonly string[]).includes(key)) content[key] = value
    else rest[key] = value
  }
  return { content, rest }
}

/**
 * The table is not there yet — migration 0028 has not been run.
 *
 * The API must keep working in that window, the way it did before: edits go
 * straight to `posts`. A deploy landing before the SQL is run would otherwise
 * stop every autosave dead.
 */
export function isMissingDraftTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  return e.code === '42P01' || e.code === 'PGRST205' || /post_drafts/.test(e.message ?? '')
}

function asFields(value: unknown): Record<string, unknown> | null {
  const data = (value as { data?: unknown } | null)?.data
  return data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0
    ? (data as Record<string, unknown>)
    : null
}

/** The pending edits of a post, or null when it has none (or the table is missing). */
export async function readDraft(
  supabase: Supabase,
  id: string,
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const { data, error } = await supabase.from('post_drafts').select('data').eq('post_id', id).maybeSingle()
  if (error) return { data: null, error: isMissingDraftTable(error) ? null : error }
  return { data: asFields(data), error: null }
}

/**
 * Merge `content` into the post's pending edits.
 *
 * Read then write: PostgREST has no jsonb merge in an upsert, and one owner
 * editing one post means two autosaves never race on the same row in practice.
 * Returns `missing: true` when the table does not exist, so the caller can fall
 * back to writing `posts`.
 */
export async function writeDraft(
  supabase: Supabase,
  id: string,
  content: Record<string, unknown>,
  nowIso: string,
): Promise<{ missing: boolean; error: unknown }> {
  const current = await readDraft(supabase, id)
  if (current.error) return { missing: false, error: current.error }
  const { error } = await supabase
    .from('post_drafts')
    .upsert({ post_id: id, data: { ...(current.data ?? {}), ...content }, updated_at: nowIso }, { onConflict: 'post_id' })
  if (error) return { missing: isMissingDraftTable(error), error: isMissingDraftTable(error) ? null : error }
  return { missing: false, error: null }
}

/**
 * Copy a post's pending edits into `posts` and drop them — what Publish does.
 *
 * `applied` is false when there was nothing pending. `thumbnail_url` follows
 * `body` here for the same reason it does in PATCH: it is derived, and this is
 * now a second route that changes `body` on a live post.
 */
export async function foldDraft(
  supabase: Supabase,
  id: string,
  nowIso: string,
): Promise<{ applied: boolean; error: unknown }> {
  const pending = await readDraft(supabase, id)
  if (pending.error) return { applied: false, error: pending.error }
  if (!pending.data) return { applied: false, error: null }

  const { content } = splitDraftPatch(pending.data)
  const patch: Record<string, unknown> = { ...content, updated_at: nowIso }
  if (Object.prototype.hasOwnProperty.call(content, 'body')) patch.thumbnail_url = firstImageIn(content.body)

  const { error } = await supabase.from('posts').update(patch).eq('id', id)
  if (error) return { applied: false, error }
  const { error: dropError } = await supabase.from('post_drafts').delete().eq('post_id', id)
  if (dropError) return { applied: true, error: dropError }
  return { applied: true, error: null }
}
