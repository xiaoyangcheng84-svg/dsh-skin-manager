/**
 * dsh-skin-manager — host half.
 *
 * Discovers every installed skin (packages under the web profile's
 * node_modules that carry a `skin.json` with the standard fields), rewrites
 * the profile-level `cordis.patch.yml` to make exactly one skin active
 * (mutually exclusive insert / disabled rows), and serves each skin's
 * prebuilt client bundle for the browser half.
 *
 * The profile patch file is watched by DSH's config watcher
 * (`watchUserPatches` + config-only HMR), so a switch takes effect within
 * seconds without restarting dsh web; the browser refreshes to pick up the
 * new boot graph.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ui-skin-manager'

/** API prefix for the browser half. */
export const API_PREFIX = '/api/skin-manager'

/** Managed section markers inside the profile cordis.patch.yml. */
export const MANAGED_START = '# --- dsh-skin-manager managed (auto-generated; do not edit) ---'
export const MANAGED_END = '# --- end dsh-skin-manager managed ---'

/** Skin registry field name inside each skin package. */
const SKIN_JSON = 'skin.json'

/** Skins whose loader entry ids are known to be `ui-skin-*`. */
const SKIN_ROW_ID_PREFIX = 'ui-skin-'

/**
 * Resolve the web profile directory: $DSH_SKIN_PROFILE / $DSH_PROFILE /
 * `web` (the GUI profile). Mirrors the dsh launcher's resolution.
 */
function profileDir() {
  const env = process.env.DSH_SKIN_PROFILE || process.env.DSH_PROFILE || 'web'
  const home = process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || '', '.dsh')
  return join(home, 'profiles', env)
}

/** Absolute path of the profile-level patch file. */
function patchFile(dir) {
  return join(dir, 'cordis.patch.yml')
}

/** Read a package's skin.json, or null when it is not a skin package. */
function readSkinMeta(dir, packageName) {
  const base = join(dir, 'node_modules', packageName)
  try {
    const raw = JSON.parse(readFileSync(join(base, SKIN_JSON), 'utf8'))
    if (typeof raw !== 'object' || raw === null) return null
    const id = typeof raw.id === 'string' ? raw.id : null
    const pkg = typeof raw.package === 'string' ? raw.package : packageName
    if (id === null || pkg === null) return null
    return {
      id,
      name: typeof raw.name === 'string' ? raw.name : id,
      nameEn: typeof raw.nameEn === 'string' ? raw.nameEn : id,
      tagline: typeof raw.tagline === 'string' ? raw.tagline : '',
      accent: typeof raw.accent === 'string' ? raw.accent : '#888888',
      author: typeof raw.author === 'string' ? raw.author : '',
      description: typeof raw.description === 'string' ? raw.description : '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      bodyAttr: typeof raw.bodyAttr === 'string' ? raw.bodyAttr : '',
      package: pkg,
      order: typeof raw.order === 'number' ? raw.order : 1000,
      preview: raw.preview && typeof raw.preview === 'object' ? raw.preview : null,
      wiring: raw.wiring && typeof raw.wiring === 'object' ? raw.wiring : null,
    }
  } catch {
    return null
  }
}

/** Whether a skin package has a prebuilt client bundle. */
function hasClientBundle(dir, packageName) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'node_modules', packageName, 'package.json'), 'utf8'))
    const client = manifest.exports?.['./client']
    if (typeof client === 'string') return existsSync(join(dir, 'node_modules', packageName, client))
    if (client && typeof client.default === 'string') return existsSync(join(dir, 'node_modules', packageName, client.default))
    return existsSync(join(dir, 'node_modules', packageName, 'lib', 'client.js'))
  } catch {
    return false
  }
}

/**
 * Enumerate every installed skin package. Skins are packages carrying
 * skin.json; the registry is discovered dynamically so newly installed skins
 * appear without regenerating anything.
 */
export function listSkins(dir = profileDir()) {
  const root = join(dir, 'node_modules')
  if (!existsSync(root)) return []
  const found = []
  const seen = new Set()

  const consider = (packageName) => {
    if (seen.has(packageName)) return
    seen.add(packageName)
    const meta = readSkinMeta(dir, packageName)
    if (meta === null) return
    if (!hasClientBundle(dir, packageName)) return
    found.push({ ...meta, installed: true })
  }

  // Top-level packages (dsh-better-sidebar, dsh-skin, ...).
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    consider(entry.name)
  }
  // Scoped packages (@scope/name).
  const scoped = join(root, '@dsh-external')
  if (existsSync(scoped)) {
    for (const entry of readdirSync(scoped, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      consider(`@dsh-external/${entry.name}`)
    }
  }
  const anyScope = join(root, '@')
  if (existsSync(anyScope)) {
    for (const scope of readdirSync(anyScope, { withFileTypes: true })) {
      if (!scope.isDirectory()) continue
      const scopeDir = join(anyScope, scope.name)
      for (const entry of readdirSync(scopeDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        consider(`${scope.name}/${entry.name}`)
      }
    }
  }

  found.sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.name.localeCompare(b.name))
  return found
}

/** Loader entry id for a skin's patch row. */
function rowIdFor(skin) {
  if (skin.wiring && typeof skin.wiring.id === 'string' && skin.wiring.id !== '') return skin.wiring.id
  return `${SKIN_ROW_ID_PREFIX}${skin.id}`
}

/** Which skin is currently active (the enabled insert row in the patch). */
export function currentActive(dir = profileDir()) {
  const file = patchFile(dir)
  let content = ''
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  // The active skin is the one whose row id is NOT disabled and is inserted.
  const disabled = new Set()
  for (const m of content.matchAll(/^- id: (ui-skin-[a-z0-9-]+)\n\s*disabled: true/gm)) {
    disabled.add(m[1])
  }
  const inserted = []
  for (const m of content.matchAll(/-\s+id:\s*(ui-skin-[a-z0-9-]+)/g)) {
    if (!disabled.has(m[1])) inserted.push(m[1])
  }
  if (inserted.length === 0) return null
  const activeId = inserted[inserted.length - 1]
  // Map row id back to the skin id (strip the ui-skin- prefix).
  return activeId.startsWith(SKIN_ROW_ID_PREFIX) ? activeId.slice(SKIN_ROW_ID_PREFIX.length) : activeId
}

/**
 * Render the managed patch section for one active skin (null = official
 * stock look: every skin disabled, no insert row).
 */
export function renderManaged(activeSkin, skins) {
  const lines = [MANAGED_START]
  for (const skin of skins) {
    if (skin.id === activeSkin?.id) continue
    lines.push(`- id: ${rowIdFor(skin)}`, '  disabled: true')
  }
  if (activeSkin !== null && activeSkin !== undefined) {
    lines.push('- insert:', `    - id: ${rowIdFor(activeSkin)}`, `      name: '${activeSkin.package}'`)
  }
  lines.push(MANAGED_END)
  return lines.join('\n')
}

/**
 * Strip any previous managed section and legacy hand-written skin insert rows
 * from the patch content, preserving every other user patch row (e.g.
 * dsh-market). A legacy skin row is an `- insert:` block whose `name` resolves
 * to a discovered skin package — the skin manager owns those rows now.
 */
function stripManaged(content, skins) {
  // Remove the managed block.
  const start = content.indexOf(MANAGED_START)
  if (start !== -1) {
    const end = content.indexOf(MANAGED_END, start)
    if (end !== -1) {
      content = content.slice(0, start) + content.slice(end + MANAGED_END.length)
    } else {
      content = content.slice(0, start)
    }
  }
  // Remove legacy hand-written skin insert rows (id ui-skin-* whose name is a
  // discovered skin package). Keep everything else (dsh-market, future rows).
  const skinNames = new Set(skins.map((s) => s.package))
  const skinIds = new Set(skins.map((s) => rowIdFor(s)))
  const lines = content.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed === '- insert:') {
      // Look ahead for the id/name pair inside this block.
      let j = i + 1
      let id = null
      let name = null
      while (j < lines.length && /^\s+-\s+id:/.test(lines[j])) {
        const idm = /^\s+-\s+id:\s*(\S+)/.exec(lines[j])
        if (idm) id = idm[1]
        if (j + 1 < lines.length && /^\s+name:/.test(lines[j + 1])) {
          const nm = /^\s+name:\s*['"]?([^'"\s]+)['"]?\s*$/.exec(lines[j + 1])
          if (nm) name = nm[1]
          j += 2
        } else {
          j += 1
        }
      }
      const isSkin = (id !== null && skinIds.has(id)) || (name !== null && skinNames.has(name))
      if (isSkin) {
        // Skip the whole insert block (the - insert: line through the last
        // nested id/name pair).
        i = j
        continue
      }
    }
    out.push(line)
    i += 1
  }
  return out.join('\n')
}

/** Apply a skin switch by rewriting the profile patch file atomically. */
export function applySkin(skin, dir = profileDir()) {
  const file = patchFile(dir)
  const skins = listSkins(dir)
  const active = skin === null ? null : skins.find(s => s.id === skin.id || s.package === skin.package)
  if (skin !== null && active === undefined) throw new Error(`skin not installed: ${skin}`)

  let content = ''
  try {
    content = readFileSync(file, 'utf8')
  } catch { /* new file */ }

  // Remove the old managed block + legacy skin rows, keep the rest.
  content = stripManaged(content, skins).replace(/\s+$/, '\n')
  const next = `${content}\n${renderManaged(active, skins)}\n`

  // Atomic replace so the config watcher only ever sees complete content.
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, next, 'utf8')
  renameSync(tmp, file)
  return active
}

/** Serve a skin's prebuilt client bundle (same-origin script). */
export function bundlePathFor(skin, dir = profileDir()) {
  const base = join(dir, 'node_modules', skin.package)
  const manifest = JSON.parse(readFileSync(join(base, 'package.json'), 'utf8'))
  const client = manifest.exports?.['./client']
  if (typeof client === 'string') return join(base, client)
  if (client && typeof client.default === 'string') return join(base, client.default)
  return join(base, 'lib', 'client.js')
}

/** Read a skin's client bundle text. */
export function readBundle(skin, dir = profileDir()) {
  return readFileSync(bundlePathFor(skin, dir), 'utf8')
}

/** Build the HTTP routes for the browser half. */
export function makeRoutes() {
  const dir = profileDir()
  const sendJson = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }
  const sameOrigin = (req) => {
    const origin = req.headers.origin
    const host = req.headers.host
    if (origin === undefined || host === undefined) return false
    try {
      const parsed = new URL(origin)
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
    } catch {
      return false
    }
  }

  return [
    {
      kind: 'exact',
      path: `${API_PREFIX}/list`,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { allow: 'GET' }); res.end(); return
        }
        const skins = listSkins(dir)
        const active = currentActive(dir)
        sendJson(res, 200, { active, skins })
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/bundle`,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { allow: 'GET' }); res.end(); return
        }
        const url = new URL(req.url ?? '/', 'http://x')
        const id = url.searchParams.get('id') ?? ''
        const skin = listSkins(dir).find(s => s.id === id || s.package === id)
        if (skin === undefined) {
          sendJson(res, 404, { error: 'skin not found' }); return
        }
        try {
          const body = readBundle(skin, dir)
          res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' })
          res.end(body)
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/apply`,
      handler: (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' }); res.end(); return
        }
        if (!sameOrigin(req)) {
          sendJson(res, 403, { error: 'untrusted origin' }); return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const parsed = body === '' ? {} : JSON.parse(body)
            const id = typeof parsed.id === 'string' ? parsed.id : null
            const skins = listSkins(dir)
            const target = id === null || id === 'official' ? null : skins.find(s => s.id === id || s.package === id)
            if (id !== null && id !== 'official' && target === undefined) {
              sendJson(res, 400, { error: 'skin not installed' }); return
            }
            const applied = applySkin(target, dir)
            sendJson(res, 200, { ok: true, active: applied?.id ?? null })
          } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
        })
      },
    },
  ]
}

/** Host loader entry: mount the routes. */
export function apply(ctx) {
  const routes = makeRoutes()
  try {
    ctx.effect(() => {
      const disposers = []
      try {
        for (const route of routes) disposers.push(ctx.webServer.register(route))
      } catch (error) {
        for (const dispose of disposers) dispose()
        throw error
      }
      return () => { for (const dispose of disposers) dispose() }
    }, 'ui-skin-manager: routes')
  } catch (error) {
    console.error('[ui-skin-manager] route registration failed:', error)
  }
}

/** Required services: the host webserver for the API routes. */
export const inject = ['webServer']
