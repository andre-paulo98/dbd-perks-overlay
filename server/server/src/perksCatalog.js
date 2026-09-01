const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://dbd.tricky.lol/api/perks';
const CACHE_PATH = path.join(__dirname, '..', 'public', 'perks', 'perks-cache.json');
const LOCAL_CATALOG_PATH = path.join(__dirname, '..', 'public', 'perks', 'perks.json');

// Splits a camelCase/PascalCase run into space-separated words, also
// splitting a letter directly followed by a digit (so "Button1" becomes
// "Button 1"). Used for {Keyword.X} and {Input.X} placeholders.
function humanize(s) {
  const spaced = s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2');
  // The source data isn't consistent about capitalization (e.g. both
  // "Undetectable" and "undetectable" appear across different perks) -
  // normalize so the displayed text always reads the same way.
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Resolves {Keyword.X}, {Input.X}, and {Tunable.X} placeholders in a raw
 * perk description.
 *
 * Keywords and Input references just become their humanized name.
 *
 * Tunables resolve against that perk's own `tunables` object and always
 * take the LAST entry (max tier). Confirmed against a real API response:
 * `tunables` keys are lowercase (e.g. "haste%") while the placeholder
 * itself is mixed-case (e.g. {Tunable.S02P03.Haste%}), so the lookup
 * must lowercase the key - matching case-sensitively would silently
 * resolve nothing. If a key genuinely isn't found, the placeholder's
 * path is left visible (e.g. "{S02P03.SomeNewField}") rather than
 * silently vanishing, so a bad match is obvious rather than quietly wrong.
 */
function resolveDescription(rawDescription, tunables) {
  if (!rawDescription) return '';

  let text = rawDescription
    .replace(/\{Keyword\.([^}]+)\}/g, (_, name) => humanize(name))
    .replace(/\{Input\.([^}]+)\}/g, (_, name) => humanize(name));

  text = text.replace(/\{Tunable\.([^}]+)\}/g, (_, tunablePath) => {
    const key = tunablePath.split('.').pop().toLowerCase();
    const values = tunables && typeof tunables === 'object' ? tunables[key] : null;

    if (Array.isArray(values) && values.length > 0) {
      return String(values[values.length - 1]);
    }
    return `{${tunablePath}}`;
  });

  return text;
}

function loadLocalImageMap() {
  const map = new Map();
  try {
    const list = JSON.parse(fs.readFileSync(LOCAL_CATALOG_PATH, 'utf8'));
    for (const entry of list) {
      map.set(normalizeName(entry.name), entry.image);
    }
  } catch (err) {
    console.warn('perksCatalog: could not read local perks.json for image matching:', err.message);
  }
  return map;
}

async function fetchRaw() {
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'DbdPerkSync/1.0 (personal project)' },
  });
  if (!res.ok) {
    throw new Error(`dbd.tricky.lol responded ${res.status}`);
  }
  return res.json();
}

function buildCatalog(raw) {
  const imageMap = loadLocalImageMap();
  const catalog = [];
  let unmatched = 0;

  for (const [id, perk] of Object.entries(raw)) {
    if (!perk || !perk.name) continue;

    const image = imageMap.get(normalizeName(perk.name));
    if (!image) {
      unmatched += 1;
      continue; // no local icon for this perk - skip rather than show a broken image
    }

    catalog.push({
      id,
      name: perk.name,
      role: (perk.role || '').toLowerCase(), // expected: "killer" | "survivor"
      description: resolveDescription(perk.description, perk.tunables),
      image,
    });
  }

  if (unmatched > 0) {
    console.warn(`perksCatalog: ${unmatched} perk(s) from dbd.tricky.lol had no matching local icon, skipped`);
  }

  return catalog;
}

async function loadPerksCatalog() {
  try {
    const raw = await fetchRaw();
    const catalog = buildCatalog(raw);
    fs.writeFileSync(CACHE_PATH, JSON.stringify(catalog, null, 2));
    console.log(`perksCatalog: fetched ${catalog.length} perks from dbd.tricky.lol`);
    return catalog;
  } catch (err) {
    console.warn(`perksCatalog: live fetch failed (${err.message}), falling back to cache...`);
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      console.warn(`perksCatalog: using cached copy (${cached.length} perks) - this data may be stale`);
      return cached;
    } catch {
      throw new Error('perksCatalog: live fetch failed and no cache is available - cannot start');
    }
  }
}

module.exports = { loadPerksCatalog, resolveDescription };
