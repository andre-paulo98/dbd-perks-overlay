async function createRoom() {
  const res = await fetch('/api/rooms', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

async function getRoom(code) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  return res.json();
}

async function getPerks() {
  const res = await fetch('/api/perks');
  if (!res.ok) return [];
  return res.json();
}

export default { createRoom, getRoom, getPerks };
