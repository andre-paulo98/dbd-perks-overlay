// Quick regression check for the {Keyword.}/{Input.}/{Tunable.} resolver.
// Run with: node test-resolver.js
const { resolveDescription } = require('./src/perksCatalog');

const cases = [
  {
    label: 'Adrenaline (multi-tier tunables, lowercase keys in source data)',
    description:
      'When all Generators are completed, if you are downed or injured, heal instantly. ' +
      'Then, ignoring {Keyword.Exhausted}:<ul><li>You gain {Tunable.S02P03.Haste%}% {Keyword.Haste} ' +
      'for {Tunable.S02P03.HasteDuration}s.</li><li>You gain {Keyword.Exhausted} for ' +
      '{Tunable.S02P03.ExhaustionDuration}s.</li></ul>',
    tunables: { 'haste%': [50], hasteduration: [4], exhaustionduration: [60, 50, 40] },
    expected:
      'When all Generators are completed, if you are downed or injured, heal instantly. ' +
      'Then, ignoring Exhausted:<ul><li>You gain 50% Haste for 4s.</li><li>You gain Exhausted for ' +
      '40s.</li></ul>',
  },
  {
    label: 'Input placeholder',
    description: 'While next to a Dropped Pallet, use {Input.ActivatableButton1} to reset it.',
    tunables: {},
    expected: 'While next to a Dropped Pallet, use Activatable Button 1 to reset it.',
  },
  {
    label: 'Unresolvable tunable stays visible rather than vanishing',
    description: 'Gain {Tunable.X01P01.SomeNewField}% haste.',
    tunables: {},
    expected: 'Gain {X01P01.SomeNewField}% haste.',
  },
];

let failures = 0;
for (const c of cases) {
  const got = resolveDescription(c.description, c.tunables);
  const pass = got === c.expected;
  if (!pass) failures++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${c.label}`);
  if (!pass) {
    console.log('  expected:', c.expected);
    console.log('  got:     ', got);
  }
}
process.exit(failures ? 1 : 0);
