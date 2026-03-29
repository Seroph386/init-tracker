<script setup lang="ts">
import { computed } from "vue";
import { colorIsDark, Combatant, getHpTextClass, getVisibleCombatantAtOrAfter, Visibility } from "./functions.ts";
import { useTranslations } from "./lang.ts";

const { t } = useTranslations();

const props = defineProps<{
  turn: number,
  round: number,
  combatants: Combatant[],
}>();

const currentCombatant = computed(() => {
  return getVisibleCombatantAtOrAfter(props.combatants, props.turn);
});

const nextCombatant = computed(() => {
  return getVisibleCombatantAtOrAfter(props.combatants, props.turn + 1);
});

function getVisibleHpTextClass(combatant: Combatant | null): string {
  if (!combatant || combatant.visibility === Visibility.None) {
    return "text-base-content";
  }

  return getHpTextClass(combatant);
}

function formatConditionLabel(name: string, value: number): string {
  return value > 1 ? `${name} ${value}` : name;
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-12 px-8 text-center">
    <article class="prose">
      <h3>{{ t.table.round }} {{ round }}</h3>
    </article>

    <div class="w-full max-w-5xl flex flex-col gap-10">
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body items-center text-center">
          <h2 class="card-title text-2xl md:text-3xl opacity-70">
            Current Turn
          </h2>
          <div
            class="text-5xl md:text-7xl font-bold break-words transition-colors"
            :class="getVisibleHpTextClass(currentCombatant)"
          >
            {{ currentCombatant?.name || "—" }}
          </div>
          <div
            v-if="currentCombatant?.conditions?.length"
            class="mt-4 flex flex-wrap items-center justify-center gap-2"
          >
            <span
              v-for="condition in currentCombatant.conditions"
              :key="`${currentCombatant.name}-${condition.name}`"
              :class="['badge badge-lg md:badge-xl px-4 py-3', {
                'text-accent-content': !colorIsDark(condition.color),
              }]"
              :style="{ backgroundColor: condition.color }"
            >
              {{ formatConditionLabel(condition.name, condition.value) }}
            </span>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow-xl border border-base-300">
        <div class="card-body items-center text-center">
          <h2 class="card-title text-xl md:text-2xl opacity-70">
            On Deck
          </h2>
          <div
            class="text-4xl md:text-6xl font-semibold break-words transition-colors"
            :class="getVisibleHpTextClass(nextCombatant)"
          >
            {{ nextCombatant?.name || "—" }}
          </div>
          <div
            v-if="nextCombatant?.conditions?.length"
            class="mt-4 flex flex-wrap items-center justify-center gap-2"
          >
            <span
              v-for="condition in nextCombatant.conditions"
              :key="`${nextCombatant.name}-${condition.name}`"
              :class="['badge badge-lg px-4 py-3', {
                'text-accent-content': !colorIsDark(condition.color),
              }]"
              :style="{ backgroundColor: condition.color }"
            >
              {{ formatConditionLabel(condition.name, condition.value) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
