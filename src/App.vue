<script setup lang="ts">
import { onMounted, ref } from "vue";
import { mountDrumMachine } from "./drum-machine";

const root = ref<HTMLDivElement | null>(null);

onMounted(() => {
  if (!root.value) {
    throw new Error("Root Vue da drum machine nao encontrado.");
  }

  mountDrumMachine(root.value);
});
</script>

<template>
  <div ref="root" class="vue-shell"></div>
</template>
