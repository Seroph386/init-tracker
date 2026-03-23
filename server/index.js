import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = normalize(join(__dirname, '..'))
const distDir = join(rootDir, 'dist')
const dataDir = join(rootDir, '.data')
const dbPath = join(dataDir, 'sessions.sqlite')
const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'

mkdirSync(dataDir, { recursive: true })

const sseClients = new Map()
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function escapeSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function runSql(sql, { json = false } = {}) {
  const args = []

  if (json) {
    args.push('-json')
  }

  args.push(dbPath, sql)

  const output = execFileSync('sqlite3', args, {
    encoding: 'utf8',
  }).trim()

  if (!json) {
    return output
  }

  return output ? JSON.parse(output) : []
}

function initializeDatabase() {
  runSql(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}

function parseSessionRecord(record) {
  if (!record) {
    return null
  }

  return {
    id: record.id,
    createdAt: Number(record.createdAt),
    updatedAt: Number(record.updatedAt),
    state: JSON.parse(record.state),
  }
}

function getSession(sessionId) {
  const rows = runSql(`
    SELECT
      id,
      state,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM sessions
    WHERE id = ${escapeSqlString(sessionId)}
    LIMIT 1;
  `, { json: true })

  return parseSessionRecord(rows[0])
}

function writeSession(sessionId, state) {
  const timestamp = Date.now()
  const existing = getSession(sessionId)
  const createdAt = existing?.createdAt ?? timestamp
  const serializedState = escapeSqlString(JSON.stringify(state))

  runSql(`
    INSERT INTO sessions (id, state, created_at, updated_at)
    VALUES (
      ${escapeSqlString(sessionId)},
      ${serializedState},
      ${createdAt},
      ${timestamp}
    )
    ON CONFLICT(id) DO UPDATE SET
      state = excluded.state,
      updated_at = excluded.updated_at;
  `)

  return {
    id: sessionId,
    createdAt,
    updatedAt: timestamp,
    state,
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

async function readRequestBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return null
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(rawBody)
}

function broadcastSession(sessionId, payload) {
  const clients = sseClients.get(sessionId)
  if (!clients || clients.size === 0) {
    return
  }

  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const response of clients) {
    response.write(data)
  }
}

function registerSseClient(sessionId, response) {
  const clients = sseClients.get(sessionId) ?? new Set()
  clients.add(response)
  sseClients.set(sessionId, clients)

  const keepAlive = setInterval(() => {
    response.write(': keep-alive\n\n')
  }, 20000)

  response.on('close', () => {
    clearInterval(keepAlive)
    const sessionClients = sseClients.get(sessionId)
    sessionClients?.delete(response)
    if (sessionClients && sessionClients.size === 0) {
      sseClients.delete(sessionId)
    }
  })
}

function handleSse(sessionId, response) {
  response.writeHead(200, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'X-Accel-Buffering': 'no',
  })

  response.write('retry: 2000\n\n')
  registerSseClient(sessionId, response)

  const existing = getSession(sessionId)
  if (existing) {
    response.write(`data: ${JSON.stringify(existing)}\n\n`)
  }
}

function isValidSessionId(sessionId) {
  return /^[a-z0-9-]{6,64}$/.test(sessionId)
}

async function handleApi(request, response, pathname) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      Allow: 'GET, PUT, OPTIONS',
    })
    response.end()
    return true
  }

  if (pathname === '/api/health') {
    sendJson(response, 200, { ok: true, database: 'sqlite3-cli', path: dbPath })
    return true
  }

  const sessionMatch = pathname.match(/^\/api\/sessions\/([a-z0-9-]+)(\/stream)?$/)
  if (!sessionMatch) {
    return false
  }

  const [, sessionId, streamSuffix] = sessionMatch

  if (!isValidSessionId(sessionId)) {
    sendJson(response, 400, { error: 'Invalid session ID.' })
    return true
  }

  if (streamSuffix === '/stream') {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed.' })
      return true
    }

    handleSse(sessionId, response)
    return true
  }

  if (request.method === 'GET') {
    const existing = getSession(sessionId)
    if (!existing) {
      sendJson(response, 404, { error: 'Session not found.' })
      return true
    }

    sendJson(response, 200, existing)
    return true
  }

  if (request.method === 'PUT') {
    try {
      const body = await readRequestBody(request)
      if (!body || typeof body !== 'object' || body.state == null || typeof body.state !== 'object') {
        sendJson(response, 400, { error: 'Request body must include an object state.' })
        return true
      }

      const saved = writeSession(sessionId, body.state)
      broadcastSession(sessionId, saved)
      sendJson(response, 200, saved)
      return true
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Invalid JSON payload.',
      })
      return true
    }
  }

  sendJson(response, 405, { error: 'Method not allowed.' })
  return true
}

async function serveStaticFile(response, filePath) {
  const extension = extname(filePath)
  const contentType = contentTypes[extension] ?? 'application/octet-stream'

  response.writeHead(200, {
    'Content-Type': contentType,
  })

  createReadStream(filePath).pipe(response)
}

async function handleStatic(response, pathname) {
  if (!existsSync(distDir)) {
    sendJson(response, 503, {
      error: 'Production assets not found. Run "pnpm build" for the hosted app, or use Vite in development.',
    })
    return
  }

  const safePath = pathname === '/' ? '/index.html' : pathname
  const candidatePath = normalize(join(distDir, safePath))

  if (candidatePath.startsWith(distDir)) {
    try {
      const fileStats = await stat(candidatePath)
      if (fileStats.isFile()) {
        await serveStaticFile(response, candidatePath)
        return
      }
    } catch {
      // Fall back to index.html for SPA routes.
    }
  }

  await serveStaticFile(response, join(distDir, 'index.html'))
}

initializeDatabase()

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: 'Missing request URL.' })
    return
  }

  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)

  try {
    const handledApi = await handleApi(request, response, url.pathname)
    if (handledApi) {
      return
    }

    await handleStatic(response, url.pathname)
  } catch (error) {
    console.error(error)
    sendJson(response, 500, {
      error: 'Internal server error.',
    })
  }
})

server.listen(port, host, () => {
  console.log(`Initiative Tracker server listening on http://${host}:${port}`)
  console.log(`SQLite session store: ${dbPath}`)
})
