<template>
  <div class="perk-picker">
    <input v-model="query" type="text" placeholder="Search perks…" class="search" />

    <p v-if="catalog.length === 0" class="empty-catalog">
      No perks in the catalog yet — add some to
      <code>server/public/perks/perks.json</code>.
    </p>

    <div v-else class="grid">
      <button
        v-for="perk in filtered"
        :key="perk.id"
        class="perk-item"
        @click="$emit('pick', perk)"
      >
        <img :src="`/perks/${perk.image}`" :alt="perk.name" />
        <span>{{ perk.name }}</span>
      </button>

      <p v-if="filtered.length === 0" class="empty-catalog">No perks match "{{ query }}".</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  catalog: { type: Array, required: true },
});
defineEmits(['pick']);

const query = ref('');

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.catalog;
  return props.catalog.filter((p) => p.name.toLowerCase().includes(q));
});
</script>

<style scoped>
.perk-picker {
  max-width: 640px;
  margin: 0 auto;
}

.search {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #3a3a42;
  background: #1c1c22;
  color: #eee;
  font-size: 1rem;
  margin-bottom: 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}

.perk-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #2e2e35;
  background: #1c1c22;
  color: #ccc;
  cursor: pointer;
  text-align: center;
}

.perk-item:hover {
  border-color: #e63946;
}

.perk-item img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
}

.perk-item span {
  font-size: 0.75rem;
  line-height: 1.2;
}

.empty-catalog {
  color: #8a8a94;
  text-align: center;
  padding: 24px 0;
}
</style>
