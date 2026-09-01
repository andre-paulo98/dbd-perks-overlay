<template>
  <div class="perk-search">
    <div v-if="showResults && filtered.length" class="results-popup">
      <button
        v-for="(perk, i) in filtered"
        :key="perk.id"
        type="button"
        class="result-item"
        :class="{ highlighted: i === highlightIndex }"
        @mousedown.prevent="select(perk)"
        @mouseenter="highlightIndex = i"
      >
        <img :src="`/perks/${perk.image}`" :alt="perk.name" />
        <span>{{ perk.name }}</span>
      </button>
    </div>

    <input
      v-model="query"
      type="text"
      :placeholder="`Search ${roleLabel} perks…`"
      class="search-input"
      @focus="showResults = true"
      @input="showResults = true"
      @blur="showResults = false"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.esc="showResults = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  catalog: { type: Array, required: true }, // already filtered by role
  roleLabel: { type: String, default: 'killer' },
});
const emit = defineEmits(['pick']);

const query = ref('');
const showResults = ref(false);
const highlightIndex = ref(0);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return props.catalog.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
});

watch(filtered, () => {
  highlightIndex.value = 0;
});

function move(delta) {
  if (!filtered.value.length) return;
  showResults.value = true;
  const n = filtered.value.length;
  highlightIndex.value = (highlightIndex.value + delta + n) % n;
}

function select(perk) {
  emit('pick', perk);
  query.value = '';
  // showResults stays true - the input keeps focus after a pick, so the
  // popup should too, ready for the next search without a refocus.
}

function selectHighlighted() {
  const perk = filtered.value[highlightIndex.value];
  if (perk) select(perk);
}
</script>

<style scoped>
.perk-search {
  position: relative;
  max-width: 480px;
  margin: 0 auto;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #3a3a42;
  background: #1c1c22;
  color: #eee;
  font-size: 1rem;
}

.results-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 320px;
  overflow-y: auto;
  border-radius: 10px;
  border: 1px solid #3a3a42;
  background: #1c1c22;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #eee;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
}

.result-item img {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}

.result-item.highlighted {
  background: #e63946;
}
</style>
