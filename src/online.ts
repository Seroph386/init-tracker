import { computed, getCurrentInstance, onBeforeUnmount, ref as vueRef, watch, type Ref } from 'vue'
import { isFirebaseReady, useFirebaseSync, waitForFirebase, initializeFirebase } from './firebase.ts'

export type OnlineProvider = 'firebase' | 'sqlite'
export { isFirebaseReady }

type SessionState<TCombatants> = {
  turn: number
  round: number
  combatants: TCombatants
}

type CombatantSerializer<TCombatants> = {
  read: (value: unknown) => TCombatants
  write: (value: TCombatants) => unknown
}

const firebaseConfigModules = import.meta.glob('./firebase.config.ts')
const firebaseConfigModulePath = Object.keys(firebaseConfigModules)[0]
let firebaseInitPromise: Promise<void> | null = null

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

export function normalizeOnlineProvider(value: string | null | undefined): OnlineProvider | '' {
  return value === 'firebase' || value === 'sqlite' ? value : ''
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfigModulePath)
}

export function getSqliteSyncBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_SQLITE_SYNC_URL?.trim()
  return configuredUrl ? normalizeBaseUrl(configuredUrl) : ''
}

export function isSqliteConfigured(): boolean {
  return Boolean(getSqliteSyncBaseUrl())
}

export function isOnlineProviderConfigured(provider: OnlineProvider): boolean {
  return provider === 'firebase' ? isFirebaseConfigured() : isSqliteConfigured()
}

export function getConfiguredOnlineProviders(): OnlineProvider[] {
  const providers: OnlineProvider[] = []

  if (isFirebaseConfigured()) {
    providers.push('firebase')
  }

  if (isSqliteConfigured()) {
    providers.push('sqlite')
  }

  return providers
}

export function getDefaultOnlineProvider(): OnlineProvider | '' {
  const configuredProviders = getConfiguredOnlineProviders()
  return configuredProviders[0] ?? ''
}

export async function initializeConfiguredOnlineProviders(): Promise<void> {
  if (!firebaseConfigModulePath) {
    return
  }

  if (!firebaseInitPromise) {
    const loader = firebaseConfigModules[firebaseConfigModulePath] as () => Promise<{ firebaseConfig: object }>
    firebaseInitPromise = loader()
      .then((module) => initializeFirebase(module.firebaseConfig))
      .catch((error) => {
        firebaseInitPromise = null
        console.error('Failed to initialize Firebase:', error)
      })
  }

  await firebaseInitPromise
}

function getSqliteSyncUrl(path: string): string {
  return `${getSqliteSyncBaseUrl()}${path}`
}

async function waitForSqlite(timeoutMs: number = 5000): Promise<boolean> {
  if (!isSqliteConfigured()) {
    return false
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(getSqliteSyncUrl('/health'), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    })

    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export function waitForOnlineProvider(provider: OnlineProvider, timeoutMs: number = 5000): Promise<boolean> {
  if (provider === 'firebase') {
    return waitForFirebase(timeoutMs)
  }

  return waitForSqlite(timeoutMs)
}

export function useFirebaseSessionSync<TCombatants>(
  sessionId: string,
  defaultState: SessionState<TCombatants>,
  combatantSerializer: CombatantSerializer<TCombatants>,
  onReady?: () => void
): {
  turn: Ref<number>
  round: Ref<number>
  combatants: Ref<TCombatants>
} {
  let loadedCount = 0
  const totalToLoad = 3

  const markAsLoadedIfReady = () => {
    loadedCount++
    if (loadedCount === totalToLoad) {
      onReady?.()
    }
  }

  return {
    turn: useFirebaseSync(`sessions/${sessionId}/turn`, defaultState.turn, undefined, markAsLoadedIfReady),
    round: useFirebaseSync(`sessions/${sessionId}/round`, defaultState.round, undefined, markAsLoadedIfReady),
    combatants: useFirebaseSync(
      `sessions/${sessionId}/combatants`,
      defaultState.combatants,
      combatantSerializer,
      markAsLoadedIfReady
    )
  }
}

export function useSqliteSessionSync<TCombatants>(
  sessionId: string,
  defaultState: SessionState<TCombatants>,
  combatantSerializer: CombatantSerializer<TCombatants>,
  onReady?: () => void
): {
  turn: Ref<number>
  round: Ref<number>
  combatants: Ref<TCombatants>
} {
  const localState = vueRef<SessionState<TCombatants>>({
    turn: defaultState.turn,
    round: defaultState.round,
    combatants: defaultState.combatants
  }) as Ref<SessionState<TCombatants>>

  let isRemoteUpdate = false
  let isReady = false
  let lastSerializedSnapshot = ''
  let eventSource: EventSource | null = null

  function serializeState(value: SessionState<TCombatants>) {
    return {
      turn: value.turn,
      round: value.round,
      combatants: combatantSerializer.write(value.combatants)
    }
  }

  function applyRemoteState(value: { turn?: number; round?: number; combatants?: unknown }) {
    isRemoteUpdate = true
    localState.value = {
      turn: typeof value.turn === 'number' ? value.turn : defaultState.turn,
      round: typeof value.round === 'number' ? value.round : defaultState.round,
      combatants: value.combatants !== undefined
        ? combatantSerializer.read(value.combatants)
        : defaultState.combatants
    }
    lastSerializedSnapshot = JSON.stringify(serializeState(localState.value))
    isRemoteUpdate = false
  }

  async function ensureSession() {
    try {
      const response = await fetch(getSqliteSyncUrl(`/sessions/${encodeURIComponent(sessionId)}/ensure`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(serializeState(defaultState))
      })

      if (!response.ok) {
        throw new Error(`SQLite sync ensure failed with ${response.status}`)
      }

      const payload = await response.json()
      applyRemoteState(payload.state ?? {})
    } catch (error) {
      console.error(`SQLite sync error while loading session ${sessionId}:`, error)
      applyRemoteState(serializeState(defaultState))
    } finally {
      isReady = true
      onReady?.()
    }
  }

  function connectEventSource() {
    eventSource = new EventSource(getSqliteSyncUrl(`/sessions/${encodeURIComponent(sessionId)}/events`))

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        applyRemoteState(payload.state ?? {})
      } catch (error) {
        console.error(`SQLite sync error while handling event for session ${sessionId}:`, error)
      }
    }

    eventSource.onerror = () => {
      console.warn(`SQLite sync connection lost for session ${sessionId}; waiting for automatic reconnect.`)
    }
  }

  void ensureSession().then(connectEventSource)

  const stopWatch = watch(
    localState,
    async (newValue) => {
      if (!isReady || isRemoteUpdate) {
        return
      }

      const serializedSnapshot = JSON.stringify(serializeState(newValue))

      if (serializedSnapshot === lastSerializedSnapshot) {
        return
      }

      lastSerializedSnapshot = serializedSnapshot

      try {
        const response = await fetch(getSqliteSyncUrl(`/sessions/${encodeURIComponent(sessionId)}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: serializedSnapshot
        })

        if (!response.ok) {
          throw new Error(`SQLite sync update failed with ${response.status}`)
        }
      } catch (error) {
        console.error(`SQLite sync error while saving session ${sessionId}:`, error)
      }
    },
    { deep: true }
  )

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      stopWatch()
      eventSource?.close()
    })
  }

  return {
    turn: computed({
      get: () => localState.value.turn,
      set: (value) => {
        localState.value.turn = value
      }
    }),
    round: computed({
      get: () => localState.value.round,
      set: (value) => {
        localState.value.round = value
      }
    }),
    combatants: computed({
      get: () => localState.value.combatants,
      set: (value) => {
        localState.value.combatants = value
      }
    })
  }
}
