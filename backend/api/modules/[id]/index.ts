import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCors } from '../../../lib/cors.js'
import { requireAuth } from '../../../lib/auth.js'
import { getSupabase } from '../../../lib/supabase.js'
import {
  canReparent,
  MODULE_LAYOUTS,
  MODULE_PATCHABLE,
  toModule,
  type ModuleRow,
  type ParentedRow,
} from '../../../lib/modules.js'

function getId(req: VercelRequest): string | null {
  const raw = req.query.id
  const id = Array.isArray(raw) ? raw[0] : raw
  return typeof id === 'string' && id.length > 0 ? id : null
}

async function handlePatch(req: VercelRequest, res: VercelResponse, id: string): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  for (const { jsonKey, column } of MODULE_PATCHABLE) {
    if (Object.prototype.hasOwnProperty.call(body, jsonKey)) patch[column] = body[jsonKey]
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'No editable fields in body' })
    return
  }
  if (patch.layout !== undefined && !MODULE_LAYOUTS.includes(patch.layout as never)) {
    res.status(400).json({ error: `layout must be one of: ${MODULE_LAYOUTS.join(', ')}` })
    return
  }

  const supabase = getSupabase()

  /*
   * Filing a module inside another one is the one edit that can break the
   * table of contents rather than just change it: a loop leaves a branch no
   * walk can climb out of, and the foreign key cannot see one coming.
   *
   * The whole tree has to be read to answer it — there are a handful of rows,
   * and the alternative is finding out from a page that will not render.
   */
  if (Object.prototype.hasOwnProperty.call(patch, 'parent_id')) {
    const raw = patch.parent_id
    if (raw !== null && typeof raw !== 'string') {
      res.status(400).json({ error: 'parent_id must be a module id or null' })
      return
    }
    // An empty string is what a cleared <select> sends; it means "no parent",
    // not a module whose id is the empty string.
    const parentId = raw === null || raw === '' ? null : raw
    patch.parent_id = parentId

    const { data: tree, error: treeError } = await supabase.from('modules').select('id, parent_id')
    if (treeError) {
      res.status(500).json({ error: treeError.message })
      return
    }

    const verdict = canReparent((tree ?? []) as ParentedRow[], id, parentId)
    if (!verdict.ok) {
      res.status(400).json({ error: verdict.reason })
      return
    }
  }

  const { data, error } = await supabase.from('modules').update(patch).eq('id', id).select('*').maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: `Module '${id}' not found` })
    return
  }
  res.status(200).json({ module: toModule(data as ModuleRow) })
}

/**
 * DELETE removes the module outright. `posts.module_id` is ON DELETE CASCADE
 * (migration 0001), so its posts go with it — the CMS only offers this on
 * modules the reader can't see yet, and the site's undo story is the ✕ being
 * one click away from a re-add, not a trash can.
 *
 * Modules filed inside it are the exception: `parent_id` is ON DELETE RESTRICT
 * (migration 0025), because a branch holds whole sub-sections of published
 * writing and one ✕ must not take them all. The database refuses; this turns
 * that refusal into a sentence saying what to do about it.
 */
async function handleDelete(res: VercelResponse, id: string): Promise<void> {
  const supabase = getSupabase()

  const { data: children, error: childError } = await supabase
    .from('modules')
    .select('id')
    .eq('parent_id', id)

  // `42703` is Postgres for "no such column": the database has not run 0025
  // yet, so no module can be inside another one and there is nothing to guard.
  // Refusing every delete until a migration lands would be the worse failure.
  if (childError && childError.code !== '42703') {
    res.status(500).json({ error: childError.message })
    return
  }
  if (children && children.length > 0) {
    res.status(409).json({
      error: `Module '${id}' still holds ${children.length} module(s). Move or delete them first.`,
    })
    return
  }

  const { data, error } = await supabase.from('modules').delete().eq('id', id).select('id').maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: `Module '${id}' not found` })
    return
  }
  res.status(204).end()
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireAuth(req, res)) return

  const id = getId(req)
  if (!id) {
    res.status(400).json({ error: 'Missing module id' })
    return
  }

  if (req.method === 'PATCH') return handlePatch(req, res, id)
  if (req.method === 'DELETE') return handleDelete(res, id)

  res.status(405).json({ error: 'Method not allowed' })
}

export default withCors(handler)
