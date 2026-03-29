import { createServer } from 'node:http'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const port = Number(process.env.SQLITE_SYNC_PORT || '8787')
const host = process.env.SQLITE_SYNC_HOST || '0.0.0.0'
const dbPath = process.env.SQLITE_SYNC_DB_PATH || './data/initiative-tracker.sqlite'
const staticDir = process.env.SQLITE_SYNC_STATIC_DIR || ''
const staticBasePath = normalizeStaticBasePath(process.env.SQLITE_SYNC_STATIC_BASE_PATH || '/')

await mkdir(dirname(dbPath), { recursive: true }).catch(() => {})

const database = new DatabaseSync(dbPath)
const sseClients = new Map()

database.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

const selectSessionStatement = database.prepare(`
  SELECT state_json, version
  FROM sessions
  WHERE session_id = ?
`)

const insertSessionStatement = database.prepare(`
  INSERT INTO sessions (session_id, state_json, version, updated_at)
  VALUES (?, ?, 1, CURRENT_TIMESTAMP)
`)

const ensureSessionStatement = database.prepare(`
  INSERT OR IGNORE INTO sessions (session_id, state_json, version, updated_at)
  VALUES (?, ?, 1, CURRENT_TIMESTAMP)
`)

const updateSessionStatement = database.prepare(`
  INSERT INTO sessions (session_id, state_json, version, updated_at)
  VALUES (?, ?, 1, CURRENT_TIMESTAMP)
  ON CONFLICT(session_id) DO UPDATE SET
    state_json = excluded.state_json,
    version = sessions.version + 1,
    updated_at = CURRENT_TIMESTAMP
`)

const sessionVersionStatement = database.prepare(`
  SELECT version
  FROM sessions
  WHERE session_id = ?
`)

function normalizeStaticBasePath(value) {
  if (!value || value === '/') {
    return '/'
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}

function ensureSession(sessionId, defaultStateJson) {
  ensureSessionStatement.run(sessionId, defaultStateJson)
  const ensuredSession = selectSessionStatement.get(sessionId)
  return {
    state: JSON.parse(ensuredSession.state_json),
    version: ensuredSession.version
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
  })
  response.end(JSON.stringify(payload))
}

function sendSseEvent(sessionId, payload) {
  const clients = sseClients.get(sessionId)
  if (!clients) {
    return
  }

  const message = `data: ${JSON.stringify(payload)}\n\n`
  for (const response of clients) {
    response.write(message)
  }
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

function getSessionRecord(sessionId) {
  const record = selectSessionStatement.get(sessionId)
  if (!record) {
    return null
  }

  return {
    state: JSON.parse(record.state_json),
    version: record.version
  }
}

function updateSession(sessionId, state) {
  const serializedState = JSON.stringify(state)
  updateSessionStatement.run(sessionId, serializedState)
  const versionRecord = sessionVersionStatement.get(sessionId)
  return {
    state,
    version: versionRecord?.version ?? 1
  }
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
}

function resolveStaticPath(urlPath) {
  if (!staticDir) {
    return null
  }

  const decodedPath = decodeURIComponent(urlPath)
  const relativePath = getStaticRelativePath(decodedPath)

  if (!relativePath) {
    return null
  }

  const normalizedPath = normalize(relativePath).replace(/^(\.\.[/\\])+/, '')
  return join(staticDir, normalizedPath)
}

function getStaticRelativePath(urlPath) {
  if (staticBasePath === '/') {
    return urlPath === '/' ? '/index.html' : urlPath
  }

  if (urlPath === '/' || urlPath === '') {
    return null
  }

  if (urlPath === staticBasePath || urlPath === `${staticBasePath}/`) {
    return '/index.html'
  }

  if (!urlPath.startsWith(`${staticBasePath}/`)) {
    return null
  }

  return urlPath.slice(staticBasePath.length) || '/index.html'
}

async function serveStaticFile(urlPath, response) {
  const candidatePath = resolveStaticPath(urlPath)
  if (!candidatePath) {
    return false
  }

  try {
    const fileStat = await stat(candidatePath)
    const filePath = fileStat.isDirectory() ? join(candidatePath, 'index.html') : candidatePath
    const extension = extname(filePath)

    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream'
    })

    createReadStream(filePath).pipe(response)
    return true
  } catch {
    if (urlPath !== '/' && urlPath !== staticBasePath && urlPath !== `${staticBasePath}/`) {
      try {
        const fallbackPath = join(staticDir, 'index.html')
        await readFile(fallbackPath)
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8'
        })
        createReadStream(fallbackPath).pipe(response)
        return true
      } catch {
        return false
      }
    }

    return false
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const { pathname } = requestUrl

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
    })
    response.end()
    return
  }

  if (request.method === 'GET' && pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      provider: 'sqlite',
      dbPath
    })
    return
  }

  const ensureMatch = pathname.match(/^\/sessions\/([^/]+)\/ensure$/)
  if (request.method === 'POST' && ensureMatch) {
    try {
      const sessionId = decodeURIComponent(ensureMatch[1])
      const defaultState = await parseBody(request)
      const result = ensureSession(sessionId, JSON.stringify(defaultState))
      sendJson(response, 200, result)
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_json',
        message: error instanceof Error ? error.message : 'Invalid request body'
      })
    }
    return
  }

  const eventsMatch = pathname.match(/^\/sessions\/([^/]+)\/events$/)
  if (request.method === 'GET' && eventsMatch) {
    const sessionId = decodeURIComponent(eventsMatch[1])

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })
    response.write('\n')

    const clients = sseClients.get(sessionId) || new Set()
    clients.add(response)
    sseClients.set(sessionId, clients)

    const existingSession = getSessionRecord(sessionId)
    if (existingSession) {
      response.write(`data: ${JSON.stringify(existingSession)}\n\n`)
    }

    const keepAliveInterval = setInterval(() => {
      response.write(': keepalive\n\n')
    }, 25000)

    request.on('close', () => {
      clearInterval(keepAliveInterval)
      const currentClients = sseClients.get(sessionId)
      currentClients?.delete(response)
      if (currentClients && currentClients.size === 0) {
        sseClients.delete(sessionId)
      }
    })
    return
  }

  const sessionMatch = pathname.match(/^\/sessions\/([^/]+)$/)
  if (request.method === 'GET' && sessionMatch) {
    const sessionId = decodeURIComponent(sessionMatch[1])
    const session = getSessionRecord(sessionId)

    if (!session) {
      sendJson(response, 404, {
        error: 'not_found'
      })
      return
    }

    sendJson(response, 200, session)
    return
  }

  if (request.method === 'PUT' && sessionMatch) {
    try {
      const sessionId = decodeURIComponent(sessionMatch[1])
      const nextState = await parseBody(request)
      const result = updateSession(sessionId, nextState)
      sendSseEvent(sessionId, result)
      sendJson(response, 200, result)
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_json',
        message: error instanceof Error ? error.message : 'Invalid request body'
      })
    }
    return
  }

  if (request.method === 'GET' && staticDir && staticBasePath !== '/' && pathname === '/') {
    response.writeHead(302, {
      Location: `${staticBasePath}/`
    })
    response.end()
    return
  }

  const served = await serveStaticFile(pathname, response)
  if (served) {
    return
  }

  sendJson(response, 404, {
    error: 'not_found'
  })
})

server.listen(port, host, () => {
  console.log(`SQLite sync server listening on http://${host}:${port}`)
  console.log(`SQLite database: ${dbPath}`)
  if (staticDir) {
    console.log(`Serving static files from: ${staticDir}`)
    console.log(`Static app base path: ${staticBasePath}`)
  }
})
