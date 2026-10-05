import test from 'node:test';
import assert from 'node:assert';
import { coreName, pageMatches, cleanUrl, platformOf } from '../../scripts/stays/ota-match.mjs';

// Real cases from the 2026-10-04 search run: [stay name, city, page title, same stay?]
const CASES = [
  // right pages that the old whole-name rule rejected or that must keep passing
  ['Sitara Premium the Ramawati, Walking Distance from Ganga Ghat', 'haridwar', 'Sitara Premium The Ramawati 𝗕𝗢𝗢𝗞 Haridwar Hotel', true],
  ['The Ramawati – A Four Star Luxury Hotel near Ganga Ghat', 'haridwar', 'Sitara Premium The Ramawati Hotel Haridwar - Reviews, Photos & Offer', true],
  ['Hotel Grey Castle – Near Haridwar Railway Station', 'haridwar', 'Perfectstayz Value Grey Castle near Haridwar Railway Station 𝗕𝗢𝗢𝗞 Haridwar Hotel', true],
  ['Hotel Shiva Palace – Best Stay Hotel', 'haridwar', 'Hotel Shiva Palace Haridwar: Reviews, Price, Photos, Address', true],
  ['Hotel Pardesi, Har Ki Pauri Road', 'haridwar', 'Hotel Pardesi,Har ki pauri Road Haridwar, Haridwār (updated prices 2027)', true],
  ['Hotel Aura Residency – A Luxury Hotel & Resort', 'haridwar', 'Hotel Aura Residency 𝗕𝗢𝗢𝗞 Haridwar Hotel', true],
  ['Hotel Madhuban Inn', 'rishikesh', 'Madhuban Inn Rishikesh 𝗕𝗢𝗢𝗞 Rishikesh Hotel', true],
  ['Hotel Madhuban Inn', 'rishikesh', 'Madhuban Inn Rishikesh Hotel Rishikesh - Reviews, Photos & Offer', true],
  ['Hotel Ishan – A Ganges Riverside Retreat by Salvus', 'rishikesh', 'Hotel Ishan - A Ganges Riverside Retreat by SALVUS 𝗕𝗢𝗢𝗞 Rishikesh Hotel', true],
  ['The Neeraj Ganga Rajmahal Wellness with Ganga View Hotel', 'rishikesh', 'The Neeraj Ganga Rajmahal Wellness With Ganga View Hotel (Rishikesh) - Deals, Photos & Reviews', true],
  ['Trippme Rishikesh – Boutique Hostel, Tapovan', 'rishikesh', 'Trippme Rishikesh - Boutique Hostel, Tapovan 𝗕𝗢𝗢𝗞 Rishikesh Hostel', true],
  ['The Roseate Ganges Rishikesh Hotel', 'rishikesh', 'The Roseate Ganges 𝗕𝗢𝗢𝗞 Rishikesh Resort', true],
  ['Hotel Peepal Tree', 'rishikesh', 'Hotel peepal tree, Rishikesh | 2026 Updated Prices, Deals', true],
  ['Hotel Royal Dot by Sitara Group', 'haridwar', 'Sitara Premium Royal Dot with Free Parking, Haridwar 𝗕𝗢𝗢𝗞 Haridwar Hotel', true],
  ['Hotel Chakrah by Hermitage', 'rishikesh', 'Hotel Chakrah by Hermitage 𝗕𝗢𝗢𝗞 Rishikesh Homestay', true],
  ['Him River Resort', 'rishikesh', 'Him River Resort Hotel (Rishikesh) - Deals, Photos & Reviews', true],
  ['Bunk Hostel', 'rishikesh', 'Bunk Hostel Rishikesh | Rooms & Dorms 𝗕𝗢𝗢𝗞 Rishikesh Hostel', true],
  ['Hotel Dharm Yatri Niwas', 'rishikesh', 'Dharm Yatri Niwas 𝗕𝗢𝗢𝗞 Rishikesh Aashram', true],
  ['Hotel Shiva Palace – Best Stay Hotel', 'haridwar', 'Best Price on HOTEL SHIVA PALACE HARIDWAR in Haridwar + Reviews!', true],
  // a possessive is the word itself, not an extra word "s"
  ["Nature's Valley Resort", 'rishikesh', 'Nature Valley | Luxury Tents & Guided Treks 𝗕𝗢𝗢𝗞 Rishikesh Camp', true],
  ["Sushma's Homestay", 'rishikesh', 'Sushma homestay 𝗕𝗢𝗢𝗞 Rishikesh Apartment', true],
  ['Sushma Homestay', 'rishikesh', 'Sushma’s Homestay, Rishikesh (updated prices 2026)', true],
  ["Sushma's Homestay", 'rishikesh', 'Sushma homestay C1 𝗕𝗢𝗢𝗞 Rishikesh Apartment', false],
  // spelling variants and descriptors that are not part of the name (checked by hand, 2026-10-04)
  ['Shri Bhagwan Gopi Dham Dharmsala', 'haridwar', 'Shri Bhagwan Gopi Dham Dharmshala 𝗕𝗢𝗢𝗞 Haridwar Hotel', true],
  ['Madhuban Ashram Bed & Breakfast', 'rishikesh', 'Madhuban Ashram, Muni Ki Reti, Rishikesh', true],
  ['Fabexpress Kartikey Inn', 'haridwar', 'Kartikey Inn, Haridwar', true],
  ['Ganga House Homestay', 'rishikesh', 'Ganga Home Stay - Houses for Rent in Rishikesh', false],
  ['Blue Nature Camping And Resorts', 'rishikesh', 'BLUE NATURE CAMPING AND RESORT 𝗕𝗢𝗢𝗞 Rishikesh Camp', true], // resorts = resort
  ['Abhi Ganga Homestay - Deluxe Double Room (2 Adults + 1 Child)', 'haridwar', 'Abhi Ganga Homestay | Near Ganga Ghat 𝗕𝗢𝗢𝗞 Haridwar Homestay', true], // room description is not the name
  ['OZY Homestay - Two-Bedroom Apartment', 'rishikesh', 'OZY Homestay, Rishikesh, India', true],
  ['Hotel Yuvraj Rishikesh', 'rishikesh', 'SPOT ON 43453 Hotel Yuvraj, Laxman Jhula, Rishikesh, India', true], // Spot On is an OYO brand
  ['Krishna Kunj Homestay Rishikesh. A Family Friendly Homestay at Best Price', 'rishikesh', 'Krishna Kunj Homestay Rishikesh, Rishīkesh (updated prices 2027)', true], // a tagline after a full stop
  ['Krishn Kunj home Stay', 'rishikesh', 'Krishna Kunj Homestay Rishikesh, Rishīkesh (updated prices 2027)', false], // a spelling variant is never auto-matched (and this one is a different place, 2.6 km away)
  ['Kedia Resorts - ( Ganga Facing Hotel )', 'rishikesh', 'Kedia Resorts, Veerbhadra Road, Near AIIMS Hospital, Rishikesh, India', true],
  ['Radha Krishna Homestay - Two-Bedroom Apartment', 'rishikesh', 'Radha Krishna Homestay 1 BHK Apartment 𝗕𝗢𝗢𝗞 Rishikesh Apartment', false], // 2 bedrooms is not the 1 BHK unit
  // wrong pages: other stays of the same chain/brand, other units, lookalikes, list pages
  ['Perfectstayz Value Alpine near Laxman Jhula', 'rishikesh', 'Perfectstayz Value Hills Hotel Rishikesh - Reviews, Photos & Offer', false],
  ['Perfectstayz Value Alpine near Laxman Jhula', 'rishikesh', 'Perfectstayz Value Hills 𝗕𝗢𝗢𝗞 Rishikesh Hotel', false],
  ['Hotel the Pacific Paradise, Opposite Shantikunj', 'haridwar', 'Sitara Economy The Pacific 𝗕𝗢𝗢𝗞 Haridwar Hotel', false],
  ['Hotel the Pacific Paradise, Opposite Shantikunj', 'haridwar', 'HOTEL GRAND PACIFIC & RESTAURANT Haridwar - Reviews, Photos & Offer', false],
  ['Skyard Premium, Tapovan', 'rishikesh', 'Skyard Hostel Rishikesh (Laxman Jhula) 𝗕𝗢𝗢𝗞 Rishikesh Hostel', false],
  ['Hotel Ramawati Classic near Ganga Ghat', 'haridwar', 'Sitara Premium The Ramawati 𝗕𝗢𝗢𝗞 Haridwar Hotel', false],
  ['The Ramawati – A Four Star Luxury Hotel near Ganga Ghat', 'haridwar', 'Hotel Ramawati Classic 𝗕𝗢𝗢𝗞 Haridwar Hotel', false],
  ['Around Stays – Shanti Villas, Tapovan', 'rishikesh', 'Around Stays 𝗕𝗢𝗢𝗞 Rishikesh Homestay', false],
  ['Around Stays – Shanti Villas, Tapovan', 'rishikesh', 'Oslo By Around Stays Hotel Rishikesh: Reviews, Price, Photos, Address', false],
  ['Hotel Royal Dot', 'haridwar', 'Hotel Purple Dot Haridwar: Reviews, Price, Photos, Address', false],
  ['Hotel Madhuban Inn', 'rishikesh', 'Booking.com: Hotels in Rishīkesh. Book your hotel now!', false],
  ['Hotel Shiva Palace – Best Stay Hotel', 'haridwar', 'Hotel Shiva 𝗕𝗢𝗢𝗞 Haridwar Hotel', false],
  ['Hotel Shiva Palace – Best Stay Hotel', 'haridwar', 'Hotel Shiva W plaza 𝗕𝗢𝗢𝗞 Haridwar Hotel', false],
  ['Him River Resort', 'rishikesh', 'Him River Resort Hotel (Mussoorie) - Deals, Photos & Reviews', false],
  ['Bunk Hostel', 'rishikesh', 'Bunk Hostel Goa | Rooms & Dorms', false],
  // Antigravity's links, judged on merge
  ['Hotel – Montreal Rishikesh Madhuban Inn', 'rishikesh', 'hotel-montreal rishikesh madhuban inn, Rishīkesh (updated prices 2027)', true],
  ['Goroomgo Ganga Exotica Haridwar – Prime Location – Ganga River View Point – Luxury and Spacious Room – Best Hotel in Haridwar', 'haridwar', 'Ganga Exotica, Haridwār (updated prices 2027)', true],
  ['Ganga Azure Hotel', 'haridwar', 'Hotel Ganga Azure@ Har Ki Pauri Road, Haridwār (updated prices 2027)', true],
  ['Perfect Stays Hotel in Haridwar', 'haridwar', 'Best Price on Perfect Stays Hotel in Haridwar in Haridwar + Reviews!', true],
  ['Holiday Inn – Stay Home', 'haridwar', 'Best Price on HOLIDAY INN STAY HOMES in Haridwar + Reviews!', true],
  ['Hotel Ganga View', 'haridwar', 'Hotel Crystal Ganga Heights 5 Min from Har Ki Pauri, Haridwār (updated prices 2027)', false],
  ['Hotel Crystal', 'haridwar', 'Hotel Crystal Ganga Heights 5 Min from Har Ki Pauri, Haridwār (updated prices 2027)', false],
  ['Raahi the Travellers Nest Hotel', 'rishikesh', 'Ivory Nest, Rishīkesh (updated prices 2027)', false],
  ['Hotel Haven', 'rishikesh', 'Arista Haven Hotel, Rishīkesh (updated prices 2027)', false],
  ['Greenland Swiss Cottage', 'rishikesh', 'Swiss Cottage and Spa by Salvus, Rishīkesh (updated prices 2027)', false],
  ['Hotel Shiva', 'haridwar', 'Hotel Grand Shiva Haridwar Near Ganges, Haridwār (updated prices 2027)', false],
  ['The Hosteller Rishikesh, Upper Tapovan', 'rishikesh', 'The Hosteller Rishikesh, Ganges, Rishīkesh (updated prices 2027)', false],
  ['Homlee – Jumbo 1BHK-2Ac – Kitchen – Lift – Parking – Tapovan', 'rishikesh', 'Homlee-Heaven in Hills 1BHK-Parking-Lift-Tapovan, Rishīkesh (updated prices 2027)', false],
  ['Rasa – The Ganges Rishikesh, Ganga Bhumi Apartment', 'rishikesh', 'juSTa Luxe Rasa Retreat & Spa, Rishikesh, Bijni (updated prices 2027)', false],
  ['Maa Vaibhav Laxmi Guest House', 'rishikesh', 'Maa Vaibhav Laxmi Guest House', false], // no town on the title: cannot tell
  // from the independent review (stress test on 863 confirmed pairs + lookalikes)
  ['Hotel Dev', 'haridwar', 'HOTEL DEV GANGA, Haridwār (updated prices 2027)', false],
  ['The Neeraj Palace', 'rishikesh', 'The Neeraj Ganga Heritage Palace Hotel Rishikesh', false],
  ['Shiv Resort', 'rishikesh', 'Hotel Shiv Ganga Rishikesh - Reviews, Photos & Offer', false],
  ['Krishna Hotel', 'rishikesh', 'Krishna home, Rishikesh (updated prices 2027)', false],
  ['Krishna Hotel', 'rishikesh', 'Hotel Krishna Cottage 𝗕𝗢𝗢𝗞 Rishikesh Hotel', false],
  ['Shiv Shakti Hotel', 'rishikesh', 'Shiv Shakti Palace Hotel Rishikesh - Reviews, Photos & Offer', false],
  ['Hotel Laxman Grand', 'rishikesh', 'Hotel Laxman Grand, Ayodhya (updated prices 2027)', false],
  ['Peacenest Stays 2BHK', 'rishikesh', 'Peacenest stays 3bhk, Rishīkesh (updated prices 2027)', false],
  ['Antrix Resorts & Retreat', 'rishikesh', 'Antrix Resorts & Retreat Hotel Yamkeshwar: Reviews, Price, Photos, Address', true],
  ['Om Homestay', 'rishikesh', 'Om Homestay, Rishīkesh (updated prices 2027)', true],
  ['Hotel W Inn', 'rishikesh', 'Hotel W inn, Rishīkesh (updated prices 2027)', true],
  ['Zostel Rishikesh, Tapovan', 'rishikesh', 'Zostel Rishikesh, Rishīkesh (updated prices 2027)', true],
];

test('pageMatches: same stay vs lookalikes, chain siblings, other units and list pages', () => {
  for (const [name, city, title, want] of CASES) {
    assert.strictEqual(pageMatches(name, city, title), want, `${want ? 'should match' : 'should NOT match'}: "${name}" vs "${title}" (core "${coreName(name)}")`);
  }
});

test('coreName drops descriptive tails and keeps naming parts', () => {
  assert.strictEqual(coreName('The Ramawati – A Four Star Luxury Hotel near Ganga Ghat'), 'The Ramawati');
  assert.strictEqual(coreName('Around Stays – Shanti Villas, Tapovan'), 'Around Stays Shanti Villas');
  assert.strictEqual(coreName('Hotel Shreya Galaxy with Swimming Pool – Best Property in Haridwar'), 'Hotel Shreya Galaxy');
  assert.strictEqual(coreName('Sitara Premium the Ramawati, Walking Distance from Ganga Ghat'), 'Sitara Premium the Ramawati');
});

test('cleanUrl gives the generic property URL whatever domain or sub-page the result pointed at', () => {
  const cases = [
    ['https://www.booking.com/hotel/in/ganga-azure.en-gb.html?aid=1&label=x', 'Booking.com', 'https://www.booking.com/hotel/in/ganga-azure.html'],
    ['https://www.agoda.com/en-gb/holiday-inn/hotel/haridwar-in.html?cid=5', 'Agoda', 'https://www.agoda.com/holiday-inn/hotel/haridwar-in.html'],
    ['https://www.airbnb.co.uk/rooms/123?s=76', 'Airbnb', 'https://www.airbnb.com/rooms/123'],
    ['https://www.makemytrip.com/hotels/address-of-dharm_yatri_niwas-details-rishikesh.html', 'MakeMyTrip', 'https://www.makemytrip.com/hotels/dharm_yatri_niwas-details-rishikesh.html'],
    ['https://www.makemytrip.com/hotels/review-of-hotel_shiva-details-haridwar.html', 'MakeMyTrip', 'https://www.makemytrip.com/hotels/hotel_shiva-details-haridwar.html'],
    ['https://www.goibibo.com/hotels/rooms-of-sitara-premium-the-ramawati-hotel-in-haridwar-7332373523885192470/', 'Goibibo', 'https://www.goibibo.com/hotels/sitara-premium-the-ramawati-hotel-in-haridwar-7332373523885192470/'],
  ];
  for (const [u, p, want] of cases) assert.strictEqual(cleanUrl(u, p), want);
});

test('platformOf accepts property pages only, never list pages or redirects through a search engine', () => {
  assert.strictEqual(platformOf('https://www.goibibo.com/hotels/madhuban-inn-rishikesh-hotel-in-rishikesh-4563657511325966490/')?.name, 'Goibibo');
  assert.strictEqual(platformOf('https://www.goibibo.com/hotels/hotels-in-rishikesh-ct/'), undefined);
  assert.strictEqual(platformOf('https://www.goibibo.com/hotels/3-star-hotels-near-kankhal_haridwar-lc/'), undefined);
  assert.strictEqual(platformOf('https://www.google.com/travel/lodging/clk?pcurl=https://www.easemytrip.com/hotels/x-123/'), undefined);
  assert.strictEqual(platformOf('https://www.booking.com/searchresults.html?dest_id=1'), undefined);
  assert.strictEqual(platformOf('https://www.booking.com/hotel/in/x.html')?.name, 'Booking.com');
  assert.strictEqual(platformOf('https://www.trivago.in/en-IN/oar/hotel-shiva-palace-haridwar?search=100-5418532')?.name, 'Trivago');
  assert.strictEqual(platformOf('https://www.trivago.in/en-IN/srl/hotels-haridwar-india?search=200-64885'), undefined); // a city list
  assert.strictEqual(cleanUrl('https://www.trivago.in/en-IN/oar/hotel-shiva-palace-haridwar?search=100-5418532&tm=x', 'Trivago'), 'https://www.trivago.in/en-IN/oar/hotel-shiva-palace-haridwar?search=100-5418532');
  assert.strictEqual(pageMatches('Hotel Shiva Palace', 'haridwar', 'Hotel Shiva Palace, Haridwar - Compare Deals'), true);
  assert.strictEqual(platformOf('https://in.trip.com/hotels/haridwar-hotel-detail-12345678/hotel-shiva-palace/?locale=en-IN')?.name, 'Trip.com');
  assert.strictEqual(cleanUrl('https://in.trip.com/hotels/haridwar-hotel-detail-12345678/hotel-shiva-palace/?locale=en-IN&curr=INR', 'Trip.com'), 'https://www.trip.com/hotels/haridwar-hotel-detail-12345678/hotel-shiva-palace/');
  assert.strictEqual(platformOf('https://www.makemytrip.com/hotels/hotel_shiva-details-haridwar.html')?.name, 'MakeMyTrip'); // not Trip.com
  assert.strictEqual(platformOf('https://www.easemytrip.com/hotels/hotel-shiva-palace-haridwar-8201547/')?.name, 'EaseMyTrip'); // not Trip.com
  assert.strictEqual(platformOf('https://www.trip.com/hotels/list?city=12345'), undefined); // a list page
  assert.strictEqual(pageMatches('Hotel Shiva Palace', 'haridwar', 'Hotel Shiva Palace, Haridwar | 2026 Updated Prices, Deals'), true);
});
