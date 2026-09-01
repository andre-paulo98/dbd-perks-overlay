<template>
  <div class="perk-slots">
    <div
      v-for="n in 4"
      :key="n"
      class="slot"
      :class="{ active: activeSlot === n, filled: !!perks[n - 1] }"
      @click="$emit('select-slot', n)"
    >
      <img v-if="perks[n - 1]" :src="perks[n - 1]" :alt="`Perk slot ${n}`" />
      <span v-else class="empty">{{ n }}</span>

      <button
        v-if="perks[n - 1]"
        class="slot-clear"
        title="Clear this slot"
        @click.stop="$emit('clear-slot', n)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  perks: { type: Array, required: true },
  activeSlot: { type: Number, default: 0 },
});
defineEmits(['select-slot', 'clear-slot']);
</script>

<style scoped>
.perk-slots {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 24px 0;
}

.slot {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 10px;
  border: 2px solid #3a3a42;
  background: #1c1c22;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.slot:hover {
  border-color: #6a6a76;
}

.slot.active {
  border-color: #e63946;
  box-shadow: 0 0 0 2px rgba(230, 57, 70, 0.35);
}

.slot.filled {
  border-color: #4a4a54;
}

.slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.slot .empty {
  color: #5a5a64;
  font-size: 1.4rem;
  font-weight: 600;
}

.slot-clear {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: #e63946;
  color: white;
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
}
</style>
