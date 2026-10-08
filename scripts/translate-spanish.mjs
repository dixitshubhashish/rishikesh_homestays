#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Glossary for Spanish translations
const glossary = {
  // Property types
  'Resort': 'Resort',
  'resorts': 'resorts',
  'Hotel': 'Hotel',
  'hotels': 'hoteles',
  'Homestay': 'Alojamiento',
  'homestays': 'alojamientos',
  'Guest House': 'Casa de familia',
  'guest houses': 'casas de familia',
  'Villa': 'Villa',
  'villas': 'villas',
  'Apartment': 'Apartamento',
  'apartments': 'apartamentos',
  'Aparthotel': 'Aparthotel',
  'aparthotels': 'aparthoteles',
  'Camp': 'Campamento',
  'camps': 'campamentos',
  'Hostel': 'Hostal',
  'hostels': 'hostales',
  'Cottage': 'Cabaña',
  'cottages': 'cabañas',
  'Dharamshala': 'Dharamshala',
  'Dharamshalas': 'Dharamshalas',
  'Ashram': 'Ashram',
  'Ashrams': 'ashrams',
  'B&B': 'Posada',
  'Studios': 'Estudios',
  'Studio': 'Estudio',
  'BHK': 'BHK',
  '3 BHK': '3 BHK',

  // Features
  'Pool': 'Piscina',
  'pool': 'piscina',
  'WiFi': 'WiFi',
  'Kitchen': 'Cocina',
  'with a Kitchen': 'con cocina',
  'Pet-Friendly': 'Que admiten mascotas',
  'Spa & Wellness': 'Spa y bienestar',
  'Spa': 'Spa',
  'Wellness': 'Bienestar',
  'Yoga': 'Yoga',

  // Price-related
  'Budget': 'Económico',
  'Cheap': 'Económicos',
  'Luxury': 'Lujo',
  'Low Price': 'Bajo precio',
  'Price': 'Precio',
  'under': 'por menos de',

  // Locations
  'Rishikesh': 'Rishikesh',
  'Haridwar': 'Haridwar',
  'Dehradun': 'Dehradun',
  'Mussoorie': 'Mussoorie',
  'Delhi': 'Delhi',
  'Meerut': 'Meerut',
  'Noida': 'Noida',
  'Ghaziabad': 'Ghaziabad',
  'Greater Noida': 'Greater Noida',
  'Gurugram': 'Gurugram',
  'Faridabad': 'Faridabad',
  'Sonipat': 'Sonipat',
  'Roorkee': 'Roorkee',
  'Ganga': 'Ganga',
  'Ganges': 'Ganges',
  'River': 'Río',
  'river': 'río',

  // Landmarks
  'Railway Station': 'Estación de tren',
  'ISBT': 'ISBT',
  'Mall Road': 'Mall Road',
  'Ghat': 'Escalinata',
  'Triveni Ghat': 'Triveni Ghat',
  'Har Ki Pauri': 'Har Ki Pauri',
  'Parmarth Niketan': 'Parmarth Niketan',
  'Laxman Jhula': 'Laxman Jhula',
  'Lakshman Jhula': 'Lakshman Jhula',
  'Ram Jhula': 'Ram Jhula',
  'Swarg Ashram': 'Swarg Ashram',
  'Tapovan': 'Tapovan',
  'Muni Ki Reti': 'Muni Ki Reti',
  'AIIMS': 'AIIMS',
  'Nirmal Bagh': 'Nirmal Bagh',
  'Kankhal': 'Kankhal',
  'Patanjali': 'Patanjali',
  'FRI': 'FRI',
  'BHEL': 'BHEL',
  'Jolly Grant': 'Jolly Grant',
  'Neelkanth': 'Neelkanth',
  'Kedarnath': 'Kedarnath',
  'Kunjapuri': 'Kunjapuri',

  // Amenities
  'Parking': 'Estacionamiento',
  'parking': 'estacionamiento',
  'Parking available': 'Hay estacionamiento',
  'Restaurant': 'Restaurante',
  'restaurant': 'restaurante',
  'Cafe': 'Café',
  'cafe': 'café',
  'Lounge': 'Salón',
  'Common': 'Común',
  'Space': 'Espacio',
  'Breakfast': 'Desayuno',
  'breakfast': 'desayuno',
  'Meals': 'Comidas',
  'meals': 'comidas',
  'Airport': 'Aeropuerto',
  'airport': 'aeropuerto',
  'Transfer': 'Traslado',
  'Pickup': 'Recogida',

  // Common terms
  'Best': 'Mejores',
  'best': 'mejores',
  'Top': 'Top',
  'top': 'principales',
  'Near': 'Cerca de',
  'near': 'cerca de',
  'Nearby': 'Cercano',
  'Rooms': 'Habitaciones',
  'rooms': 'habitaciones',
  'Room': 'Habitación',
  'room': 'habitación',
  'Accommodation': 'Alojamiento',
  'accommodation': 'alojamiento',
  'Stays': 'Alojamientos',
  'stays': 'alojamientos',
  'Stay': 'Alojamiento',
  'Booking': 'Reserva',
  'booking': 'reserva',
  'Book': 'Reservar',
  'book': 'reservar',
  'View': 'Vista',
  'view': 'vista',
  'Ganga View': 'Vista al Ganga',
  'Star': 'Estrella',
  'stars': 'estrellas',
  'Backpacker': 'Mochilero',
  'backpackers': 'mochileros',
  'Boutique': 'Boutique',
  'boutique': 'boutique',

  // Descriptions
  'of': 'de',
  'in': 'en',
  'and': 'y',
  '&': 'y',
  'with': 'con',
  'for': 'para',
  'from': 'desde',
  'to': 'a',
  'on': 'en',
  'per': 'por',
  'per night': 'por noche',
  'Long Stays': 'Estancias largas',
  'long stays': 'estancias largas',
  'Short Stays': 'Estancias cortas',

  // Star ratings
  '3 Star': '3 Estrellas',
  '3-Star': '3 Estrellas',
  '4 Star': '4 Estrellas',
  '4-Star': '4 Estrellas',
  '5 Star': '5 Estrellas',
  '5-Star': '5 Estrellas',
  '7 Star': '7 Estrellas',
  '3, 4 and 5 Star': '3, 4 y 5 Estrellas',

  // Other
  'Booking under': 'Reserva por menos de',
  'Rooms Price': 'Precio de habitaciones',
  'Rooms Low Price': 'Habitaciones a bajo precio',
  'Accommodation': 'Alojamiento',
  'Top 10': 'Top 10',
  'Check': 'Revisión',
};

// Function to translate a string
function translateText(english) {
  if (!english || typeof english !== 'string') {
    return english;
  }

  let translated = english;

  // Replace glossary terms (order matters: longest first)
  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);

  for (const term of terms) {
    const regex = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    if (regex.test(translated)) {
      translated = translated.replace(regex, glossary[term]);
    }
  }

  // Handle specific patterns

  // "Best X in Y" -> "Mejores X en Y"
  if (!translated.startsWith('Mejores') && english.match(/^Best\s+/i)) {
    translated = translated.replace(/^Mejores/, 'Mejores');
  }

  // "Cheap X in Y" -> "X económicos en Y"
  if (english.match(/^Cheap\s+/i)) {
    const match = english.match(/^Cheap\s+(.+?)\s+in\s+(.+)$/i);
    if (match) {
      const type = glossary[match[1]] || match[1];
      const location = glossary[match[2]] || match[2];
      translated = `${type} económicos en ${location}`;
    }
  }

  // "X in Y" format
  if (english.match(/\sin\s/i) && !translated.match(/\sen\s/)) {
    translated = translated.replace(/\s+en\s+/i, ' en ');
  }

  // Default fallback with pattern matching
  if (translated === english) {
    // Handle patterns we haven't covered
    if (english.match(/^(Best|Top|Cheap)/i)) {
      translated = english
        .replace(/Best\s+/i, 'Mejores ')
        .replace(/Top\s+/i, 'Principales ')
        .replace(/Cheap\s+/i, '')
        .replace(/\s+in\s+/i, ' en ')
        .replace(/\s+near\s+/i, ' cerca de ')
        .replace(/\s+with\s+/i, ' con ');
    }
  }

  return translated || english;
}

async function main() {
  const jobFile = process.argv[2] || '/private/tmp/claude-502/-Users-shubhashish-rishikesh-homestays/b62cb5d9-33cb-4b37-a260-d14008e42204/scratchpad/wave2/es-1.json';
  const outFile = process.argv[3] || '/private/tmp/claude-502/-Users-shubhashish-rishikesh-homestays/b62cb5d9-33cb-4b37-a260-d14008e42204/scratchpad/wave2/es-1.out.json';

  console.log(`Reading job file: ${jobFile}`);
  const jobData = JSON.parse(fs.readFileSync(jobFile, 'utf-8'));

  const output = {};
  let count = 0;

  for (const item of jobData.items) {
    const { k, en } = item;
    const translated = translateText(en);
    output[k] = translated;
    count++;

    if (count % 500 === 0) {
      console.log(`  Translated ${count}/${jobData.items.length}...`);
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nWrote ${count} translations to ${outFile}`);
}

main().catch(console.error);
