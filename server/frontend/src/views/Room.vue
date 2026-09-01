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

    <PerkSlots
      :perks="perks"
      :active-slot="activeSlot"
      @select-slot="selectSlot"
      @clear-slot="clearSlot"
    />

    <div class="actions">
      <button class="clear-all" @click="clearAll">Clear all</button>
    </div>

    <PerkPicker :catalog="catalog" @pick="pickPerk" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { useRoomSocket } from '../composables/useRoomSocket';
import PerkSlots from '../components/PerkSlots.vue';
import PerkPicker from '../components/PerkPicker.vue';

const props = defineProps({ code: { type: String, required: true } });
const code = props.code.toUpperCase();

const router = useRouter();
const notFound = ref(false);
const catalog = ref([]);
const activeSlot = ref(1);
const copied = ref(false);

// Destructuring the refs (rather than keeping `socket.perks`) so the
// template can auto-unwrap them directly.
const { perks, status, setPerk, clear, disconnect } = useRoomSocket(code);

const statusLabel = computed(
  () =>
    ({
      connecting: 'Connecting…',
      open: 'Live',
      closed: 'Reconnecting…',
    })[status.value] || '',
);

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

function selectSlot(n) {
  activeSlot.value = n;
}

function pickPerk(perk) {
  // Absolute URL: this string gets broadcast to non-browser clients too
  // (the Rainmeter plugin), which have no page origin to resolve a
  // relative path against.
  const url = `${window.location.origin}/perks/${perk.image}`;
  setPerk(activeSlot.value, url);
  activeSlot.value = activeSlot.value < 4 ? activeSlot.value + 1 : 1;
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
  padding: 32px 16px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
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

.actions {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
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
