import {
  API_URL, LIMA, meta, intensity, isHighlight,
  ymdInTZ, hmInTZ, eventsForDay, groupByDay, isLive, nextEvent, monthMatrix,
} from "./logic.js?v=9";

const $ = (s) => document.querySelector(s);

// Zona horaria detectada automáticamente del dispositivo del visitante.
function detectTZ() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || LIMA; }
  catch { return LIMA; }
}
function tzName(z) {
  try { return z.split("/").pop().replace(/_/g, " "); } catch { return z; }
}

let EV = [], tz = detectTZ(), sel = null, y, m;

// Proxy same-origin (/api, evita CORS/bloqueos de WebView); si falla, directo al API.
async function fetchEvents() {
  let lastErr;
  for (const url of ["/api/events/list", API_URL]) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (!Array.isArray(j.data)) throw new Error("formato inesperado");
      return j.data.filter(e => e.enabled !== false);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("sin datos");
}

async function boot() {
  try {
    EV = await fetchEvents();
  } catch (err) {
    $("#list").innerHTML = '<div class="empty">No se pudieron cargar los eventos. Reintenta en un momento.</div>';
    return;
  }
  const d = new Date();
  y = d.getFullYear();
  m = d.getMonth() + 1;
  sel = ymdInTZ(d, tz);
  renderAll();
}

function renderAll() {
  $("#tzname").textContent = tzName(tz);
  renderCal();
  renderDay();
  $("#foot").textContent = "Fuente mt2009.uk · actualizado " + hmInTZ(new Date(), tz);
}

function renderCal() {
  $("#mlabel").textContent = new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
  const cal = $("#cal");
  cal.innerHTML = "";
  const today = ymdInTZ(new Date(), tz);
  for (const week of monthMatrix(y, m)) {
    for (const key of week) {
      const inM = key.slice(0, 7) === `${y}-${String(m).padStart(2, "0")}`;
      const dayEvents = eventsForDay(EV, key, tz);
      const types = [...new Set(dayEvents.map(e => e.eventIndex))].slice(0, 4);
      const highlights = dayEvents.filter(isHighlight);
      const b = document.createElement("button");
      b.className = "cell" + (inM ? "" : " out") + (key === today ? " today" : "") + (key === sel ? " sel" : "");
      if (highlights.length) {
        b.title = "★ " + [...new Set(highlights.map(e => meta(e.eventIndex).name))].join(", ");
      }
      b.innerHTML =
        (highlights.length ? '<span class="star">★</span>' : "") +
        `<span>${+key.slice(-2)}</span>` +
        `<span class="dots">${types.map(id => `<i style="background:${meta(id).color}"></i>`).join("")}</span>`;
      b.onclick = () => { sel = key; renderCal(); renderDay(); };
      cal.appendChild(b);
    }
  }
}

function renderDay() {
  $("#dlabel").textContent = new Date(sel + "T12:00:00Z")
    .toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const now = new Date();
  const evs = eventsForDay(EV, sel, tz);
  $("#dmeta").textContent = evs.length ? `${evs.length} eventos` : "sin eventos";

  const nx = nextEvent(EV, tz, now);
  $("#next").innerHTML = nx ? `Próximo: <b>${meta(nx.event.eventIndex).name}</b> · ${hmInTZ(new Date(nx.start), tz)}` : "";

  const list = $("#list");
  list.innerHTML = "";
  if (!evs.length) { list.innerHTML = '<div class="empty">Sin eventos este día.</div>'; return; }

  for (const g of groupByDay(evs, tz)) {
    const gs = new Date(g.start), ge = new Date(g.end);
    const cross = ymdInTZ(gs, tz) !== ymdInTZ(ge, tz);
    const inProgress = now >= gs && now <= ge;
    list.insertAdjacentHTML("beforeend",
      `<div class="franja">
         <span class="a">${hmInTZ(gs, tz)}</span><span class="arw">→</span><span class="b">${hmInTZ(ge, tz)}</span>
         ${cross ? '<span class="xday" title="termina al día siguiente">+1</span>' : ""}
         ${inProgress ? '<span class="pill">en curso</span>' : ""}
       </div>`);
    for (const e of g.items) {
      const mm = meta(e.eventIndex), bd = intensity(e), live = isLive(e, now), hl = isHighlight(e);
      list.insertAdjacentHTML("beforeend",
        `<div class="ev">
           <span class="bar" style="background:${mm.color}"></span>
           <span class="nm">${hl ? '<span class="hstar">★</span> ' : ""}${mm.name}${live ? ' <span class="live">• en vivo</span>' : ""}</span>
           ${bd ? `<span class="badge" style="background:${mm.color}2e;color:var(--ink);border:1px solid ${mm.color}66">${bd}</span>` : ""}
         </div>`);
    }
  }
}

$("#prev").onclick = () => { m--; if (m < 1) { m = 12; y--; } renderCal(); };
$("#nextm").onclick = () => { m++; if (m > 12) { m = 1; y++; } renderCal(); };

// Tema claro/oscuro: preferencia guardada > sistema. El atributo data-theme ya lo
// fija un script inline en <head> (sin flash); aquí solo sincronizamos y manejamos el toggle.
const THEME_KEY = "mtevents-theme";
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === "dark" ? "#141310" : "#f7f6f1";
}
$("#theme").onclick = () => {
  const nt = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, nt); } catch (e) {}
  setTheme(nt);
};
setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

boot();
