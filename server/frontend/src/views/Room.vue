<template>
  <div v-if="notFound" class="center-screen">
    <p>Room "{{ code }}" doesn't exist — maybe it expired, or the code's wrong.</p>
    <button @click="goHome">Start a new room</button>
  </div>

  <div v-else class="app">
    <header>
      <div class="room-code">
        <span class="label">Room code</span>
        <span class="code">{{ code }}</span>
        <button @click="copyLink">{{ copied ? 'Copied!' : 'Copy link' }}</button>
      </div>
      <span class="status" :class="status">{{ statusLabel }}</span>
    </header>

    <div class="mode-toggle">
      <button :class="{ active: mode === 'killer' }" @click="mode = 'killer'">Killer</button>
      <button class="locked" disabled title="Survivor perks aren't supported yet">
        Survivor 🔒
      </button>
    </div>

    <PerkGrid :perks="perks" :catalog-by-url="catalogByUrl" @clear-slot="clearSlot" />

    <div class="actions">
      <button class="clear-all" @click="clearAll">Clear all</button>
    </div>

    <PerkSearch :catalog="modeFilteredCatalog" :role-label="mode" @pick="addPerk" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { useRoomSocket } from '../composables/useRoomSocket';
import PerkGrid from '../components/PerkGrid.vue';
import PerkSearch from '../components/PerkSearch.vue';

const props = defineProps({ code: { type: String, required: true } });
const code = props.code.toUpperCase();

const router = useRouter();
const notFound = ref(false);
const catalog = ref([]);
const mode = ref('killer');
const copied = ref(false);

const { perks, status, setPerk, clear, disconnect } = useRoomSocket(code);

const statusLabel = computed(
  () =>
    ({
      connecting: 'Connecting…',
      open: 'Live',
      closed: 'Reconnecting…',
    })[status.value] || '',
);

const modeFilteredCatalog = computed(() => catalog.value.filter((p) => p.role === mode.value));

// Maps each perk's absolute image URL (the same string form sent over the
// socket) back to its full catalog entry, so the grid can show name +
// description for whatever's currently in each slot.
const catalogByUrl = computed(() => {
  const map = {};
  for (const perk of catalog.value) {
    map[`${window.location.origin}/perks/${perk.image}`] = perk;
  }
  return map;
});

onMounted(async () => {
  const room = await api.getRoom(code);
  if (!room) {
    notFound.value = true;
    disconnect();
    return;
  }
  catalog.value = await api.getPerks();
});

onBeforeUnmount(disconnect);

function addPerk(perk) {
  const index = perks.value.findIndex((p) => !p); // first empty slot
  if (index === -1) return; // all 4 full - ignore rather than overwrite
  const url = `${window.location.origin}/perks/${perk.image}`;
  setPerk(index + 1, url);
}

function clearSlot(n) {
  setPerk(n, null);
}

function clearAll() {
  clear();
}

function goHome() {
  router.push('/');
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard API unavailable (e.g. non-HTTPS context) - fail silently,
    // the code is still visible on screen to copy by hand.
  }
}
</script>

<style scoped>
.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 16px 48px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.room-code {
  display: flex;
  align-items: center;
  gap: 10px;
}

.room-code .label {
  color: #8a8a94;
  font-size: 0.85rem;
}

.room-code .code {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.15em;
}

.room-code button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #3a3a42;
  background: #1c1c22;
  color: #ccc;
  cursor: pointer;
}

.status {
  font-size: 0.85rem;
  color: #8a8a94;
}

.status.open {
  color: #4caf78;
}

.status.closed {
  color: #e63946;
}

.mode-toggle {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.mode-toggle button {
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid #3a3a42;
  background: #1c1c22;
  color: #999;
  cursor: pointer;
  font-weight: 600;
}

.mode-toggle button.active {
  border-color: #e63946;
  color: #fff;
  background: #2a1518;
}

.mode-toggle button.locked {
  cursor: not-allowed;
  opacity: 0.5;
}

.actions {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.clear-all {
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid #e63946;
  background: transparent;
  color: #e63946;
  cursor: pointer;
  font-weight: 600;
}

.clear-all:hover {
  background: #e63946;
  color: white;
}
</style>
