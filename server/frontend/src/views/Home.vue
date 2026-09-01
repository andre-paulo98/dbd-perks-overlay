<template>
  <div class="center-screen">
    <p v-if="!error">Creating room…</p>
    <template v-else>
      <p>{{ error }}</p>
      <button @click="retry">Try again</button>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const error = ref('');

async function createAndGo() {
  error.value = '';
  try {
    const { code } = await api.createRoom();
    router.replace(`/${code}`);
  } catch {
    error.value = 'Could not reach the server. Is it running?';
  }
}

function retry() {
  createAndGo();
}

onMounted(createAndGo);
</script>
