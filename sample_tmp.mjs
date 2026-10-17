import { sampleUnchecked, unCheckedCounts } from './classify_local_tmp.mjs';
console.log(JSON.stringify(unCheckedCounts(), null, 2));
console.log(JSON.stringify(sampleUnchecked('Agoda', 15), null, 2));
