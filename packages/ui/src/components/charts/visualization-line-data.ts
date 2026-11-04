export const regions = ["Europe", "North America", "Asia Pacific", "South America", "Middle East"];
export const regionalTraffic = regions.flatMap((region, index) =>
  Array.from({ length: 90 }, (_, day) => ({
    region,
    day,
    value: Math.round(
      1000 + index * 450 + day * (12 + index * 2) + Math.sin(day / 6 + index) * 210 + Math.cos(day / 2.8) * 70,
    ),
  })),
);

export const forecast = Array.from({ length: 90 }, (_, day) => {
  const estimate = 85 + day * 0.6 + Math.sin(day / 9) * 12;
  const spread = 5 + Math.max(0, day - 59) * 0.6;
  return {
    day,
    estimate,
    observed: day < 60 ? estimate + Math.sin(day * 1.8) * 6 : null,
    lower95: estimate - spread * 2,
    upper95: estimate + spread * 2,
    lower80: estimate - spread,
    upper80: estimate + spread,
  };
});

const raw = Array.from({ length: 180 }, (_, day) => ({
  day,
  value: 100 + Math.sin(day / 12) * 22 + Math.sin(day * 1.7) * 12 + (day % 47 === 23 ? 65 : 0),
}));
export const rollingSeries = raw.map((row, index) => ({
  ...row,
  average: index < 6 ? null : raw.slice(index - 6, index + 1).reduce((sum, point) => sum + point.value, 0) / 7,
}));
export const spikes = rollingSeries.filter(({ value }) => value > 145);

export const serviceMetrics = Array.from({ length: 120 }, (_, minute) => ({
  minute,
  cpu: 45 + Math.sin(minute / 14) * 20 + (minute > 45 && minute < 75 ? 22 : 0),
  latency: 130 + Math.sin(minute / 14 + 0.6) * 40 + (minute > 45 && minute < 75 ? 130 : 0) + Math.cos(minute / 3) * 14,
}));
