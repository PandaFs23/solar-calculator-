// household loads: running watts + typical annual kWh
export const APPLIANCES = [
  { id: "ev", name: "EV charger (Level 2)", watts: 7700, kwhYr: 0, backupDefault: false, ev: true },
  { id: "ac", name: "Central AC", watts: 3500, kwhYr: 2000, backupDefault: false },
  { id: "heatpump", name: "Heat pump (heating)", watts: 3000, kwhYr: 2500, backupDefault: false },
  { id: "waterheater", name: "Electric water heater", watts: 4000, kwhYr: 1800, backupDefault: false },
  { id: "pool", name: "Pool pump", watts: 1500, kwhYr: 2200, backupDefault: false },
  { id: "fridge", name: "Refrigerator / freezer", watts: 150, kwhYr: 500, backupDefault: true },
  { id: "range", name: "Electric range / oven", watts: 2500, kwhYr: 450, backupDefault: false },
  { id: "laundry", name: "Washer + electric dryer", watts: 3500, kwhYr: 700, backupDefault: false },
  { id: "dishwasher", name: "Dishwasher", watts: 1500, kwhYr: 250, backupDefault: false },
  { id: "welllpump", name: "Well pump", watts: 1000, kwhYr: 700, backupDefault: true },
  { id: "hottub", name: "Hot tub / spa", watts: 4000, kwhYr: 2000, backupDefault: false },
  { id: "lights", name: "Lighting (whole home)", watts: 200, kwhYr: 400, backupDefault: true },
  { id: "electronics", name: "Electronics / WiFi / TV", watts: 250, kwhYr: 600, backupDefault: true },
  { id: "medical", name: "Medical equipment", watts: 400, kwhYr: 300, backupDefault: true },
  { id: "custom", name: "Other / custom load", watts: 500, kwhYr: 500, backupDefault: false },
];
