const WebSocket = require('ws');

async function createRoom() {
  const res = await fetch('http://localhost:3001/api/rooms', { method: 'POST' });
  const data = await res.json();
  return data.code;
}

function connect(code, label) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:3001/ws?room=${code}`);
    ws.on('open', () => resolve(ws));
    ws.on('message', (raw) => {
      console.log(`[${label}] received:`, raw.toString());
    });
  });
}

async function main() {
  const code = await createRoom();
  console.log('Room code:', code);

  const clientA = await connect(code, 'A (browser)');
  const clientB = await connect(code, 'B (rainmeter)');

  await new Promise((r) => setTimeout(r, 200));

  console.log('\n--- A sets full perk array ---');
  clientA.send(JSON.stringify({
    type: 'setPerks',
    perks: ['http://x/1.png', 'http://x/2.png', 'http://x/3.png', 'http://x/4.png'],
  }));
  await new Promise((r) => setTimeout(r, 200));

  console.log('\n--- B changes just slot 2 ---');
  clientB.send(JSON.stringify({ type: 'setPerk', index: 2, value: 'http://x/NEW.png' }));
  await new Promise((r) => setTimeout(r, 200));

  console.log('\n--- A clears the room ---');
  clientA.send(JSON.stringify({ type: 'clear' }));
  await new Promise((r) => setTimeout(r, 200));

  console.log('\n--- unknown message type is ignored, no crash ---');
  clientA.send(JSON.stringify({ type: 'bogus' }));
  clientA.send('not even json');
  await new Promise((r) => setTimeout(r, 200));

  console.log('\n--- late joiner C connects, should get current (cleared) state immediately ---');
  const clientC = await connect(code, 'C (late joiner)');
  await new Promise((r) => setTimeout(r, 300));

  clientA.close();
  clientB.close();
  clientC.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
