#!/usr/bin/env node
// Browser harness for the Team Aaron weekly manager review.
// Launch owns a Vite process. Drive owns a Playwright page. Cleanup kills only those pids.
// Evidence under artifacts/verify-sales-dashboard/<run-id>/ is never deleted.

import { spawn, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const TMP_ROOT = '/tmp/verify-sales-dashboard'
const TITLE = 'Team Aaron · Weekly manager review'
const HEADING = 'Weekly manager review'
const HELPERS_PREFIX = '.cursor/skills/verify-sales-dashboard/helpers'

const LOCAL_COMMANDS = new Set([
  'launch',
  'doctor',
  'cleanup',
  'paths',
  'sha256',
  'expect-sha256',
  'help',
  '--help',
])

const DRIVE_COMMANDS = new Set([
  'open',
  'click',
  'check',
  'select',
  'fill',
  'set-files',
  'expect-text',
  'expect-exact',
  'expect-absent',
  'expect-count',
  'expect-value',
  'expect-row',
  'expect-checked',
  'expect-unchecked',
  'expect-enabled',
  'expect-disabled',
  'screenshot',
  'aria',
  'text',
])

let playwrightModule

function printHelp() {
  console.log(`Usage: node ${HELPERS_PREFIX}/verify.mjs <command> [flags]

Local:
  launch
  doctor
  paths
  sha256 --file <repo-relative> --name <id>
  expect-sha256 --file <repo-relative> --name <id>
  cleanup

Drive (one shared browser; "open" reloads / and drops in-memory imports):
  open
  click --role <role> --name <name>
  check --role radio --name <name>
  select --label <label> --value <option-value>
  fill --label <label> --value <text>
  set-files --label <label> --file <repo-relative>
  expect-text --text <text> [--scope <scope>] [--exact]
  expect-exact --scope <scope> --text <text>
  expect-absent --text <text> [--scope <scope>]
  expect-count --text <text> --count <n> [--scope <scope>] [--exact]
  expect-value --label <label> --value <value>
  expect-row --scope <scope> --row <text> --text <text>
  expect-checked --role radio --name <name>
  expect-unchecked --role radio --name <name>
  expect-enabled --role <role> --name <name>
  expect-disabled --role <role> --name <name>
  screenshot --name <id> [--scope <scope>]
  aria --name <id> [--scope <scope>]
  text --name <id> [--scope <scope>]

Scope is a region accessible name (Monthly sales), css:.hero__week, figure:Sell-out share · Nov 2026, or role:contentinfo.
Default port is 4174. Set VERIFY_PORT and VERIFY_RUN_ID to run beside another instance.
`)
}

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next == null || next.startsWith('--')) flags[key] = true
    else {
      flags[key] = next
      i++
    }
  }
  return { positional, flags }
}

function assertSafeId(id) {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(`unsafe run id: ${id}`)
}

function newRunId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `run-${stamp}-${Math.random().toString(36).slice(2, 6)}`
}

function runPaths(runId) {
  assertSafeId(runId)
  const dir = path.join(TMP_ROOT, runId)
  return {
    runId,
    dir,
    runFile: path.join(dir, 'run.json'),
    serverLog: path.join(dir, 'server.log'),
    serverPidFile: path.join(dir, 'server.pid'),
    driveLog: path.join(dir, 'drive.log'),
    drivePidFile: path.join(dir, 'drive.pid'),
    sock: path.join(dir, 'drive.sock'),
    evidenceDir: path.join(repoRoot, 'artifacts', 'verify-sales-dashboard', runId),
    baseUrl: '',
    port: 0,
    serverPid: 0,
    ready: false,
  }
}

function latestFile() {
  return path.join(TMP_ROOT, 'latest-run-id')
}

function resolveRunId(required = true) {
  const fromEnv = process.env.VERIFY_RUN_ID
  if (fromEnv) {
    assertSafeId(fromEnv)
    return fromEnv
  }
  if (fs.existsSync(latestFile())) {
    const id = fs.readFileSync(latestFile(), 'utf8').trim()
    assertSafeId(id)
    return id
  }
  if (!required) return null
  throw new Error('No verification run. Run launch first, or set VERIFY_RUN_ID.')
}

function saveRun(run) {
  fs.mkdirSync(run.dir, { recursive: true })
  fs.writeFileSync(run.runFile, JSON.stringify(run, null, 2) + '\n')
}

function loadRun() {
  const runId = resolveRunId()
  const file = path.join(TMP_ROOT, runId, 'run.json')
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`)
  const run = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (process.env.VERIFY_BASE_URL && process.env.VERIFY_BASE_URL !== run.baseUrl) {
    throw new Error(
      `VERIFY_BASE_URL=${process.env.VERIFY_BASE_URL} does not match launched base_url=${run.baseUrl}. Refusing to drive a different server.`,
    )
  }
  return run
}

function chosenPort() {
  if (!process.env.VERIFY_PORT) return 4174
  const port = Number(process.env.VERIFY_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('VERIFY_PORT is not a TCP port')
  return port
}

function cmdline(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`).toString().replace(/\0/g, ' ').trim()
  } catch {
    return ''
  }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function tail(file, n) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return ''
  }
}

function listeningPids(port) {
  let out = ''
  try {
    out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  } catch (err) {
    if (err.status === 1) return []
    throw err
  }
  const pids = new Set()
  for (const line of out.split('\n').slice(1)) {
    const pid = Number(line.trim().split(/\s+/)[1])
    if (Number.isInteger(pid)) pids.add(pid)
  }
  return [...pids]
}

function isDescendant(ancestor, pid) {
  let current = pid
  const seen = new Set()
  while (current > 1 && !seen.has(current)) {
    if (current === ancestor) return true
    seen.add(current)
    let status = ''
    try {
      status = fs.readFileSync(`/proc/${current}/status`, 'utf8')
    } catch {
      return false
    }
    const match = /^PPid:\s+(\d+)/m.exec(status)
    if (!match) return false
    current = Number(match[1])
  }
  return false
}

function assertUnder(dir, root) {
  const resolved = path.resolve(dir)
  const base = path.resolve(root)
  if (resolved === base || !resolved.startsWith(base + path.sep)) {
    throw new Error(`refusing to remove ${resolved}`)
  }
}

function evidenceFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).sort()
}

function journal(run, entry) {
  fs.mkdirSync(run.evidenceDir, { recursive: true })
  fs.appendFileSync(
    path.join(run.evidenceDir, 'journal.jsonl'),
    JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n',
  )
}

function sha256File(file) {
  const abs = path.resolve(repoRoot, file)
  if (!file || path.isAbsolute(file) || file.split(/[/\\]/).includes('..')) {
    throw new Error(`--file must be a repo-relative path: ${file}`)
  }
  if (!abs.startsWith(repoRoot + path.sep)) throw new Error(`--file escapes the repo: ${file}`)
  if (!fs.existsSync(abs)) throw new Error(`file not found: ${abs}`)
  const hash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
  return { abs, hash }
}

function hashesPath(run) {
  return path.join(run.evidenceDir, 'hashes.json')
}

function readHashes(run) {
  const file = hashesPath(run)
  if (!fs.existsSync(file)) return {}
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeHash(run, name, file, hash) {
  if (!name) throw new Error('missing --name')
  const all = readHashes(run)
  all[name] = { file, hash }
  fs.mkdirSync(run.evidenceDir, { recursive: true })
  fs.writeFileSync(hashesPath(run), JSON.stringify(all, null, 2) + '\n')
}

async function loadPlaywright() {
  if (playwrightModule) return playwrightModule
  try {
    playwrightModule = await import('playwright')
  } catch {
    console.error('Playwright is not installed for the verification helper.')
    console.error(`From the repo root, run:`)
    console.error(`  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --prefix ${HELPERS_PREFIX}`)
    process.exit(1)
  }
  return playwrightModule
}

async function launchBrowser() {
  const { chromium } = await loadPlaywright()
  const mode = process.env.VERIFY_BROWSER || 'auto'
  const options = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  }
  const chromiumHint =
    `npm exec --prefix ${HELPERS_PREFIX} -- playwright install chromium\nThen set VERIFY_BROWSER=chromium`
  if (mode === 'chromium') return chromium.launch(options)
  try {
    return await chromium.launch({ ...options, channel: 'chrome' })
  } catch (err) {
    if (mode === 'chrome') {
      throw new Error(`Chrome channel failed: ${err.message}\n${chromiumHint}`)
    }
    try {
      return await chromium.launch(options)
    } catch (err2) {
      throw new Error(
        `Could not launch Google Chrome (${err.message}) or bundled Chromium (${err2.message}).\n${chromiumHint}`,
      )
    }
  }
}

async function openDashboard(page, baseUrl, timeoutMs) {
  await page.goto(new URL('/', baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  })
  try {
    await page.getByRole('heading', { level: 1, name: HEADING }).waitFor({ state: 'visible', timeout: timeoutMs })
    await page.getByRole('region', { name: 'Import raw data', exact: true }).waitFor({ state: 'visible', timeout: timeoutMs })
    await page.getByRole('region', { name: 'Weekly scorecard', exact: true }).waitFor({ state: 'visible', timeout: timeoutMs })
    await page.getByRole('region', { name: 'Monthly sales', exact: true }).waitFor({ state: 'visible', timeout: timeoutMs })
  } catch (err) {
    const body = await page.locator('body').innerText().catch(() => '')
    throw new Error(`${err.message}\nbody:\n${body.slice(0, 800)}`)
  }
  const body = await page.locator('body').innerText()
  if (body.includes('Loading weekly review')) throw new Error('dashboard is still on Loading weekly review…')
  if (body.includes('Could not load sales data')) throw new Error(body.slice(0, 500))
}

function browserContextOptions() {
  return {
    locale: 'en-HK',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  }
}

async function assertHttp(run) {
  let htmlRes
  try {
    htmlRes = await fetch(run.baseUrl + '/')
  } catch (err) {
    throw new Error(`GET / failed: ${err.message}`)
  }
  if (!htmlRes.ok) throw new Error(`GET / returned ${htmlRes.status}`)
  const html = await htmlRes.text()
  if (!html.includes(`<title>${TITLE}</title>`)) {
    const error = new Error(`title is not ${TITLE}`)
    error.fatal = true
    throw error
  }
  const seedRes = await fetch(run.baseUrl + '/data/sales-line-items.json')
  if (!seedRes.ok) throw new Error(`GET seed returned ${seedRes.status}`)
  const served = Buffer.from(await seedRes.arrayBuffer())
  const disk = fs.readFileSync(path.join(repoRoot, 'public/data/sales-line-items.json'))
  const servedHash = crypto.createHash('sha256').update(served).digest('hex')
  const diskHash = crypto.createHash('sha256').update(disk).digest('hex')
  if (servedHash !== diskHash) {
    const error = new Error(`served seed does not match checkout\nserved=${servedHash}\ndisk=${diskHash}`)
    error.fatal = true
    throw error
  }
  const listeners = listeningPids(run.port)
  if (listeners.length === 0) throw new Error(`nothing is listening on ${run.port}`)
  const owned = listeners.every((pid) => pid === run.serverPid || isDescendant(run.serverPid, pid))
  if (!owned) {
    const error = new Error(
      `port ${run.port} is not owned by server pid ${run.serverPid}: ${listeners
        .map((pid) => `${pid} ${cmdline(pid)}`)
        .join(' | ')}`,
    )
    error.fatal = true
    throw error
  }
  return {
    servedHash,
    lineItems: JSON.parse(disk.toString()).lineItems.length,
    listenerPid: listeners[0],
  }
}

async function waitForHttp(run, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = 'starting'
  while (Date.now() < deadline) {
    if (!alive(run.serverPid)) {
      throw new Error(`vite exited before it was usable\n${tail(run.serverLog, 50)}`)
    }
    try {
      return await assertHttp(run)
    } catch (err) {
      if (err.fatal) throw err
      last = err.message
      await delay(300)
    }
  }
  throw new Error(`HTTP not ready at ${run.baseUrl}: ${last}\n${tail(run.serverLog, 50)}`)
}

async function collectDoctor(run) {
  if (!run.ready && !alive(run.serverPid)) throw new Error('server is not running')
  const http = await assertHttp(run)
  const browser = await launchBrowser()
  try {
    const context = await browser.newContext(browserContextOptions())
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    page.setDefaultNavigationTimeout(60000)
    await openDashboard(page, run.baseUrl, 60000)
    const heading = (await page.getByRole('heading', { level: 1 }).innerText()).trim()
    if (heading !== HEADING) throw new Error(`heading is ${JSON.stringify(heading)}`)
    const language = await page.evaluate(() => navigator.language)
    const viewport = page.viewportSize()
    if (!language.toLowerCase().startsWith('en-hk')) throw new Error(`navigator.language is ${language}, expected en-HK`)
    if (!viewport || viewport.width !== 1440 || viewport.height !== 900) {
      throw new Error(`viewport is ${viewport && viewport.width}x${viewport && viewport.height}, expected 1440x900`)
    }
    const lines = [
      'ok',
      `run_id=${run.runId}`,
      `base_url=${run.baseUrl}`,
      `port=${run.port}`,
      `server_pid=${run.serverPid}`,
      `listener_pid=${http.listenerPid}`,
      `title=${TITLE}`,
      `heading=${heading}`,
      `seed_sha256=${http.servedHash}`,
      `seed_line_items=${http.lineItems}`,
      'seed_matches_checkout=yes',
      `locale=${language}`,
      `viewport=${viewport.width}x${viewport.height}`,
      `evidence_dir=${run.evidenceDir}`,
      `server_log=${run.serverLog}`,
    ]
    return lines.join('\n') + '\n'
  } finally {
    await browser.close()
  }
}

async function doctor(run) {
  const text = await collectDoctor(run)
  fs.mkdirSync(run.evidenceDir, { recursive: true })
  fs.writeFileSync(path.join(run.evidenceDir, 'doctor.txt'), text)
  journal(run, { command: 'doctor', ok: true })
  process.stdout.write(text)
}

async function launch() {
  const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteBin)) throw new Error('vite is not installed. From the repo root run: npm ci')
  const port = chosenPort()
  const runId = process.env.VERIFY_RUN_ID || newRunId()
  const run = runPaths(runId)
  if (fs.existsSync(run.dir)) throw new Error(`run dir already exists: ${run.dir}. Choose a new VERIFY_RUN_ID.`)
  const listeners = listeningPids(port)
  if (listeners.length) {
    throw new Error(
      `port ${port} is already in use. Refusing to kill it.\n${listeners
        .map((pid) => `${pid} ${cmdline(pid)}`)
        .join('\n')}\nSet VERIFY_PORT to a free port and VERIFY_RUN_ID to a new id, or run cleanup for the run that owns it.`,
    )
  }
  fs.mkdirSync(run.dir, { recursive: true })
  fs.mkdirSync(run.evidenceDir, { recursive: true })
  run.port = port
  run.baseUrl = `http://127.0.0.1:${port}`
  run.ready = false
  saveRun(run)
  fs.writeFileSync(latestFile(), runId + '\n')
  try {
    const logFd = fs.openSync(run.serverLog, 'a')
    const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: repoRoot,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, BROWSER: 'none' },
    })
    fs.closeSync(logFd)
    child.unref()
    run.serverPid = child.pid
    fs.writeFileSync(run.serverPidFile, String(child.pid) + '\n')
    saveRun(run)
    await waitForHttp(run, 30000)
    run.ready = true
    saveRun(run)
    console.log(`ready=yes\nrun_id=${run.runId}\nbase_url=${run.baseUrl}\nevidence_dir=${run.evidenceDir}`)
    await doctor(run)
  } catch (err) {
    await cleanupRun(run).catch((cleanupErr) => {
      console.error(cleanupErr.message)
    })
    throw err
  }
}

function requireFlag(flags, key) {
  const value = flags[key]
  if (value == null || value === true) throw new Error(`missing --${key}`)
  return value
}

// Wrapped <label> text includes the control's options, so getByLabel(..., { exact: true })
// does not match. The accessible name on the control itself does.
async function formControl(page, label) {
  for (const role of ['combobox', 'searchbox', 'textbox']) {
    const loc = page.getByRole(role, { name: label, exact: true })
    if ((await loc.count()) === 1) return loc
  }
  // Chrome exposes <input type="file"> as a button. setInputFiles still accepts that element.
  const upload = page.getByRole('button', { name: label, exact: true })
  if ((await upload.count()) === 1) return upload
  const file = page.locator('input[type="file"]')
  if ((await file.count()) === 1) return file
  throw new Error(`no form control named ${JSON.stringify(label)}`)
}

function flagBool(flags, key) {
  return flags[key] === true || flags[key] === 'true'
}

function scopeLocator(page, scope) {
  if (!scope) return page
  if (scope.startsWith('css:')) return page.locator(scope.slice(4))
  if (scope.startsWith('figure:')) return page.getByRole('figure', { name: scope.slice(7), exact: true })
  if (scope.startsWith('role:')) {
    const rest = scope.slice(5)
    const bar = rest.indexOf('|')
    if (bar === -1) return page.getByRole(rest)
    return page.getByRole(rest.slice(0, bar), { name: rest.slice(bar + 1), exact: true })
  }
  return page.getByRole('region', { name: scope, exact: true })
}

function evidenceFile(evidenceDir, name, ext) {
  if (!name || name === true) throw new Error('missing --name')
  const base = path.basename(name).replace(/[^A-Za-z0-9._-]+/g, '-')
  if (!base || base === '.' || base === '..') throw new Error(`bad --name ${name}`)
  const filename = base.endsWith(ext) ? base : base + ext
  const file = path.resolve(evidenceDir, filename)
  if (!file.startsWith(path.resolve(evidenceDir) + path.sep)) throw new Error('evidence path escaped')
  return file
}

function timeoutOf(flags, fallback = 20000) {
  if (flags.timeout == null || flags.timeout === true) return fallback
  const value = Number(flags.timeout)
  if (!Number.isFinite(value) || value <= 0) throw new Error('bad --timeout')
  return value
}

async function dispatch(pageHolder, run, msg) {
  const { command, flags } = msg
  const page = () => {
    if (!pageHolder.page) throw new Error('no browser page. Run open first.')
    return pageHolder.page
  }
  if (command === 'open') {
    if (!pageHolder.browser) pageHolder.browser = await launchBrowser()
    if (!pageHolder.context) pageHolder.context = await pageHolder.browser.newContext(browserContextOptions())
    if (pageHolder.page) await pageHolder.page.close().catch(() => {})
    const next = await pageHolder.context.newPage()
    next.setDefaultTimeout(20000)
    next.setDefaultNavigationTimeout(60000)
    next.on('pageerror', (err) => console.error('pageerror', err))
    pageHolder.page = next
    await openDashboard(next, run.baseUrl, 60000)
    return 'opened Weekly manager review'
  }
  if (command === 'click' || command === 'check') {
    const role = requireFlag(flags, 'role')
    const name = requireFlag(flags, 'name')
    const target = page().getByRole(role, { name, exact: true })
    if (command === 'check') await target.check()
    else await target.click()
    return `${command} ${role} ${name}`
  }
  if (command === 'select') {
    const label = requireFlag(flags, 'label')
    const value = requireFlag(flags, 'value')
    await (await formControl(page(), label)).selectOption(value)
    return `selected ${label}=${value}`
  }
  if (command === 'fill') {
    const label = requireFlag(flags, 'label')
    const value = requireFlag(flags, 'value')
    await (await formControl(page(), label)).fill(value)
    return `filled ${label}`
  }
  if (command === 'set-files') {
    const label = requireFlag(flags, 'label')
    const file = requireFlag(flags, 'file')
    const abs = path.resolve(repoRoot, file)
    if (!abs.startsWith(repoRoot + path.sep) || !fs.existsSync(abs)) throw new Error(`file not found: ${file}`)
    await (await formControl(page(), label)).setInputFiles(abs)
    return `set files ${label} ${file}`
  }
  if (command === 'expect-text' || command === 'expect-absent' || command === 'expect-count') {
    const text = requireFlag(flags, 'text')
    const root = scopeLocator(page(), flags.scope)
    const exact = flagBool(flags, 'exact')
    const matches = root.getByText(text, { exact }).filter({ visible: true })
    if (command === 'expect-absent') {
      const count = await matches.count()
      if (count !== 0) throw new Error(`expected ${JSON.stringify(text)} to be absent, visible matches: ${count}`)
      return `absent ${text}`
    }
    if (command === 'expect-count') {
      const expected = Number(requireFlag(flags, 'count'))
      const count = await matches.count()
      if (count !== expected) throw new Error(`expected ${expected} visible ${JSON.stringify(text)}, found ${count}`)
      return `count ${expected} ${text}`
    }
    await matches.first().waitFor({ state: 'visible', timeout: timeoutOf(flags) })
    return `text ${text}`
  }
  if (command === 'expect-exact') {
    const text = requireFlag(flags, 'text')
    const root = scopeLocator(page(), requireFlag(flags, 'scope'))
    const count = await root.count()
    if (count !== 1) throw new Error(`scope ${flags.scope} matched ${count} elements`)
    const actual = (await root.innerText()).trim()
    if (actual !== text) throw new Error(`text mismatch\nexpected: ${text}\nactual:   ${actual}`)
    return `exact ${text}`
  }
  if (command === 'expect-value') {
    const label = requireFlag(flags, 'label')
    const value = requireFlag(flags, 'value')
    const actual = await (await formControl(page(), label)).inputValue()
    if (actual !== value) throw new Error(`expected ${label} value ${value}, got ${actual}`)
    return `value ${label}=${value}`
  }
  if (command === 'expect-row') {
    const rowText = requireFlag(flags, 'row')
    const text = requireFlag(flags, 'text')
    const root = scopeLocator(page(), requireFlag(flags, 'scope'))
    const table = root
      .getByRole('table')
      .filter({ has: page().getByRole('columnheader', { name: 'Month', exact: true }) })
      .first()
    const rows = table.getByRole('row').filter({ hasText: rowText }).filter({ hasText: text })
    const count = await rows.count()
    if (count !== 1) throw new Error(`expected 1 row with ${JSON.stringify(rowText)} and ${JSON.stringify(text)}, found ${count}`)
    await rows.first().waitFor({ state: 'visible', timeout: timeoutOf(flags) })
    return `row ${rowText} ${text}`
  }
  if (
    command === 'expect-checked' ||
    command === 'expect-unchecked' ||
    command === 'expect-enabled' ||
    command === 'expect-disabled'
  ) {
    const role = requireFlag(flags, 'role')
    const name = requireFlag(flags, 'name')
    const target = page().getByRole(role, { name, exact: true })
    if (command === 'expect-checked' && !(await target.isChecked())) throw new Error(`${name} is not checked`)
    if (command === 'expect-unchecked' && (await target.isChecked())) throw new Error(`${name} is checked`)
    if (command === 'expect-enabled' && !(await target.isEnabled())) throw new Error(`${name} is disabled`)
    if (command === 'expect-disabled' && !(await target.isDisabled())) throw new Error(`${name} is enabled`)
    return `${command} ${role} ${name}`
  }
  if (command === 'screenshot' || command === 'aria' || command === 'text') {
    const ext = command === 'screenshot' ? '.png' : command === 'aria' ? '.aria.txt' : '.txt'
    const file = evidenceFile(run.evidenceDir, requireFlag(flags, 'name'), ext)
    const root = scopeLocator(page(), flags.scope)
    if (command === 'screenshot') {
      if (flags.scope) await root.screenshot({ path: file })
      else await page().screenshot({ path: file, fullPage: true })
    } else if (command === 'aria') {
      fs.writeFileSync(file, await root.ariaSnapshot())
    } else {
      fs.writeFileSync(file, await root.innerText())
    }
    return file
  }
  throw new Error(`unknown drive command: ${command}`)
}

async function captureFailure(page, evidenceDir, err) {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const png = path.join(evidenceDir, 'failure.png')
  const aria = path.join(evidenceDir, 'failure.aria.txt')
  const txt = path.join(evidenceDir, 'failure.txt')
  fs.writeFileSync(txt, String(err && err.stack ? err.stack : err))
  if (!page) return png
  try {
    await page.screenshot({ path: png, fullPage: true })
  } catch {
    // The page may already be closed. failure.txt still records the error.
  }
  try {
    fs.writeFileSync(aria, await page.locator('body').ariaSnapshot())
  } catch {
    try {
      fs.writeFileSync(aria, await page.locator('body').innerText())
    } catch {
      // No DOM left to dump.
    }
  }
  return png
}

function canConnect(sock) {
  return new Promise((resolve) => {
    const socket = net.createConnection(sock)
    const done = (ok) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

function callDaemon(sock, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(sock)
    let buf = ''
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`drive command timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    socket.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    socket.on('connect', () => {
      socket.write(JSON.stringify(payload) + '\n')
    })
    socket.on('data', (chunk) => {
      buf += chunk.toString()
      const nl = buf.indexOf('\n')
      if (nl < 0) return
      clearTimeout(timer)
      socket.end()
      try {
        resolve(JSON.parse(buf.slice(0, nl)))
      } catch (err) {
        reject(err)
      }
    })
  })
}

function startDaemon(run) {
  if (fs.existsSync(run.sock)) fs.rmSync(run.sock, { force: true })
  const logFd = fs.openSync(run.driveLog, 'a')
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'daemon', run.runId], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, VERIFY_RUN_ID: run.runId },
  })
  fs.closeSync(logFd)
  child.unref()
  fs.writeFileSync(run.drivePidFile, String(child.pid) + '\n')
  run.drivePid = child.pid
  saveRun(run)
  return child.pid
}

async function ensureDaemon(run) {
  if (await canConnect(run.sock)) return
  const pid = Number(fs.existsSync(run.drivePidFile) ? fs.readFileSync(run.drivePidFile, 'utf8').trim() : 0)
  if (alive(pid)) {
    for (let i = 0; i < 50; i++) {
      if (await canConnect(run.sock)) return
      await delay(100)
    }
    throw new Error(`drive daemon pid ${pid} is alive but ${run.sock} is not accepting\n${tail(run.driveLog, 40)}`)
  }
  startDaemon(run)
  for (let i = 0; i < 100; i++) {
    if (await canConnect(run.sock)) return
    const started = Number(fs.readFileSync(run.drivePidFile, 'utf8').trim())
    if (!alive(started) && i > 5) break
    await delay(100)
  }
  throw new Error(`drive daemon did not start\n${tail(run.driveLog, 60)}`)
}

async function drive(command, flags) {
  const run = loadRun()
  if (!run.ready) throw new Error('launch has not passed doctor yet')
  await ensureDaemon(run)
  const slow = command === 'open' || command === 'screenshot' || command === 'aria' || command === 'text'
  const result = await callDaemon(run.sock, { command, flags }, slow ? 90000 : 45000)
  if (!result.ok) {
    console.error(result.error)
    if (result.failure) console.error(`failure_screenshot=${result.failure}`)
    process.exitCode = 1
    return
  }
  console.log(`ok ${result.detail}`)
}

async function serve(runId) {
  assertSafeId(runId)
  const run = JSON.parse(fs.readFileSync(path.join(TMP_ROOT, runId, 'run.json'), 'utf8'))
  if (!run.ready) throw new Error('run is not ready')
  const pageHolder = { browser: null, context: null, page: null }
  if (fs.existsSync(run.sock)) fs.rmSync(run.sock, { force: true })
  let chain = Promise.resolve()
  const server = net.createServer((socket) => {
    let buf = ''
    socket.on('data', (chunk) => {
      buf += chunk.toString()
      let nl = buf.indexOf('\n')
      while (nl >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        nl = buf.indexOf('\n')
        if (!line.trim()) continue
        chain = chain.then(async () => {
          let msg
          try {
            msg = JSON.parse(line)
          } catch (err) {
            socket.write(JSON.stringify({ ok: false, error: err.message }) + '\n')
            return
          }
          try {
            const detail = await dispatch(pageHolder, run, msg)
            journal(run, { command: msg.command, flags: msg.flags, ok: true, detail })
            socket.write(JSON.stringify({ ok: true, detail }) + '\n')
          } catch (err) {
            const failure = await captureFailure(pageHolder.page, run.evidenceDir, err)
            journal(run, { command: msg.command, flags: msg.flags, ok: false, error: err.message, failure })
            console.error(err.stack || err.message)
            socket.write(JSON.stringify({ ok: false, error: err.message, failure }) + '\n')
          }
        })
      }
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(run.sock, () => resolve())
  })
  console.error(`drive daemon listening ${run.sock}`)
  const shutdown = async () => {
    try {
      if (pageHolder.browser) await pageHolder.browser.close()
    } catch {
      // Already gone.
    }
    server.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => {
    shutdown()
  })
  process.on('SIGINT', () => {
    shutdown()
  })
}

async function killGroup(pid, markers) {
  if (!alive(pid)) return false
  const cmd = cmdline(pid)
  for (const marker of markers) {
    if (!cmd.includes(marker)) {
      throw new Error(`refusing to kill pid ${pid}; cmdline missing ${JSON.stringify(marker)}: ${JSON.stringify(cmd)}`)
    }
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    process.kill(pid, 'SIGTERM')
  }
  const start = Date.now()
  while (Date.now() - start < 5000) {
    if (!alive(pid)) return true
    await delay(200)
  }
  if (!alive(pid)) return true
  const after = cmdline(pid)
  for (const marker of markers) {
    if (!after.includes(marker)) {
      throw new Error(`refusing to SIGKILL pid ${pid}; cmdline changed: ${JSON.stringify(after)}`)
    }
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // Already exited between the check and the signal.
    }
  }
  await delay(200)
  return !alive(pid)
}

async function cleanupRun(run) {
  const evidenceBefore = evidenceFiles(run.evidenceDir)
  assertUnder(run.dir, TMP_ROOT)
  if (path.resolve(run.evidenceDir).startsWith(path.resolve(TMP_ROOT) + path.sep)) {
    throw new Error(`evidence dir is inside tmp: ${run.evidenceDir}`)
  }
  const keptRoot = path.resolve(repoRoot, 'artifacts', 'verify-sales-dashboard')
  if (!path.resolve(run.evidenceDir).startsWith(keptRoot + path.sep)) {
    throw new Error(`evidence dir is outside the kept location: ${run.evidenceDir}`)
  }
  const drivePid = Number(run.drivePid || (fs.existsSync(run.drivePidFile) ? fs.readFileSync(run.drivePidFile, 'utf8') : 0))
  const serverPid = Number(run.serverPid || 0)
  let stoppedDrive = false
  let stoppedServer = false
  if (alive(drivePid)) stoppedDrive = await killGroup(drivePid, ['verify.mjs', 'daemon'])
  if (alive(serverPid)) stoppedServer = await killGroup(serverPid, ['vite/bin/vite.js'])
  const evidenceAfterKill = evidenceFiles(run.evidenceDir)
  if (evidenceBefore.join('\n') !== evidenceAfterKill.join('\n')) {
    throw new Error('cleanup changed evidence files while stopping processes')
  }
  fs.rmSync(run.dir, { recursive: true, force: true })
  if (fs.existsSync(latestFile()) && fs.readFileSync(latestFile(), 'utf8').trim() === run.runId) {
    fs.rmSync(latestFile(), { force: true })
  }
  const evidenceAfter = evidenceFiles(run.evidenceDir)
  if (evidenceBefore.join('\n') !== evidenceAfter.join('\n')) {
    throw new Error('cleanup removed evidence files')
  }
  console.log(
    [
      'ok',
      `run_id=${run.runId}`,
      `stopped_drive=${stoppedDrive ? 'yes' : 'no'}`,
      `stopped_server=${stoppedServer ? 'yes' : 'no'}`,
      `evidence_preserved=${evidenceAfter.length || evidenceBefore.length || fs.existsSync(run.evidenceDir) ? 'yes' : 'absent'}`,
      `evidence_dir=${run.evidenceDir}`,
      `evidence_files=${evidenceAfter.join(',')}`,
    ].join('\n'),
  )
}

async function cleanup() {
  const runId = resolveRunId(false)
  if (!runId) {
    console.log('ok\nnothing_to_stop=yes')
    return
  }
  const file = path.join(TMP_ROOT, runId, 'run.json')
  if (!fs.existsSync(file)) {
    if (fs.existsSync(latestFile()) && fs.readFileSync(latestFile(), 'utf8').trim() === runId) {
      fs.rmSync(latestFile(), { force: true })
    }
    console.log('ok\nnothing_to_stop=yes')
    return
  }
  await cleanupRun(JSON.parse(fs.readFileSync(file, 'utf8')))
}

async function sha256Command(flags) {
  const run = loadRun()
  const file = requireFlag(flags, 'file')
  const name = requireFlag(flags, 'name')
  const { hash } = sha256File(file)
  writeHash(run, name, file, hash)
  journal(run, { command: 'sha256', ok: true, name, file, hash })
  console.log(`ok name=${name} sha256=${hash}`)
}

async function expectSha256(flags) {
  const run = loadRun()
  const file = requireFlag(flags, 'file')
  const name = requireFlag(flags, 'name')
  const recorded = readHashes(run)[name]
  if (!recorded) throw new Error(`no recorded hash named ${name}`)
  const { hash } = sha256File(file)
  if (hash !== recorded.hash) {
    throw new Error(`${file} changed\nrecorded ${name}=${recorded.hash}\ncurrent=${hash}`)
  }
  journal(run, { command: 'expect-sha256', ok: true, name, file, hash })
  console.log(`ok unchanged ${file} sha256=${hash}`)
}

function pathsCommand() {
  const run = loadRun()
  console.log(
    [`run_id=${run.runId}`, `base_url=${run.baseUrl}`, `evidence_dir=${run.evidenceDir}`, `server_pid=${run.serverPid}`, `ready=${run.ready ? 'yes' : 'no'}`].join(
      '\n',
    ),
  )
}

async function main() {
  const command = process.argv[2]
  if (!command || command === 'help' || command === '--help') {
    printHelp()
    return
  }
  if (command === 'daemon') {
    await serve(process.argv[3])
    return
  }
  const { flags } = parseArgs(process.argv.slice(3))
  if (command === 'launch') return launch()
  if (command === 'doctor') return doctor(loadRun())
  if (command === 'cleanup') return cleanup()
  if (command === 'paths') return pathsCommand()
  if (command === 'sha256') return sha256Command(flags)
  if (command === 'expect-sha256') return expectSha256(flags)
  if (DRIVE_COMMANDS.has(command)) return drive(command, flags)
  if (!LOCAL_COMMANDS.has(command)) throw new Error(`unknown command: ${command}`)
}

main().catch((err) => {
  console.error(err.stack || err.message)
  process.exit(1)
})
