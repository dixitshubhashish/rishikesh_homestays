// Prototype/demo only (NOT wired into the live homepage search). Reports which
// of the 4 cached city boundary polygons a point falls inside.
//
// Usage:
//   node scripts/stays/city-boundary-demo.mjs --lat 30.103 --lng 78.297
//   node scripts/stays/city-boundary-demo.mjs --query "Tapovan, Rishikesh"
//   node scripts/stays/city-boundary-demo.mjs --self-test   (runs the known-point checks)

import { cityContaining, CITY_KEYS } from './city-boundary.mjs';

const USER_AGENT =
  'RishikeshHomestays-CityBoundaryPrototype/1.0 (+https://rishikeshhomestays.com; contact: hello@rishikeshhomestays.com)';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, format: 'json', limit: '1' })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const data = await res.json();
  if (!data.length) throw new Error(`no geocoding result for "${query}"`);
  return { lat: Number(data[0].lat), lng: Number(data[0].lon), display_name: data[0].display_name };
}

function report(lat, lng, label) {
  const hit = cityContaining(lat, lng);
  console.log(`${label ? label + ' ' : ''}(${lat}, ${lng}) -> ${hit ? `inside ${hit}` : 'outside all 4 cities'}`);
  return hit;
}

// Known reference points (cities.py centers + a couple of sanity checks)
// including at least one point expected to be outside every polygon.
const SELF_TEST_POINTS = [
  { label: 'rishikesh center', lat: 30.103, lng: 78.297, expect: 'rishikesh' },
  { label: 'haridwar center', lat: 29.945, lng: 78.164, expect: 'haridwar' },
  { label: 'dehradun center', lat: 30.3244, lng: 78.0419, expect: 'dehradun' },
  { label: 'mussoorie center', lat: 30.4598, lng: 78.0643, expect: 'mussoorie' },
  // Delhi -- clearly outside all 4 Uttarakhand towns.
  { label: 'Delhi (Connaught Place)', lat: 28.6315, lng: 77.2167, expect: null },
  // Mid-Ganges point ~70km north of Rishikesh towards the Himalayas, well outside any of the 4.
  { label: 'Devprayag (~35km NE of Rishikesh)', lat: 30.1459, lng: 78.5989, expect: null },
];

async function selfTest() {
  console.log(`Known cities: ${CITY_KEYS.join(', ')}\n`);
  let pass = 0;
  for (const p of SELF_TEST_POINTS) {
    const hit = report(p.lat, p.lng, p.label);
    const ok = hit === p.expect;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} (expected ${p.expect ? `inside ${p.expect}` : 'outside all'})`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${SELF_TEST_POINTS.length} checks passed.`);
}

async function main() {
  if (process.argv.includes('--self-test')) {
    await selfTest();
    return;
  }

  const latArg = arg('lat');
  const lngArg = arg('lng');
  const query = arg('query');

  if (latArg && lngArg) {
    report(Number(latArg), Number(lngArg));
    return;
  }

  if (query) {
    const { lat, lng, display_name } = await geocode(query);
    console.log(`geocoded "${query}" -> ${display_name} (${lat}, ${lng})`);
    report(lat, lng);
    return;
  }

  console.log('Usage: node scripts/stays/city-boundary-demo.mjs --lat <lat> --lng <lng>');
  console.log('   or: node scripts/stays/city-boundary-demo.mjs --query "<place name>"');
  console.log('   or: node scripts/stays/city-boundary-demo.mjs --self-test');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
