import {
  API_URL, LIMA, ARG, meta, intensity,
  ymdInTZ, hmInTZ, eventsForDay, groupByDay, isLive, nextEvent, monthMatrix,
} from "./logic.js";

const $ = (s) => document.querySelector(s);
let EV = [], tz = LIMA, sel = null, y, m;

async function boot() {
  try {
    const r = await fetch(API_URL);
    if (!r.ok) throw new Error("HTTP " + r.status);
    EV = (await r.json()).data.filter(e => e.enabled !== false);
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
      const types = [...new Set(eventsForDay(EV, key, tz).map(e => e.eventIndex))].slice(0, 4);
      const b = document.createElement("button");
      b.className = "cell" + (inM ? "" : " out") + (key === today ? " today" : "") + (key === sel ? " sel" : "");
      b.innerHTML = `<span>${+key.slice(-2)}</span>` +
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
    list.insertAdjacentHTML("beforeend", `<div class="slot">${g.slot}</div>`);
    for (const e of g.items) {
      const mm = meta(e.eventIndex), bd = intensity(e), live = isLive(e, now);
      list.insertAdjacentHTML("beforeend",
        `<div class="ev">
           <span class="t">${hmInTZ(new Date(Date.parse(e.startTime)), tz)}–${hmInTZ(new Date(Date.parse(e.endTime)), tz)}</span>
           <span class="bar" style="background:${mm.color}"></span>
           <span class="nm">${mm.name}${live ? ' <span class="live">• en vivo</span>' : ""}</span>
           ${bd ? `<span class="badge" style="background:${mm.color}1f;color:${mm.color}">${bd}</span>` : ""}
         </div>`);
    }
  }
}

$("#prev").onclick = () => { m--; if (m < 1) { m = 12; y--; } renderCal(); };
$("#nextm").onclick = () => { m++; if (m > 12) { m = 1; y++; } renderCal(); };
document.querySelectorAll("#tz button").forEach(btn => {
  btn.onclick = () => {
    tz = btn.dataset.tz;
    document.querySelectorAll("#tz button").forEach(x => x.classList.toggle("on", x === btn));
    renderAll();
  };
});

boot();
