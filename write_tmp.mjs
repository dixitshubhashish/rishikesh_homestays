import { classify, writeChecked } from './classify_local_tmp.mjs';
const url = "https://www.agoda.com/paradise-adventure/hotel/rishikesh-in.html";
const c = classify({ name: "Paradise Adventure", lat: 30.117340087890625, lng: 78.30579376220703, closed: false });
console.log(c);
const changes = writeChecked(url, { name: "Paradise Adventure", lat: 30.117340087890625, lng: 78.30579376220703, town: c.town, state: c.state, decisionWhy: "page meta geo (place:location)" });
console.log('changes', changes);
