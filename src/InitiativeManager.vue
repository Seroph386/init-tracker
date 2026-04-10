<script setup lang="ts">
import {computed, ref, watch, onMounted} from "vue";
import {Combatant, Condition, getDefaultCombatants, Visibility} from "./functions.ts";
import {useStorage} from "@vueuse/core";
import DMView from "./DMView.vue";
import PlayerView from "./PlayerView.vue";
import PlayerSimpleView from "./PlayerSimpleView.vue";
import type {GameSystem} from "./db.ts";
import {generateSessionId} from "./firebase.ts";
import { signInWithGithub, signInWithGoogle, signOutGM, useFirebaseCurrentUser, useFirebaseSync } from "./firebase.ts";
import { signInLocalGM, signOutLocalGM, useLocalGMUser } from "./localAuth.ts";
import { useTranslations } from "./lang.ts";
import {
  getConfiguredOnlineProviders,
  getDefaultOnlineProvider,
  isFirebaseReady,
  isOnlineProviderConfigured,
  normalizeOnlineProvider,
  type OnlineProvider,
  useFirebaseSessionSync,
  useSqliteSessionSync,
  waitForOnlineProvider
} from "./online.ts";

// Check URL for session ID and view mode
const urlParams = new URLSearchParams(window.location.search)
const sessionId = ref<string>(urlParams.get("session") || '')
const requestedOnlineProvider = ref<OnlineProvider | ''>(normalizeOnlineProvider(urlParams.get('backend')))
const availableOnlineProviders = getConfiguredOnlineProviders()

// Security: Check if this is a DM session
// DM sessions are tracked in localStorage with a security token
const dmSessions = useStorage<string[]>('dmSessions', [])
const preferredOnlineProvider = useStorage<OnlineProvider | ''>('onlineProvider', getDefaultOnlineProvider())

if (preferredOnlineProvider.value && !isOnlineProviderConfigured(preferredOnlineProvider.value)) {
  preferredOnlineProvider.value = getDefaultOnlineProvider()
}

// Security: Determine view mode
// - If session exists and NOT in dmSessions, force player view (read-only)
// - If session exists and IS in dmSessions, allow DM view
// - If no session but view=player/on-deck (or legacy player-simple) in URL, show player view (offline mode)
// - Otherwise, default DM view
const isSharedPlayerLink = computed(() => {
  return !!sessionId.value && !dmSessions.value.includes(sessionId.value)
})

const viewMode = urlParams.get('view') || ''
const docsDemo = urlParams.get('docs-demo') === 'readme'
const isPlayerViewParam = viewMode === 'player' || viewMode === 'on-deck' || viewMode === 'player-simple'
const isDMView = ref<boolean>(!isSharedPlayerLink.value && !isPlayerViewParam)

// Online mode is active when there's a session ID in the URL and a provider is configured
const onlineProvider = computed<OnlineProvider | ''>(() => {
  if (requestedOnlineProvider.value && isOnlineProviderConfigured(requestedOnlineProvider.value)) {
    return requestedOnlineProvider.value
  }

  if (preferredOnlineProvider.value && isOnlineProviderConfigured(preferredOnlineProvider.value)) {
    return preferredOnlineProvider.value
  }

  return getDefaultOnlineProvider()
})

const isOnlineMode = computed(() => !!sessionId.value && !!onlineProvider.value)
const isOnlineAvailable = computed(() => availableOnlineProviders.length > 0)

// Security: If player tries to remove view=player from URL, redirect back
watch([sessionId, () => window.location.search], () => {
  if (isSharedPlayerLink.value) {
    const currentParams = new URLSearchParams(window.location.search)
    const currentView = currentParams.get('view')

    if (currentView !== 'player' && currentView !== 'on-deck' && currentView !== 'player-simple') {
      // Force default player view for shared sessions if invalid/missing
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'player')
      window.location.href = url.toString()
    }
  }
}, { immediate: true })

// Get game system setting
const gameSystem = useStorage<GameSystem>('gameSystem', 'pathfinder')
const { t } = useTranslations()

type SavedEncounter = {
  id: string
  name: string
  combatants: Combatant[]
}

const localSavedEncounters = useStorage<SavedEncounter[]>(
  'savedEncounters',
  [],
  undefined,
  {
    serializer: {
      read: (v: any) => {
        if (!v) return []
        const parsedItems = Array.isArray(v) ? v : JSON.parse(v)
        return parsedItems.map((encounter: any) => ({
          id: encounter.id,
          name: encounter.name,
          combatants: (encounter.combatants || []).map((combatant: any) => new Combatant(
            combatant.name,
            combatant.totalHP,
            combatant.initiative,
            combatant.currentHP,
            (combatant.conditions || []).map((condition: any) => new Condition(condition.name, condition.value)),
            combatant.visibility,
            combatant.tempHP || 0,
            combatant.maxTempHP || 0
          ))
        }))
      },
      write: (v: any) => JSON.stringify(v)
    }
  }
)
const firebaseUser = useFirebaseCurrentUser()
const localGMUser = useLocalGMUser()
const cloudSavedEncounters = ref<SavedEncounter[] | null>(null)
let stopCloudSavedEncountersWatch: (() => void) | null = null
let cloudSavedEncountersSyncRef: ReturnType<typeof useFirebaseSync<SavedEncounter[]>> | null = null
const localAccountSavedEncounters = ref<SavedEncounter[] | null>(null)

watch(firebaseUser, (user) => {
  if (stopCloudSavedEncountersWatch) {
    stopCloudSavedEncountersWatch()
    stopCloudSavedEncountersWatch = null
  }

  if (!user || !isFirebaseReady()) {
    cloudSavedEncounters.value = null
    cloudSavedEncountersSyncRef = null
    return
  }

  cloudSavedEncountersSyncRef = useFirebaseSync<SavedEncounter[]>(
    `users/${user.uid}/savedEncounters`,
    [],
    {
      read: (v: any) => {
        if (!v) return []
        const parsedItems = Array.isArray(v) ? v : Object.values(v)
        return parsedItems.map((encounter: any) => ({
          id: encounter.id,
          name: encounter.name,
          combatants: (encounter.combatants || []).map((combatant: any) => new Combatant(
            combatant.name,
            combatant.totalHP,
            combatant.initiative,
            combatant.currentHP,
            (combatant.conditions || []).map((condition: any) => new Condition(condition.name, condition.value)),
            combatant.visibility,
            combatant.tempHP || 0,
            combatant.maxTempHP || 0
          ))
        }))
      },
      write: (v: SavedEncounter[]) => v
    }
  )

  stopCloudSavedEncountersWatch = watch(
    cloudSavedEncountersSyncRef,
    (value) => {
      cloudSavedEncounters.value = value
    },
    { deep: true, immediate: true }
  )
}, { immediate: true })

const savedEncounters = computed<SavedEncounter[]>({
  get: () => cloudSavedEncounters.value ?? localAccountSavedEncounters.value ?? localSavedEncounters.value,
  set: (v) => {
    if (firebaseUser.value && cloudSavedEncountersSyncRef) {
      cloudSavedEncountersSyncRef.value = v
      cloudSavedEncounters.value = v
      return
    }

    if (localGMUser.value) {
      localAccountSavedEncounters.value = v
      localStorage.setItem(`savedEncounters:local:${localGMUser.value.id}`, JSON.stringify(v))
      return
    }

    localSavedEncounters.value = v
  }
})

watch(localGMUser, (user) => {
  if (!user) {
    localAccountSavedEncounters.value = null
    return
  }

  const stored = localStorage.getItem(`savedEncounters:local:${user.id}`)
  if (!stored) {
    localAccountSavedEncounters.value = []
    return
  }

  try {
    const parsedItems = JSON.parse(stored)
    localAccountSavedEncounters.value = parsedItems.map((encounter: any) => ({
      id: encounter.id,
      name: encounter.name,
      combatants: (encounter.combatants || []).map((combatant: any) => new Combatant(
        combatant.name,
        combatant.totalHP,
        combatant.initiative,
        combatant.currentHP,
        (combatant.conditions || []).map((condition: any) => new Condition(condition.name, condition.value)),
        combatant.visibility,
        combatant.tempHP || 0,
        combatant.maxTempHP || 0
      ))
    }))
  } catch {
    localAccountSavedEncounters.value = []
  }
}, { immediate: true })

// Custom serializer for Combatant objects
const combatantSerializer = {
  read: (v: any) => {
    if (v) {
      let parsedItems = Array.isArray(v) ? v : JSON.parse(v)
      return parsedItems.map((combatant: any) => {
        return new Combatant(
          combatant.name,
          combatant.totalHP,
          combatant.initiative,
          combatant.currentHP,
          (combatant.conditions || []).map((condition: any) => {
            return new Condition(condition.name, condition.value)
          }),
          combatant.visibility,
          combatant.tempHP || 0,
          combatant.maxTempHP || 0
        )
      })
    }
    return getDefaultCombatants(gameSystem.value)
  },
  write: (v: any) => v // Firebase handles JSON serialization
}

/**
 * State management that switches between localStorage (offline) and realtime providers (online)
 */
let _turn: any = null
let _round: any = null
let _combatants: any = null
const isInitialized = ref(false)

const turn = computed({
  get: () => _turn?.value ?? 0,
  set: (v) => { if (_turn) _turn.value = v }
})

const round = computed({
  get: () => _round?.value ?? 1,
  set: (v) => { if (_round) _round.value = v }
})

const combatants = computed({
  get: () => _combatants?.value ?? [],
  set: (v) => { if (_combatants) _combatants.value = v }
})

const docsDemoCombatants = [
  new Combatant('Bog Witch', 48, 22, 32, [new Condition('Frightened', 1)], Visibility.Full, 0, 0),
  new Combatant('Pumpkin Scout (1)', 18, 19, 18, [], Visibility.Half, 0, 0),
  new Combatant('Pumpkin Scout (2)', 18, 18, 6, [new Condition('Clumsy', 1)], Visibility.None, 0, 0),
  new Combatant('Vine Horror (Green)', 30, 16, 12, [new Condition('Grabbed', 1)], Visibility.Full, 4, 4)
]

const docsDemoSavedEncounters: SavedEncounter[] = [
  {
    id: 'docs-encounter-1',
    name: 'Abomination Vaults - Level 1',
    combatants: [
      new Combatant('Mite Tunnel Guard', 20, 21, 14, [new Condition('Frightened', 1)], Visibility.Half, 0, 0),
      new Combatant('Mite Tunnel Guard (2)', 20, 18, 20, [], Visibility.Half, 0, 0),
      new Combatant('Heroic Fighter', 42, 17, 31, [], Visibility.Full, 0, 0),
      new Combatant('Skeletal Hound', 24, 14, 8, [new Condition('Enfeebled', 1)], Visibility.Full, 0, 0)
    ]
  },
  {
    id: 'docs-encounter-2',
    name: 'Oozing Chapel Ambush',
    combatants: [
      new Combatant('Chapel Ooze', 55, 23, 55, [], Visibility.Half, 0, 0),
      new Combatant('Acolyte of Dust', 26, 19, 20, [new Condition('Sickened', 1)], Visibility.Half, 0, 0),
      new Combatant('Cleric of Sarenrae', 38, 16, 24, [], Visibility.Full, 0, 0)
    ]
  }
]

function initializeOfflineState() {
  if (docsDemo) {
    localSavedEncounters.value = docsDemoSavedEncounters.map((encounter) => ({
      id: encounter.id,
      name: encounter.name,
      combatants: encounter.combatants.map((combatant) => new Combatant(
        combatant.name,
        combatant.totalHP,
        combatant.initiative,
        combatant.currentHP,
        combatant.conditions.map((condition) => new Condition(condition.name, condition.value)),
        combatant.visibility,
        combatant.tempHP || 0,
        combatant.maxTempHP || 0
      ))
    }))
    _turn = ref(0)
    _round = ref(3)
    _combatants = ref(docsDemoCombatants)
    isInitialized.value = true
    return
  }

  if (isSharedPlayerLink.value) {
    _turn = ref(0)
    _round = ref(1)
    _combatants = ref(getDefaultCombatants(gameSystem.value))
    isInitialized.value = true
    return
  }

  _turn = useStorage('turn', 0)
  _round = useStorage('round', 1)
  _combatants = useStorage(
    'combatants',
    getDefaultCombatants(gameSystem.value),
    undefined,
    {
      serializer: {
        read: (v: any) => {
          if (v) {
            let parsedItems = JSON.parse(v)
            return parsedItems.map((combatant: Combatant) => {
              return new Combatant(
                combatant.name,
                combatant.totalHP,
                combatant.initiative,
                combatant.currentHP,
                combatant.conditions.map((condition: Condition) => {
                  return new Condition(condition.name, condition.value)
                }),
                combatant.visibility,
                combatant.tempHP || 0,
                combatant.maxTempHP || 0
              )
            })
          }
          return getDefaultCombatants(gameSystem.value)
        },
        write: (v: any) => JSON.stringify(v)
      }
    }
  )

  isInitialized.value = true
}

// Initialize state - this will be set in onMounted after the online provider is ready
function initializeState() {
  const shouldUseOnlineProvider = isOnlineMode.value && sessionId.value

  if (!shouldUseOnlineProvider) {
    initializeOfflineState()
    return
  }

  // For DM: Load existing localStorage data to use as defaults
  let defaultTurn = 0
  let defaultRound = 1
  let defaultCombatantsData = getDefaultCombatants(gameSystem.value)

  if (isDMView.value && !isSharedPlayerLink.value) {
    // Try to load existing localStorage data
    try {
      const storedTurn = localStorage.getItem('turn')
      const storedRound = localStorage.getItem('round')
      const storedCombatants = localStorage.getItem('combatants')

      if (storedTurn) defaultTurn = JSON.parse(storedTurn)
      if (storedRound) defaultRound = JSON.parse(storedRound)
      if (storedCombatants) {
        const parsedCombatants = JSON.parse(storedCombatants)
        defaultCombatantsData = parsedCombatants.map((combatant: any) => {
          return new Combatant(
            combatant.name,
            combatant.totalHP,
            combatant.initiative,
            combatant.currentHP,
            (combatant.conditions || []).map((condition: any) => {
              return new Condition(condition.name, condition.value)
            }),
            combatant.visibility,
            combatant.tempHP || 0,
            combatant.maxTempHP || 0
          )
        })
      }
    } catch (e) {
      // If loading fails, use defaults
      console.error('Error loading localStorage data:', e)
    }
  }

  const defaultSessionState = {
    turn: defaultTurn,
    round: defaultRound,
    combatants: defaultCombatantsData
  }

  const markAsLoadedIfReady = () => {
    isInitialized.value = true
  }

  if (onlineProvider.value === 'firebase' && isFirebaseReady()) {
    const syncedSession = useFirebaseSessionSync(
      sessionId.value,
      defaultSessionState,
      combatantSerializer,
      markAsLoadedIfReady
    )
    _turn = syncedSession.turn
    _round = syncedSession.round
    _combatants = syncedSession.combatants
  } else if (onlineProvider.value === 'sqlite') {
    const syncedSession = useSqliteSessionSync(
      sessionId.value,
      defaultSessionState,
      combatantSerializer,
      markAsLoadedIfReady
    )
    _turn = syncedSession.turn
    _round = syncedSession.round
    _combatants = syncedSession.combatants
  } else {
    console.error('No online provider available for session; falling back to offline state')
    initializeOfflineState()
    return
  }

  // For DM: Also sync to localStorage as backup (but not for players)
  if (isDMView.value && !isSharedPlayerLink.value) {
    watch(_turn, (newValue) => {
      localStorage.setItem('turn', JSON.stringify(newValue))
    })
    watch(_round, (newValue) => {
      localStorage.setItem('round', JSON.stringify(newValue))
    })
    watch(_combatants, (newValue) => {
      localStorage.setItem('combatants', JSON.stringify(newValue))
    }, { deep: true })
  }

  // Note: For online mode, isInitialized is set in markAsLoadedIfReady callback
}

// Wait for the selected online provider to initialize, then set up state
onMounted(async () => {
  if (isOnlineMode.value && sessionId.value && onlineProvider.value) {
    const providerReady = await waitForOnlineProvider(onlineProvider.value, 5000)
    if (!providerReady) {
      console.error(`${onlineProvider.value} failed to initialize within timeout; falling back to offline state`)
    }
  }

  initializeState()
})

// Function to enable online mode (called from DM view toggle)
function enableOnlineMode() {
  if (!sessionId.value && isDMView.value && onlineProvider.value) {
    // Generate new session ID when enabling online mode
    const newSessionId = generateSessionId()
    sessionId.value = newSessionId
    requestedOnlineProvider.value = onlineProvider.value

    // Register this as a DM session for security
    if (!dmSessions.value.includes(newSessionId)) {
      dmSessions.value = [...dmSessions.value, newSessionId]
    }

    const url = new URL(window.location.href)
    url.searchParams.set('session', newSessionId)
    url.searchParams.set('backend', onlineProvider.value)
    // Remove view parameter if it exists (DM shouldn't have it)
    url.searchParams.delete('view')
    window.history.pushState({}, '', url.toString())

    // Reload to reinitialize with Firebase
    window.location.reload()
  }
}

// Function to disable online mode (called from DM view toggle)
function disableOnlineMode() {
  if (sessionId.value && isDMView.value) {
    // Remove session from URL when disabling online mode
    const url = new URL(window.location.href)
    url.searchParams.delete('session')
    url.searchParams.delete('backend')
    window.history.pushState({}, '', url.toString())
    sessionId.value = ''
    requestedOnlineProvider.value = ''

    // Reload to reinitialize with localStorage
    window.location.reload()
  }
}

// Function to handle online mode toggle from DM view
function toggleOnlineMode(value: boolean) {
  if (value) {
    enableOnlineMode()
  } else {
    disableOnlineMode()
  }
}

function setOnlineProvider(provider: OnlineProvider) {
  preferredOnlineProvider.value = provider
}

/**
 * Sorts combatants by initiative (highest first)
 * Ties are broken alphabetically by name
 */
const orderedCombatants = computed(() => {
  const list = combatants.value
  if (!Array.isArray(list)) return []
  return [...list].sort((a: Combatant, b: Combatant) => {
    return b.initiative - a.initiative === 0 ? a.name > b.name ? 1 : -1 : b.initiative - a.initiative
  })
})

function reset() {
  turn.value = 0
  round.value = 1
}

/**
 * Advances to the next turn, skipping hidden combatants
 * Increments round when cycling back to the top of initiative order
 * Does nothing if all combatants are hidden
 */
function nextTurn() {
  if (orderedCombatants.value.every((combatant: Combatant) => combatant.visibility === Visibility.None)) {
    return
  }

  let newTurn: number = turn.value

  do {
    newTurn++

    if (newTurn >= orderedCombatants.value.length) {
      newTurn = 0
      round.value++
    }
  } while (newTurn <= orderedCombatants.value.length - 1 && orderedCombatants.value[newTurn].visibility === Visibility.None)

  turn.value = newTurn
}

function addCombatant(name: string, HP: number, initiative: number, visibility: Visibility): void {
  combatants.value.push(new Combatant(name, HP, initiative, HP, [], visibility, 0, 0))
}

function removeCombatant(index: number): void {
  // The index comes from orderedCombatants (sorted array),
  // but we need to remove from the unsorted combatants array
  const combatantToRemove = orderedCombatants.value[index]
  const actualIndex = combatants.value.findIndex((c: Combatant) => c === combatantToRemove)

  if (actualIndex === -1) return // Safety check

  combatants.value.splice(actualIndex, 1)
  if (index < turn.value) {
    turn.value -= 1
  } else if (index == combatants.value.length) {
    nextTurn()
  }
}

/**
 * Reset combat to default state
 * Restores default combatants, resets turn to 0 and round to 1
 */
function resetToDefaults(): void {
  turn.value = 0
  round.value = 1
  combatants.value = getDefaultCombatants(gameSystem.value)
}

function saveEncounter(name: string): void {
  const encounterId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const snapshot = orderedCombatants.value.map((combatant: Combatant) => new Combatant(
    combatant.name,
    combatant.totalHP,
    combatant.initiative,
    combatant.currentHP,
    combatant.conditions.map((condition: Condition) => new Condition(condition.name, condition.value)),
    combatant.visibility,
    combatant.tempHP || 0,
    combatant.maxTempHP || 0
  ))

  savedEncounters.value = [
    ...savedEncounters.value,
    {
      id: encounterId,
      name,
      combatants: snapshot
    }
  ]
}

function loadEncounter(encounterId: string): void {
  const selected = savedEncounters.value.find((encounter) => encounter.id === encounterId)
  if (!selected) {
    return
  }

  combatants.value = selected.combatants.map((combatant) => new Combatant(
    combatant.name,
    combatant.totalHP,
    combatant.initiative,
    combatant.currentHP,
    combatant.conditions.map((condition) => new Condition(condition.name, condition.value)),
    combatant.visibility,
    combatant.tempHP || 0,
    combatant.maxTempHP || 0
  ))
  turn.value = 0
  round.value = 1
}

function deleteEncounter(encounterId: string): void {
  savedEncounters.value = savedEncounters.value.filter((encounter) => encounter.id !== encounterId)
}

async function handleSignInWithGoogle(): Promise<void> {
  try {
    await signInWithGoogle()
  } catch (error) {
    console.error('Google sign-in failed:', error)
  }
}

async function handleSignInWithGithub(): Promise<void> {
  try {
    await signInWithGithub()
  } catch (error) {
    console.error('GitHub sign-in failed:', error)
  }
}

async function handleSignOutGM(): Promise<void> {
  signOutLocalGM()

  try {
    await signOutGM()
  } catch (error) {
    if (firebaseUser.value) {
      console.error('Sign-out failed:', error)
    }
  }
}

function handleSignInLocalGM(): void {
  const name = window.prompt(t.value.dm_actions.localNamePrompt)
  if (!name) return

  const passphrase = window.prompt(t.value.dm_actions.localPassphrasePrompt)
  if (!passphrase) return

  const loggedIn = signInLocalGM(name, passphrase)
  if (!loggedIn) {
    console.error('Local sign-in failed: missing name or passphrase.')
  }
}

</script>

<template>
  <div v-if="!isInitialized" class="flex items-center justify-center min-h-screen">
    <div class="loading loading-spinner loading-lg"></div>
  </div>

  <DMView
      v-else-if="isDMView"
      :turn="turn"
      :round="round"
      :combatants="orderedCombatants"
      :isOnlineMode="isOnlineMode"
      :sessionId="sessionId"
      :onlineProvider="onlineProvider"
      :availableOnlineProviders="availableOnlineProviders"
      :isOnlineAvailable="isOnlineAvailable"
      :savedEncounters="savedEncounters.map(encounter => ({ id: encounter.id, name: encounter.name }))"
      :gmUserEmail="firebaseUser?.email || localGMUser?.displayName || ''"
      :isGMLoggedIn="!!firebaseUser || !!localGMUser"
      @nextTurn="nextTurn"
      @reset="reset"
      @resetToDefaults="resetToDefaults"
      @newCombatant="addCombatant"
      @removeCombatant="removeCombatant"
      @toggleOnlineMode="toggleOnlineMode"
      @setOnlineProvider="setOnlineProvider"
      @saveEncounter="saveEncounter"
      @loadEncounter="loadEncounter"
      @deleteEncounter="deleteEncounter"
      @signInWithGoogle="handleSignInWithGoogle"
      @signInWithGithub="handleSignInWithGithub"
      @signInLocalGM="handleSignInLocalGM"
      @signOutGM="handleSignOutGM"
  />

  <PlayerSimpleView
      v-else-if="viewMode === 'on-deck' || viewMode === 'player-simple'"
      :turn="turn"
      :round="round"
      :combatants="orderedCombatants"
  />

  <PlayerView
      v-else
      :turn="turn"
      :round="round"
      :combatants="orderedCombatants"
  />
</template>

<style scoped>

</style>
