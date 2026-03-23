<script setup lang="ts">
import { computed } from "vue";
import { Combatant } from "./functions.ts";
import { useTranslations } from "./lang.ts";

const { t } = useTranslations();

const props = defineProps<{
  turn: number,
  round: number,
  combatants: Combatant[],
}>();

const currentCombatant = computed(() => {
  if (!props.combatants.length) return null;
  return props.combatants[props.turn] ?? null;
});

const nextCombatant = computed(() => {
  if (!props.combatants.length) return null;
  const nextIndex = (props.turn + 1) % props.combatants.length;
  return props.combatants[nextIndex] ?? null;
});
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
          <div class="text-5xl md:text-7xl font-bold break-words">
            {{ currentCombatant?.name || "—" }}
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow-xl border border-base-300">
        <div class="card-body items-center text-center">
          <h2 class="card-title text-xl md:text-2xl opacity-70">
            Next Up
          </h2>
          <div class="text-4xl md:text-6xl font-semibold break-words">
            {{ nextCombatant?.name || "—" }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>