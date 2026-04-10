import { ref } from "vue"

export type LocalGMUser = {
  id: string
  displayName: string
}

const LOCAL_GM_AUTH_KEY = "localGMAuthUser"
const localGMUser = ref<LocalGMUser | null>(readStoredLocalGMUser())

function readStoredLocalGMUser(): LocalGMUser | null {
  const raw = localStorage.getItem(LOCAL_GM_AUTH_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.id || !parsed?.displayName) {
      return null
    }

    return {
      id: String(parsed.id),
      displayName: String(parsed.displayName)
    }
  } catch {
    return null
  }
}

function persistLocalGMUser(user: LocalGMUser | null) {
  if (!user) {
    localStorage.removeItem(LOCAL_GM_AUTH_KEY)
    return
  }

  localStorage.setItem(LOCAL_GM_AUTH_KEY, JSON.stringify(user))
}

function sanitize(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")
}

function createLocalGMId(name: string, passphrase: string): string {
  const normalizedName = sanitize(name)
  const normalizedPassphrase = sanitize(passphrase)
  return btoa(`${normalizedName}:${normalizedPassphrase}`).replace(/=/g, "")
}

export function useLocalGMUser() {
  return localGMUser
}

export function signInLocalGM(name: string, passphrase: string): boolean {
  const displayName = name.trim()
  if (!displayName || !passphrase.trim()) {
    return false
  }

  const user = {
    id: createLocalGMId(displayName, passphrase),
    displayName
  }
  localGMUser.value = user
  persistLocalGMUser(user)
  return true
}

export function signOutLocalGM() {
  localGMUser.value = null
  persistLocalGMUser(null)
}
