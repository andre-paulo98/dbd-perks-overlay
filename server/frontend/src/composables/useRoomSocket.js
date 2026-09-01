import { ref } from 'vue';

// Same wire protocol the Rainmeter plugin speaks: {"type":"state","perks":[...]}
// coming in, {"type":"setPerks"|"setPerk"|"clear"} going out. Any browser
// tab and any Rainmeter client in the same room see the exact same state.
export function useRoomSocket(code) {
  const perks = ref([null, null, null, null]);
  const status = ref('connecting'); // connecting | open | closed

  let ws = null;
  let retryTimer = null;
  let stopped = false;

  function wsUrl() {
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return `${protocol}${location.host}/ws?room=${encodeURIComponent(code)}`;
  }

  function connect() {
    if (stopped) return;
    status.value = 'connecting';
    ws = new WebSocket(wsUrl());

    ws.addEventListener('open', () => {
      status.value = 'open';
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state' && Array.isArray(msg.perks)) {
          perks.value = msg.perks;
        }
      } catch {
        // ignore anything that isn't valid JSON
      }
    });

    ws.addEventListener('close', () => {
      status.value = 'closed';
      if (!stopped) {
        retryTimer = setTimeout(connect, 2000);
      }
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  }

  function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function setPerk(index, value) {
    send({ type: 'setPerk', index, value });
  }

  function setPerks(list) {
    send({ type: 'setPerks', perks: list });
  }

  function clear() {
    send({ type: 'clear' });
  }

  function disconnect() {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (ws) ws.close();
  }

  connect();

  return { perks, status, setPerk, setPerks, clear, disconnect };
}
