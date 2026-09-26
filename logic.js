// logic.js — helpers puros (sin DOM). Importable en el navegador y en Node.

export const API_URL = "https://mt2009.uk/api/events/list";
export const LIMA = "America/Lima";                    // UTC-5
export const ARG  = "America/Argentina/Buenos_Aires";  // UTC-3

export const EVENT_META = {
  EVENT_TYPE_MOONLIGHT:               { name: "Luz de Luna",         color: "#b78bf5" },
  EVENT_TYPE_WHEEL_FORTUNE_EVENT:     { name: "Rueda de la Fortuna", color: "#ef7fd0" },
  EVENT_TYPE_DOUBLE_METIN_LOOT_EVENT: { name: "Doble Loot Metin",    color: "#ef6b6b" },
  EVENT_TYPE_DOUBLE_BOSS_LOOT_EVENT:  { name: "Doble Loot Boss",     color: "#f0913f" },
  EVENT_TYPE_DOUBLE_FISHING:          { name: "Pesca Doble",         color: "#3fb6e6" },
  EVENT_TYPE_DOUBLE_MINING:           { name: "Minería Doble",       color: "#9aa6b8" },
  EVENT_TYPE_EXP:                     { name: "EXP",                 color: "#43c96b" },
  EVENT_TYPE_ITEM_DROP:               { name: "Item Drop",           color: "#e0b83f" },
  EVENT_TYPE_YANG_DROP:               { name: "Yang Drop",           color: "#d9a520" },
  EVENT_TYPE_BONUS_EVENT:             { name: "Bonus",               color: "#d17ff0" },
  EVENT_TYPE_TANAKA:                  { name: "Tanaka",              color: "#ef6d86" },
  EVENT_TYPE_METIN_RAIN:              { name: "Metin Rain",          color: "#4f8fe8" },
};

export function meta(idx) {
  return EVENT_META[idx] || {
    name: idx.replace("EVENT_TYPE_", "").replace(/_/g, " ").toLowerCase(),
    color: "#7a8496",
  };
}

// Intensidad por tipo. La estrella ★ marca SOLO Rueda/Luna al 2% (value3>=2).
export function intensity(e) {
  const id = e.eventIndex, v0 = e.value0 || 0, v1 = e.value1 || 0, v3 = e.value3 || 0;
  if (id === "EVENT_TYPE_EXP" || id === "EVENT_TYPE_ITEM_DROP" || id === "EVENT_TYPE_YANG_DROP")
    return v0 ? `+${v0}%` : "";
  if (id === "EVENT_TYPE_MOONLIGHT" || id === "EVENT_TYPE_WHEEL_FORTUNE_EVENT")
    return v3 ? `${v3}%${v3 >= 2 ? " ★" : ""}` : "";
  if (id === "EVENT_TYPE_DOUBLE_METIN_LOOT_EVENT" || id === "EVENT_TYPE_DOUBLE_BOSS_LOOT_EVENT")
    return v3 ? `+${v3}%` : "";
  if (id === "EVENT_TYPE_DOUBLE_FISHING" || id === "EVENT_TYPE_DOUBLE_MINING") return "x2";
  if (id === "EVENT_TYPE_BONUS_EVENT") return v1 ? `+${v1}` : "";
  return "";
}

// Días "destacados" que se marcan con ★ en el calendario:
// doble pesca, y Luz de Luna / Ruleta al 2% o más.
export function isHighlight(e) {
  const id = e.eventIndex;
  if (id === "EVENT_TYPE_DOUBLE_FISHING") return true;
  if ((id === "EVENT_TYPE_MOONLIGHT" || id === "EVENT_TYPE_WHEEL_FORTUNE_EVENT") && (e.value3 || 0) >= 2) return true;
  return false;
}

// --- zona horaria (sin librerías) ---
function offsetMs(date, tz) {
  const p = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

// "YYYY-MM-DD" (medianoche local en tz) -> timestamp UTC
export function zonedToUtc(ymd, tz) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const ts0 = Date.UTC(Y, M - 1, D, 0, 0, 0);
  const off1 = offsetMs(new Date(ts0), tz);
  let cand = ts0 - off1;
  const off2 = offsetMs(new Date(cand), tz);
  if (off2 !== off1) cand = ts0 - off2; // 2ª pasada por DST, siempre desde ts0
  return cand;
}

export function ymdInTZ(date, tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}
export function hmInTZ(date, tz) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}
function addDay(ymd, n) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function parse(e) { return { start: Date.parse(e.startTime), end: Date.parse(e.endTime) }; }

// eventos (habilitados) que solapan el día ymd en tz
export function eventsForDay(events, ymd, tz) {
  const ds = zonedToUtc(ymd, tz);
  const de = zonedToUtc(addDay(ymd, 1), tz);
  return events
    .filter(e => e.enabled !== false)
    .filter(e => { const { start, end } = parse(e); return end > ds && start < de; })
    .sort((a, b) => parse(a).start - parse(b).start);
}

// agrupa por franja "HH:MM–HH:MM" (en tz), ordenado
export function groupByDay(events, tz) {
  const map = new Map();
  for (const e of events) {
    const { start, end } = parse(e);
    const key = `${hmInTZ(new Date(start), tz)}–${hmInTZ(new Date(end), tz)}`;
    if (!map.has(key)) map.set(key, { slot: key, start, end, items: [] });
    map.get(key).items.push(e);
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

export function isLive(e, now) {
  const { start, end } = parse(e);
  return now.getTime() >= start && now.getTime() <= end;
}

export function nextEvent(events, tz, now) {
  const upcoming = events
    .filter(e => e.enabled !== false && parse(e).start > now.getTime())
    .sort((a, b) => parse(a).start - parse(b).start);
  return upcoming.length ? { event: upcoming[0], ...parse(upcoming[0]) } : null;
}

// matriz de 6 semanas x 7 días (lunes→domingo) del mes (1-12)
export function monthMatrix(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dowMon = (first.getUTCDay() + 6) % 7; // 0=lunes
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(Date.UTC(year, month - 1, 1 - dowMon + w * 7 + d));
      row.push(cur.toISOString().slice(0, 10));
    }
    weeks.push(row);
  }
  return weeks;
}
