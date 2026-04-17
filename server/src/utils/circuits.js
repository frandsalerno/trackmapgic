// Known motorsport circuits with GPS center coordinates and approx track length
const CIRCUITS = [
  // Italy
  { name: 'Misano World Circuit Marco Simoncelli', aliases: ['misano'], country: 'Italy', lat: 43.9597, lon: 12.6826, lengthM: 4226 },
  { name: 'Autodromo Nazionale Monza', aliases: ['monza'], country: 'Italy', lat: 45.6156, lon: 9.2811, lengthM: 5793 },
  { name: 'Autodromo Enzo e Dino Ferrari (Imola)', aliases: ['imola'], country: 'Italy', lat: 44.3439, lon: 11.7167, lengthM: 4909 },
  { name: 'Autodromo di Mugello', aliases: ['mugello'], country: 'Italy', lat: 43.9975, lon: 11.3719, lengthM: 5245 },
  { name: 'Autodromo di Vallelunga', aliases: ['vallelunga'], country: 'Italy', lat: 42.1597, lon: 12.3789, lengthM: 4085 },

  // Monaco
  { name: 'Circuit de Monaco', aliases: ['monaco', 'monte carlo'], country: 'Monaco', lat: 43.7347, lon: 7.4207, lengthM: 3337 },

  // Spain
  { name: 'Circuit de Barcelona-Catalunya', aliases: ['barcelona', 'catalunya'], country: 'Spain', lat: 41.5700, lon: 2.2611, lengthM: 4655 },
  { name: 'Circuit de Jerez - Ángel Nieto', aliases: ['jerez'], country: 'Spain', lat: 36.7081, lon: -6.0336, lengthM: 4428 },
  { name: 'Circuit Ricardo Tormo', aliases: ['ricardo tormo', 'valencia'], country: 'Spain', lat: 39.4883, lon: -0.6314, lengthM: 4005 },
  { name: 'Circuito de Navarra', aliases: ['navarra'], country: 'Spain', lat: 42.5611, lon: -1.6428, lengthM: 3933 },
  { name: 'Motorland Aragon', aliases: ['aragon', 'motorland'], country: 'Spain', lat: 41.1153, lon: -0.2514, lengthM: 5344 },
  { name: 'Circuit de Spa-Francorchamps', aliases: ['spa', 'francorchamps'], country: 'Belgium', lat: 50.4372, lon: 5.9714, lengthM: 7004 },

  // UK
  { name: 'Silverstone Circuit', aliases: ['silverstone'], country: 'UK', lat: 52.0786, lon: -1.0169, lengthM: 5891 },
  { name: 'Brands Hatch', aliases: ['brands hatch'], country: 'UK', lat: 51.3628, lon: 0.2625, lengthM: 3916 },
  { name: 'Donington Park', aliases: ['donington'], country: 'UK', lat: 52.8306, lon: -1.3753, lengthM: 4020 },
  { name: 'Oulton Park', aliases: ['oulton park'], country: 'UK', lat: 53.1781, lon: -2.6133, lengthM: 4307 },
  { name: 'Snetterton Circuit', aliases: ['snetterton'], country: 'UK', lat: 52.4758, lon: 0.9322, lengthM: 4779 },

  // Germany
  { name: 'Nürburgring', aliases: ['nurburgring', 'nürburgring', 'nordschleife'], country: 'Germany', lat: 50.3356, lon: 6.9475, lengthM: 20832 },
  { name: 'Hockenheimring', aliases: ['hockenheim'], country: 'Germany', lat: 49.3278, lon: 8.5653, lengthM: 4574 },
  { name: 'Sachsenring', aliases: ['sachsenring'], country: 'Germany', lat: 50.7919, lon: 12.6878, lengthM: 3671 },

  // France
  { name: 'Circuit Paul Ricard', aliases: ['paul ricard', 'le castellet'], country: 'France', lat: 43.2506, lon: 5.7914, lengthM: 5842 },
  { name: 'Circuit de Nevers Magny-Cours', aliases: ['magny cours', 'magny-cours'], country: 'France', lat: 46.8644, lon: 3.1636, lengthM: 4411 },
  { name: 'Bugatti Circuit (Le Mans)', aliases: ['le mans', 'bugatti'], country: 'France', lat: 47.9572, lon: 0.2081, lengthM: 4185 },

  // Austria
  { name: 'Red Bull Ring', aliases: ['red bull ring', 'spielberg', 'österreichring'], country: 'Austria', lat: 47.2197, lon: 14.7647, lengthM: 4326 },
  { name: 'Salzburgring', aliases: ['salzburgring'], country: 'Austria', lat: 47.8219, lon: 13.1900, lengthM: 4242 },

  // Netherlands
  { name: 'Circuit Zandvoort', aliases: ['zandvoort'], country: 'Netherlands', lat: 52.3883, lon: 4.5408, lengthM: 4259 },

  // Hungary
  { name: 'Hungaroring', aliases: ['hungaroring', 'hungary'], country: 'Hungary', lat: 47.5830, lon: 19.2508, lengthM: 4381 },

  // USA
  { name: 'Circuit of the Americas', aliases: ['cota', 'circuit of the americas', 'austin'], country: 'USA', lat: 30.1328, lon: -97.6411, lengthM: 5513 },
  { name: 'Laguna Seca', aliases: ['laguna seca', 'mazda raceway'], country: 'USA', lat: 36.5841, lon: -121.7544, lengthM: 3602 },
  { name: 'Road America', aliases: ['road america', 'elkhart lake'], country: 'USA', lat: 43.7997, lon: -87.9897, lengthM: 6434 },
  { name: 'Watkins Glen', aliases: ['watkins glen'], country: 'USA', lat: 42.3367, lon: -76.9222, lengthM: 5435 },
  { name: 'Mid-Ohio Sports Car Course', aliases: ['mid ohio', 'mid-ohio'], country: 'USA', lat: 40.6944, lon: -82.6400, lengthM: 3827 },

  // Japan
  { name: 'Suzuka Circuit', aliases: ['suzuka'], country: 'Japan', lat: 34.8431, lon: 136.5406, lengthM: 5807 },
  { name: 'Twin Ring Motegi', aliases: ['motegi', 'twin ring'], country: 'Japan', lat: 36.5328, lon: 140.1983, lengthM: 4801 },

  // Australia
  { name: 'Albert Park Circuit', aliases: ['albert park', 'melbourne'], country: 'Australia', lat: -37.8497, lon: 144.9681, lengthM: 5278 },
  { name: 'Phillip Island Grand Prix Circuit', aliases: ['phillip island'], country: 'Australia', lat: -38.5011, lon: 145.2333, lengthM: 4448 },

  // Others
  { name: 'Yas Marina Circuit', aliases: ['yas marina', 'abu dhabi'], country: 'UAE', lat: 24.4672, lon: 54.6031, lengthM: 5554 },
  { name: 'Bahrain International Circuit', aliases: ['bahrain', 'sakhir'], country: 'Bahrain', lat: 26.0325, lon: 50.5106, lengthM: 5412 },
  { name: 'Marina Bay Street Circuit', aliases: ['singapore', 'marina bay'], country: 'Singapore', lat: 1.2914, lon: 103.8644, lengthM: 4940 },
  { name: 'Shanghai International Circuit', aliases: ['shanghai', 'china'], country: 'China', lat: 31.3397, lon: 121.2200, lengthM: 5451 },
  { name: 'Sepang International Circuit', aliases: ['sepang', 'malaysia'], country: 'Malaysia', lat: 2.7608, lon: 101.7381, lengthM: 5543 },
  { name: 'Autodromo Hermanos Rodriguez', aliases: ['mexico city', 'hermanos rodriguez'], country: 'Mexico', lat: 19.4042, lon: -99.0907, lengthM: 4304 },
  { name: 'Interlagos (Autodromo Jose Carlos Pace)', aliases: ['interlagos', 'sao paulo', 'brazil'], country: 'Brazil', lat: -23.7036, lon: -46.6997, lengthM: 4309 },
  { name: 'Istanbul Park', aliases: ['istanbul', 'turkey'], country: 'Turkey', lat: 40.9517, lon: 29.4050, lengthM: 5338 },
  { name: 'Autodromo Internacional do Algarve', aliases: ['portimao', 'algarve'], country: 'Portugal', lat: 37.2275, lon: -8.6267, lengthM: 4592 },
];

function searchCircuits(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return CIRCUITS
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.aliases.some((a) => a.includes(q))
    )
    .slice(0, 10)
    .map(({ name, country, lat, lon, lengthM }) => ({ name, country, lat, lon, lengthM }));
}

module.exports = { searchCircuits, CIRCUITS };
