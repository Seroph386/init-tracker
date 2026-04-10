<script setup lang="ts">

import {onMounted, ref} from "vue";
import DMTable from "./DMTable.vue";
import Settings from "./Settings.vue";
import {combatantColorKeys, Combatant, formatCombatantName, type CombatantColorKey, Visibility} from "./functions.ts";
import {Icon} from "@iconify/vue";
import {useTranslations} from "./lang.ts";
import {
  Label,
  NumberFieldInput,
  NumberFieldRoot,
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from "reka-ui";
import {getEnabledMonsters, getDefaultEnabledSources, type Monster, type GameSystem} from "./db.ts";
import {useStorage} from "@vueuse/core";
import {computed, watch} from "vue";
import type {OnlineProvider} from "./online.ts";

const { t } = useTranslations()

const emit = defineEmits<{
  (e: 'nextTurn'): void
  (e: 'reset'): void
  (e: 'resetToDefaults'): void
  (e: 'newCombatant', name: string, HP: number, initiative: number, visibility: Visibility): void
  (e: 'removeCombatant', index: number): void
  (e: 'toggleOnlineMode', value: boolean): void
  (e: 'setOnlineProvider', value: OnlineProvider): void
  (e: 'saveEncounter', name: string): void
  (e: 'loadEncounter', id: string): void
  (e: 'deleteEncounter', id: string): void
  (e: 'signInWithGoogle'): void
  (e: 'signInWithGithub'): void
  (e: 'signOutGM'): void
}>()

const props = defineProps<{
  turn: number,
  round: number,
  combatants: Combatant[],
  isOnlineMode: boolean,
  sessionId: string,
  onlineProvider: OnlineProvider | '',
  availableOnlineProviders: OnlineProvider[],
  isOnlineAvailable: boolean,
  savedEncounters: Array<{ id: string, name: string }>,
  isGMLoggedIn: boolean,
  gmUserEmail: string,
}>()

const copiedButton = ref<'player' | 'on-deck' | null>(null)
let copiedMessageTimeout: ReturnType<typeof setTimeout> | null = null
const showResetConfirm = ref(false)
const isSettingsOpen = ref(false)
const docsParams = new URLSearchParams(window.location.search)
const docsDemo = docsParams.get('docs-demo') === 'readme'
const docsPanel = docsParams.get('docs-panel')

const newName = ref('')
const newHP = ref(1)
const newInitiative = ref(1)
const newVisibility = ref(Visibility.None)
const newColor = ref<CombatantColorKey>('none')
const newQuantity = ref(1)
const isNewCombatantPopoverOpen = ref(false)
const isSaveEncounterPopoverOpen = ref(false)
const isLoadEncounterPopoverOpen = ref(false)
const newEncounterName = ref('')
const selectedEncounterId = ref('')
const encounterError = ref('')
const colorOptions = computed(() =>
  combatantColorKeys.map((colorKey) => ({
    value: colorKey,
    label: t.value.colors[colorKey]
  }))
)

onMounted(() => {
  if (!docsDemo) {
    return
  }

  if (docsPanel === 'save-encounter') {
    isSaveEncounterPopoverOpen.value = true
    return
  }

  if (docsPanel === 'load-encounter') {
    isLoadEncounterPopoverOpen.value = true
    return
  }

  newName.value = 'Ash Skeleton'
  newHP.value = 16
  newInitiative.value = 14
  newVisibility.value = Visibility.None
  newColor.value = 'none'
  newQuantity.value = 3
  isNewCombatantPopoverOpen.value = true
})

// Get enabled content sources and generate monster list
const gameSystem = useStorage<GameSystem>('gameSystem', 'pathfinder')
const enabledContentSources = useStorage<string[]>('enabledContentSources', getDefaultEnabledSources(gameSystem.value))
const monsterList = computed<Monster[]>(() => getEnabledMonsters(enabledContentSources.value))

// Watch for monster selection and auto-fill HP if available
watch(newName, (selectedName) => {
  const monster = monsterList.value.find(m => m.name === selectedName)
  if (monster && monster.hp > 1) {
    newHP.value = monster.hp
  }
})

watch(isSaveEncounterPopoverOpen, (isOpen) => {
  if (!isOpen) {
    encounterError.value = ''
    return
  }

  newEncounterName.value = docsDemo && docsPanel === 'save-encounter'
    ? 'Abomination Vaults - Level 1'
    : ''
})

watch(isLoadEncounterPopoverOpen, (isOpen) => {
  if (!isOpen) {
    return
  }

  if (!selectedEncounterId.value && props.savedEncounters.length > 0) {
    selectedEncounterId.value = props.savedEncounters[0].id
  }
})

watch(() => props.savedEncounters, (encounters) => {
  if (encounters.some((encounter) => encounter.id === selectedEncounterId.value)) {
    return
  }

  selectedEncounterId.value = encounters[0]?.id ?? ''
}, { deep: true })

function changeNewVisibility(): void {
  newVisibility.value++
  if (newVisibility.value > 2) newVisibility.value = 0
}

function clearNewCombatant(): void {
  newName.value = ''
  newHP.value = 1
  newInitiative.value = 1
  newVisibility.value = Visibility.None
  newColor.value = 'none'
  newQuantity.value = 1
  document.getElementById('newName')?.focus()
}

/**
 * Generates a unique name using the selected color and count suffix
 * @param i - Index of the combatant being spawned (0-based)
 * @returns The combatant name with color and count suffix
 */
function getCombatantName(i: number): string {
  const selectedColorLabel = newColor.value === 'none'
    ? undefined
    : t.value.colors[newColor.value]

  return newQuantity.value === 1
    ? formatCombatantName(newName.value, selectedColorLabel)
    : formatCombatantName(newName.value, selectedColorLabel, i + 1)
}

function addCombatant(): void {
  for (let i = 0; i < newQuantity.value; i++) {
    emit('newCombatant', getCombatantName(i), newHP.value, newInitiative.value, newVisibility.value)
  }
  isNewCombatantPopoverOpen.value = false
  setTimeout(clearNewCombatant, 1)
}

function removeCombatant(index: number): void {
  emit('removeCombatant', index)
}

function saveEncounter(): void {
  if (!props.isGMLoggedIn) {
    encounterError.value = t.value.dm_actions.signInRequiredForCloudSaves
    return
  }

  const trimmedName = newEncounterName.value.trim()
  if (!trimmedName) {
    encounterError.value = t.value.dm_actions.encounterRequired
    return
  }

  emit('saveEncounter', trimmedName)
  encounterError.value = ''
  newEncounterName.value = ''
  isSaveEncounterPopoverOpen.value = false
}

function loadEncounter(): void {
  if (!selectedEncounterId.value) {
    return
  }

  emit('loadEncounter', selectedEncounterId.value)
  isLoadEncounterPopoverOpen.value = false
}

function deleteEncounter(): void {
  if (!selectedEncounterId.value) {
    return
  }

  emit('deleteEncounter', selectedEncounterId.value)
  selectedEncounterId.value = ''
}

function signInWithGoogle(): void {
  emit('signInWithGoogle')
}

function signInWithGithub(): void {
  emit('signInWithGithub')
}

function signOutGMUser(): void {
  emit('signOutGM')
}

/**
 * Reset confirmation dialog handlers
 */
function requestReset() {
  showResetConfirm.value = true
}

function cancelReset() {
  showResetConfirm.value = false
}

function confirmReset() {
  showResetConfirm.value = false
  emit('resetToDefaults')
}

/**
 * Copy player view URL to clipboard
 * Constructs URL with session ID and view=player parameter
 */
async function copyPlayerUrl(): Promise<void> {
  if (!props.sessionId) return

  const url = new URL(window.location.href)
  url.searchParams.set('session', props.sessionId)
  url.searchParams.set('view', 'player')
  if (props.onlineProvider) {
    url.searchParams.set('backend', props.onlineProvider)
  }

  try {
    await navigator.clipboard.writeText(url.toString())
    copiedButton.value = 'player'

    if (copiedMessageTimeout) {
      clearTimeout(copiedMessageTimeout)
    }

    copiedMessageTimeout = setTimeout(() => {
      copiedButton.value = null
      copiedMessageTimeout = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy URL:', err)
  }
}
async function copyOnDeckUrl(): Promise<void> {
  if (!props.sessionId) return

  const url = new URL(window.location.href)
  url.searchParams.set('session', props.sessionId)
  url.searchParams.set('view', 'on-deck')
  if (props.onlineProvider) {
    url.searchParams.set('backend', props.onlineProvider)
  }

  try {
    await navigator.clipboard.writeText(url.toString())
    copiedButton.value = 'on-deck'

    if (copiedMessageTimeout) {
      clearTimeout(copiedMessageTimeout)
    }

    copiedMessageTimeout = setTimeout(() => {
      copiedButton.value = null
      copiedMessageTimeout = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy URL:', err)
  }
}
</script>

<template>
  <div>
    <div>
      <article class="prose ml-8">
        <h3>{{t.table.round}} {{round}}</h3>
      </article>
      <DMTable :combatants="combatants" :turn="turn" @removeCombatant="removeCombatant" class="shadow-md/50" />
      <div class="grid grid-cols-1 gap-4">
        <div class="flex flex-wrap gap-3">
          <button class="btn btn-neutral w-full sm:w-auto" @click="$emit('nextTurn')" :aria-label="t.dm_actions.next"><Icon icon="tabler:player-skip-forward" height="24" />{{t.dm_actions.next}}</button>
          <button class="btn btn-error tooltip tooltip-bottom before:delay-200 w-full sm:w-auto" :data-tip="t.dm_actions.resetTooltip" @click="$emit('reset')" :aria-label="t.dm_actions.reset"><Icon icon="tabler:refresh" height="24" />{{t.dm_actions.reset}}</button>
          <a v-if="!isOnlineMode" class="btn btn-neutral w-full sm:w-auto" href="?view=player" :aria-label="t.dm_actions.playerView"><Icon icon="tabler:users-group" height="24" />{{t.dm_actions.playerView}}</a>
          <button
            v-else
            class="btn btn-neutral relative w-full sm:w-auto"
            @click="copyPlayerUrl"
            :aria-label="t.dm_actions.copyPlayerUrl"
          >
            <Icon icon="tabler:users-group" height="24" />
            {{t.dm_actions.copyPlayerUrl}}
            <div v-if="copiedButton === 'player'" class="absolute -top-12 left-1/2 -translate-x-1/2 badge badge-success text-sm whitespace-nowrap">
              {{t.dm_actions.copiedToClipboard}}
            </div>
          </button>
          <a v-if="!isOnlineMode" class="btn btn-neutral w-full sm:w-auto" href="?view=on-deck" :aria-label="t.dm_actions.onDeckView"><Icon icon="tabler:presentation" height="24" />{{t.dm_actions.onDeckView}}</a>
          <button
            v-if="isOnlineMode"
            class="btn btn-neutral relative w-full sm:w-auto"
            @click="copyOnDeckUrl"
            :aria-label="t.dm_actions.copyOnDeckUrl"
          >
            <Icon icon="tabler:presentation" height="24" />
            {{t.dm_actions.copyOnDeckUrl}}
            <div v-if="copiedButton === 'on-deck'" class="absolute -top-12 left-1/2 -translate-x-1/2 badge badge-success text-sm whitespace-nowrap">
              {{ t.dm_actions.copiedToClipboard }}
            </div>
          </button>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            class="btn btn-neutral w-full sm:w-auto"
            :aria-label="t.options.settings"
            @click="isSettingsOpen = true"
          >
            <Icon icon="tabler:settings" height="24" />
            {{t.options.settings}}
          </button>
        </div>
        <div class="flex flex-wrap gap-3">
          <div v-if="availableOnlineProviders.includes('firebase')" class="flex flex-wrap items-center gap-2 w-full">
            <span v-if="isGMLoggedIn" class="badge badge-success px-3 py-4">
              {{ t.dm_actions.loggedInAs }} {{ gmUserEmail }}
            </span>
            <button v-if="!isGMLoggedIn" class="btn btn-outline btn-sm" @click="signInWithGoogle">
              <Icon icon="tabler:brand-google" height="20" />
              {{ t.dm_actions.signInGoogle }}
            </button>
            <button v-if="!isGMLoggedIn" class="btn btn-outline btn-sm" @click="signInWithGithub">
              <Icon icon="tabler:brand-github" height="20" />
              {{ t.dm_actions.signInGithub }}
            </button>
            <button v-if="isGMLoggedIn" class="btn btn-outline btn-sm" @click="signOutGMUser">
              <Icon icon="tabler:logout" height="20" />
              {{ t.dm_actions.signOut }}
            </button>
          </div>
          <PopoverRoot :open="isNewCombatantPopoverOpen" @update:open="value => isNewCombatantPopoverOpen = value">
            <PopoverTrigger as-child>
              <button class="btn btn-neutral w-full sm:w-auto" :aria-label="t.dm_actions.add"><Icon icon="tabler:plus" height="24" /> {{t.dm_actions.add}}</button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent class="card w-[calc(100vw-2rem)] max-w-md bg-base-300 card-md shadow-l" role="dialog" aria-label="Add new combatant">
                <div class="card-body" @keydown.enter.prevent="addCombatant">
                  <div class="grid grid-cols-3 items-center gap-4">
                    <Label for="newName">{{t.table.name}}</Label>
                    <input id="newName" tabindex="1" type="text" class="input col-span-2 h-8" list="monsters" v-model="newName" aria-label="Combatant name" />
                    <datalist id="monsters">
                      <option v-for="monster in monsterList" :key="monster.name">{{monster.name}}</option>
                    </datalist>
                  </div>
                  <div class="grid grid-cols-3 items-center gap-4">
                    <Label for="newHP">{{t.table.hp}}</Label>
                    <NumberFieldRoot :min="1" v-model="newHP" class="col-span-2">
                      <NumberFieldInput tabindex="2" id="newHP" class="input h-8" />
                    </NumberFieldRoot>
                  </div>
                  <div class="grid grid-cols-3 items-center gap-4">
                    <Label for="newInitiative">{{t.table.initiative}}</Label>
                    <NumberFieldRoot :min="1" v-model="newInitiative" class="col-span-2">
                      <NumberFieldInput tabindex="3" id="newInitiative" class="input h-8" />
                    </NumberFieldRoot>
                  </div>
                  <div class="grid grid-cols-3 items-center gap-4">
                    <Label for="newColor">{{t.dm_actions.color}}</Label>
                    <select id="newColor" tabindex="4" v-model="newColor" class="select select-bordered col-span-2 h-8 min-h-8">
                      <option v-for="option in colorOptions" :key="option.value" :value="option.value">{{option.label}}</option>
                    </select>
                  </div>
                  <div class="grid grid-cols-3 items-center gap-4">
                    <Label for="newQuantity">{{t.dm_actions.quantity}}</Label>
                    <NumberFieldRoot :min="1" v-model="newQuantity" class="col-span-2">
                      <NumberFieldInput tabindex="5" id="newQuantity" class="input h-8" />
                    </NumberFieldRoot>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button @click="changeNewVisibility" tabindex="6" class="btn btn-neutral btn-sm">
                      <Icon v-if="newVisibility === Visibility.Full" icon="tabler:eye" height="24" />
                      <Icon v-else-if="newVisibility === Visibility.Half" icon="tabler:eye-off" height="24" />
                      <Icon v-else-if="newVisibility === Visibility.None" icon="tabler:eye-closed" height="24" />
                    </button>
                    <button @click="clearNewCombatant" tabindex="7" class="btn btn-error btn-sm"><Icon icon="tabler:eraser" height="24" />{{t.dm_actions.clear}}</button>
                    <button @click="addCombatant" tabindex="8" class="btn btn-neutral btn-sm"><Icon icon="tabler:plus" height="24" />{{t.dm_actions.add}}</button>
                  </div>
                </div>
                <PopoverArrow class="fill-base-300" />
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
          <PopoverRoot :open="isSaveEncounterPopoverOpen" @update:open="value => isSaveEncounterPopoverOpen = value">
            <PopoverTrigger as-child>
              <button class="btn btn-neutral w-full sm:w-auto" :aria-label="t.dm_actions.saveEncounter">
                <Icon icon="tabler:device-floppy" height="24" />
                {{ t.dm_actions.saveEncounter }}
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent class="card w-[calc(100vw-2rem)] max-w-sm bg-base-300 card-md shadow-l" role="dialog" :aria-label="t.dm_actions.saveEncounter">
                <div class="card-body gap-3" @keydown.enter.prevent="saveEncounter">
                  <label class="form-control">
                    <span class="label-text">{{ t.dm_actions.encounterName }}</span>
                    <input
                      v-model="newEncounterName"
                      type="text"
                      class="input input-bordered w-full"
                      :placeholder="t.dm_actions.encounterName"
                    />
                  </label>
                  <p v-if="!isGMLoggedIn" class="text-sm opacity-75">
                    {{ t.dm_actions.signInRequiredForCloudSaves }}
                  </p>
                  <p v-if="encounterError" class="text-error text-sm">{{ encounterError }}</p>
                  <div class="flex flex-wrap justify-end gap-2">
                    <button class="btn btn-neutral w-full sm:w-auto" :disabled="!isGMLoggedIn" @click="saveEncounter">
                      <Icon icon="tabler:device-floppy" height="20" />
                      {{ t.dm_actions.saveEncounter }}
                    </button>
                  </div>
                </div>
                <PopoverArrow class="fill-base-300" />
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
          <PopoverRoot :open="isLoadEncounterPopoverOpen" @update:open="value => isLoadEncounterPopoverOpen = value">
            <PopoverTrigger as-child>
              <button class="btn btn-neutral w-full sm:w-auto" :aria-label="t.dm_actions.loadEncounter">
                <Icon icon="tabler:upload" height="24" />
                {{ t.dm_actions.loadEncounter }}
              </button>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverContent class="card w-[calc(100vw-2rem)] max-w-sm bg-base-300 card-md shadow-l" role="dialog" :aria-label="t.dm_actions.savedEncounters">
                <div class="card-body gap-3" @keydown.enter.prevent="loadEncounter">
                  <label v-if="savedEncounters.length > 0" class="form-control">
                    <span class="label-text">{{ t.dm_actions.savedEncounters }}</span>
                    <select v-model="selectedEncounterId" class="select select-bordered w-full">
                      <option value="" disabled>{{ t.dm_actions.savedEncounters }}</option>
                      <option v-for="encounter in savedEncounters" :key="encounter.id" :value="encounter.id">
                        {{ encounter.name }}
                      </option>
                    </select>
                  </label>
                  <p v-else class="text-sm opacity-75">
                    {{ t.dm_actions.noSavedEncounters }}
                  </p>
                  <div v-if="savedEncounters.length > 0" class="flex flex-wrap justify-end gap-2">
                    <button class="btn btn-error w-full sm:w-auto" :disabled="!selectedEncounterId" @click="deleteEncounter">
                      <Icon icon="tabler:trash" height="20" />
                      {{ t.dm_actions.deleteEncounter }}
                    </button>
                    <button class="btn btn-primary w-full sm:w-auto" :disabled="!selectedEncounterId" @click="loadEncounter">
                      <Icon icon="tabler:upload" height="20" />
                      {{ t.dm_actions.loadEncounter }}
                    </button>
                  </div>
                </div>
                <PopoverArrow class="fill-base-300" />
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Dialog -->
  <div v-if="showResetConfirm" class="fixed inset-0 z-[9999] flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50" @click="cancelReset"></div>

    <!-- Dialog -->
    <div class="card bg-base-100 w-96 shadow-xl relative z-10">
      <div class="card-body">
        <h3 class="card-title text-error">
          <Icon icon="tabler:alert-triangle" height="24" />
          {{t.options.resetConfirmTitle}}
        </h3>
        <p>{{t.options.resetConfirmMessage}}</p>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-ghost" @click="cancelReset">
            {{t.options.resetConfirmNo}}
          </button>
          <button class="btn btn-error" @click="confirmReset">
            <Icon icon="tabler:refresh" height="20" />
            {{t.options.resetConfirmYes}}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Settings Modal -->
  <Settings
    :isOnlineMode="isOnlineMode"
    :sessionId="sessionId"
    :isDMView="true"
    :isOpen="isSettingsOpen"
    :onlineProvider="onlineProvider"
    :availableOnlineProviders="availableOnlineProviders"
    :isOnlineAvailable="isOnlineAvailable"
    @toggleOnlineMode="(value) => $emit('toggleOnlineMode', value)"
    @setOnlineProvider="(value) => $emit('setOnlineProvider', value)"
    @requestReset="requestReset"
    @close="isSettingsOpen = false"
  />
  </div>
</template>

<style scoped>

</style>
