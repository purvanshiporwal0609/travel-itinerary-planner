export const TYPES = {
  attraction: { icon: "🏛️", label: "Sight", color: "#6366f1" },
  food: { icon: "🍽️", label: "Food", color: "#f59e0b" },
  transport: { icon: "🚕", label: "Transport", color: "#06b6d4" },
  activity: { icon: "🎯", label: "Activity", color: "#ec4899" },
  stay: { icon: "🛏️", label: "Stay", color: "#10b981" },
};
export const typeOf = (t) => TYPES[t] || TYPES.activity;

export const money = (n, cur) => `${cur} ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

export const mapsUrl = (name, dest) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${dest}`)}`;

export const duration = (m) => {
  m = Number(m) || 0;
  if (!m) return "";
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
};

export const dayDate = (start, i) => {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + i);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

export const dayCost = (day) => day.items.reduce((s, i) => s + (Number(i.cost) || 0), 0);

export function planTotals(plan) {
  const byType = {};
  plan.days.forEach((d) => d.items.forEach((i) => {
    const k = TYPES[i.type] ? i.type : "activity";
    byType[k] = (byType[k] || 0) + (Number(i.cost) || 0);
  }));
  const stay = Number(plan.accommodation_cost) || 0;
  if (stay) byType.stay = (byType.stay || 0) + stay;
  const total = Object.values(byType).reduce((a, b) => a + b, 0);
  return { total, byType, itemCount: plan.days.reduce((s, d) => s + d.items.length, 0) };
}

export function gradientFor(s = "") {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 75% 55%), hsl(${(h + 50) % 360} 80% 45%))`;
}
