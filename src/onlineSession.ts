import { getCurrentInstance, onBeforeUnmount, ref as vueRef, watch, type Ref } from 'vue'

let hostedDatabaseReady = false
let initPromise: Promise<boolean> | null = null

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

async function checkHostedDatabase() {
  try {
    const response = await fetch('/api/health', {
      cache: 'no-store',
    })

    hostedDatabaseReady = response.ok
  } catch {
    hostedDatabaseReady = false
  }

  return hostedDatabaseReady
}

export function initializeHostedDatabase(): Promise<boolean> {
  if (!initPromise) {
    initPromise = checkHostedDatabase()
  }

  return initPromise
}

export function isHostedDatabaseReady(): boolean {
  return hostedDatabaseReady
}

export async function waitForHostedDatabase(timeoutMs: number = 5000): Promise<boolean> {
  const timeoutPromise = new Promise<boolean>((resolve) => {
    window.setTimeout(() => resolve(false), timeoutMs)
  })

  return Promise.race([initializeHostedDatabase(), timeoutPromise])
}

export function useHostedSessionSync<T>(
  sessionId: string,
  defaultValue: T,
  options?: {
    serializer?: {
      read: (value: any) => T
      write: (value: T) => any
    }
    readOnly?: boolean
    onReady?: () => void
  }
): Ref<T> {
  const serializer = options?.serializer
  const stateRef = vueRef<T>(cloneValue(defaultValue)) as Ref<T>
  const encodedSessionId = encodeURIComponent(sessionId)
  const endpoint = `/api/sessions/${encodedSessionId}`
  const streamEndpoint = `${endpoint}/stream`
  let readyFired = false
  let isRemoteUpdate = false
  let saveTimeout: number | null = null
  let eventSource: EventSource | null = null

  const markReady = () => {
    if (!readyFired) {
      readyFired = true
      options?.onReady?.()
    }
  }

  const applyRemoteValue = (rawValue: any) => {
    isRemoteUpdate = true
    stateRef.value = serializer ? serializer.read(rawValue) : rawValue
    isRemoteUpdate = false
  }

  const persistValue = async (value: T) => {
    try {
      await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: serializer ? serializer.write(value) : value,
        }),
      })
    } catch (error) {
      console.error(`Hosted sync error for session ${sessionId}:`, error)
    }
  }

  const stopWatch = watch(
    stateRef,
    (newValue) => {
      if (options?.readOnly || isRemoteUpdate) {
        return
      }

      if (saveTimeout) {
        window.clearTimeout(saveTimeout)
      }

      saveTimeout = window.setTimeout(() => {
        void persistValue(newValue)
      }, 100)
    },
    { deep: true }
  )

  const loadInitialState = async () => {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
      })

      if (response.ok) {
        const payload = await response.json()
        applyRemoteValue(payload.state)
      } else if (response.status === 404 && !options?.readOnly) {
        await persistValue(stateRef.value)
      }
    } catch (error) {
      console.error(`Failed to load hosted session ${sessionId}:`, error)
    } finally {
      markReady()
    }
  }

  try {
    eventSource = new EventSource(streamEndpoint)
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.state != null) {
          applyRemoteValue(payload.state)
        }
      } catch (error) {
        console.error(`Failed to process hosted session update for ${sessionId}:`, error)
      }
    }
  } catch (error) {
    console.error(`Failed to open hosted session stream for ${sessionId}:`, error)
  }

  void loadInitialState()

  const cleanup = () => {
    stopWatch()
    if (saveTimeout) {
      window.clearTimeout(saveTimeout)
    }
    eventSource?.close()
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(cleanup)
  }

  return stateRef
}

export function generateSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
