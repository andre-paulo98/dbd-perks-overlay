<template>
  <div class="perk-grid">
    <div v-for="n in 4" :key="n" class="perk-cell" :class="{ filled: !!perks[n - 1] }">
      <template v-if="perks[n - 1] && entryFor(perks[n - 1])">
        <img :src="perks[n - 1]" :alt="entryFor(perks[n - 1]).name" class="perk-icon" />
        <div class="perk-text">
          <div class="perk-name">
            {{ entryFor(perks[n - 1]).name }}
            <button class="perk-clear" title="Clear this perk" @click="$emit('clear-slot', n)">
              ×
            </button>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="perk-desc" v-html="entryFor(perks[n - 1]).description"></div>
        </div>
      </template>
      <div v-else class="perk-empty">
        <img :src="emptySlotImage" alt="Empty slot" class="perk-icon perk-icon-empty" />
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  perks: { type: Array, required: true },
  // Plain object: absolute image URL -> catalog entry ({name, description, ...})
  catalogByUrl: { type: Object, required: true },
});
defineEmits(['clear-slot']);

const emptySlotImage = '/perks/empty.png';

function entryFor(url) {
  return props.catalogByUrl[url];
}
</script>

<style scoped>
.perk-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  max-width: 720px;
  margin: 0 auto 24px;
}

.perk-cell {
  display: flex;
  gap: 12px;
  padding: 14px;
  min-height: 96px;
  border-radius: 10px;
  border: 2px solid #2e2e35;
  background: #1c1c22;
}

.perk-cell.filled {
  border-color: #4a4a54;
}

.perk-icon {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 8px;
}

.perk-text {
  min-width: 0;
  flex: 1;
}

.perk-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 700;
  margin-bottom: 4px;
}

.perk-clear {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: #e63946;
  color: white;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
}

.perk-desc {
  font-size: 0.82rem;
  line-height: 1.4;
  color: #b8b8c0;
}

.perk-desc :deep(ul) {
  margin: 4px 0 0;
  padding-left: 18px;
}

.perk-icon-empty {
  object-fit: contain;
  opacity: 0.6;
}

.perk-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
</style>
