import { normalizeVehicleBrand } from "@/lib/vehicles/vehicle-brands";

export const POPULAR_VEHICLE_MODELS = [
  "Onix",
  "HB20",
  "Gol",
  "Corolla",
  "Civic",
  "Hilux",
  "S10",
  "Ranger",
  "Compass",
  "Renegade",
  "Toro",
  "Strada",
];

export const VEHICLE_MODELS_BY_BRAND: Record<string, string[]> = {
  Audi: ["A1", "A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "Q8", "TT"],
  BMW: ["Série 1", "Série 3", "Série 5", "X1", "X2", "X3", "X4", "X5", "X6"],
  BYD: ["Dolphin", "Dolphin Mini", "Seal", "Song Plus", "Tan", "Yuan Plus"],
  "Caoa Chery": ["Arrizo 5", "Arrizo 6", "Tiggo 2", "Tiggo 5X", "Tiggo 7", "Tiggo 8"],
  Chery: ["Celer", "Face", "QQ", "Tiggo", "Tiggo 2", "Tiggo 5X"],
  Chevrolet: [
    "Astra",
    "Blazer",
    "Camaro",
    "Captiva",
    "Celta",
    "Classic",
    "Cobalt",
    "Corsa",
    "Cruze",
    "Meriva",
    "Montana",
    "Onix",
    "Prisma",
    "S10",
    "Spin",
    "Tracker",
    "Trailblazer",
    "Vectra",
    "Zafira",
  ],
  Citroen: ["Aircross", "C3", "C3 Aircross", "C4", "C4 Cactus", "C5 Aircross", "Jumpy"],
  Dodge: ["Challenger", "Charger", "Durango", "Journey", "Ram"],
  Fiat: [
    "Argo",
    "Bravo",
    "Cronos",
    "Doblò",
    "Fastback",
    "Fiorino",
    "Freemont",
    "Grand Siena",
    "Idea",
    "Linea",
    "Mobi",
    "Palio",
    "Pulse",
    "Punto",
    "Siena",
    "Strada",
    "Toro",
    "Uno",
  ],
  Ford: [
    "Bronco",
    "EcoSport",
    "Edge",
    "Escort",
    "F-150",
    "Fiesta",
    "Focus",
    "Fusion",
    "Ka",
    "Maverick",
    "Mustang",
    "Ranger",
    "Territory",
  ],
  GWM: ["Haval H6", "Ora 03", "Tank 300"],
  Haval: ["H6", "H6 GT", "H9"],
  Honda: ["Accord", "City", "Civic", "CR-V", "Fit", "HR-V", "WR-V", "ZR-V"],
  Hyundai: ["Azera", "Creta", "HB20", "HB20S", "i30", "ix35", "Santa Fe", "Tucson", "Veloster", "Veracruz"],
  JAC: ["J2", "J3", "J5", "J6", "T40", "T50", "T60", "T80"],
  Jeep: ["Cherokee", "Commander", "Compass", "Grand Cherokee", "Renegade", "Wrangler"],
  Kia: ["Bongo", "Carnival", "Cerato", "Picanto", "Sorento", "Soul", "Sportage"],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Evoque", "Freelander", "Range Rover", "Velar"],
  Lexus: ["ES", "NX", "RX", "UX"],
  "Mercedes-Benz": ["Classe A", "Classe C", "Classe E", "Classe GLA", "Classe GLC", "Classe GLE", "Sprinter"],
  Mini: ["Cooper", "Countryman", "Paceman"],
  Mitsubishi: ["ASX", "Eclipse Cross", "L200", "Outlander", "Pajero", "Triton"],
  Nissan: ["Frontier", "Kicks", "Livina", "March", "Sentra", "Tiida", "Versa", "X-Trail"],
  Peugeot: ["2008", "206", "207", "208", "3008", "307", "308", "408", "Partner"],
  Porsche: ["911", "Boxster", "Cayenne", "Cayman", "Macan", "Panamera", "Taycan"],
  RAM: ["1500", "2500", "3500", "Classic", "Rampage"],
  Renault: ["Captur", "Clio", "Duster", "Fluence", "Kangoo", "Kwid", "Logan", "Megane", "Oroch", "Sandero", "Scenic"],
  Subaru: ["Forester", "Impreza", "Legacy", "Outback", "WRX", "XV"],
  Suzuki: ["Grand Vitara", "Jimny", "S-Cross", "Swift", "Vitara"],
  Toyota: ["Camry", "Corolla", "Corolla Cross", "Etios", "Hilux", "Prius", "RAV4", "SW4", "Yaris"],
  Troller: ["T4"],
  Volkswagen: [
    "Amarok",
    "Fox",
    "Fusca",
    "Gol",
    "Golf",
    "Jetta",
    "Nivus",
    "Parati",
    "Passat",
    "Polo",
    "Saveiro",
    "Taos",
    "T-Cross",
    "Tiguan",
    "Up",
    "Virtus",
    "Voyage",
  ],
  Volvo: ["C40", "S60", "V40", "XC40", "XC60", "XC90"],
};

export function normalizeVehicleModel(value: string) {
  return normalizeVehicleBrand(value);
}

export function getVehicleModelSuggestions(brand: string, value: string) {
  const normalizedBrand = normalizeVehicleBrand(brand);
  const brandEntry = Object.entries(VEHICLE_MODELS_BY_BRAND).find(
    ([brandName]) => normalizeVehicleBrand(brandName) === normalizedBrand
  );
  const models = brandEntry?.[1] ?? POPULAR_VEHICLE_MODELS;
  const term = normalizeVehicleModel(value);

  if (!term) {
    return models.slice(0, 8);
  }

  return models
    .filter((model) => normalizeVehicleModel(model).includes(term))
    .sort((a, b) => {
      const aStarts = normalizeVehicleModel(a).startsWith(term);
      const bStarts = normalizeVehicleModel(b).startsWith(term);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.localeCompare(b, "pt-BR");
    })
    .slice(0, 8);
}
