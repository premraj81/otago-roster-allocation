const AGENT_FILE_STORAGE_KEY = "fiordland-calendar-rows-v1";
const VESSEL_ALLOCATION_KEY = "otago-vessel-pilot-allocations-v1";
const PILOT_SETTINGS_STORAGE_KEY = "otago-pilot-settings-v1";
const SOUTH_PORT_ALLOCATION = "SOUTH_PORT";
const APP_PREFS_KEY = "fps-roster-preferences-v1";

const defaultPilots = [
  ["TL", "Tony Lawrence"],
  ["SY", "Scott Young"],
  ["SS", "Sumanth Surendran"],
  ["JC", "Julien Charpentier"],
  ["LC", "Lawrence Clark"],
  ["PP", "Premraj Pillai"],
  ["JO", "Josh Osborne"],
  ["AKF", "Andrew Kerr Fox"],
  ["WT", "Wayne Turner"]
];

let vesselRows = [];
let vesselAllocations = {};
let pilotSettings = {};
let lastMasterDataStamp = "";
let reminderTimers = [];

const els = {
  pilotSelect: document.querySelector("#pilotSelect"),
  seasonSelect: document.querySelector("#seasonSelect"),
  monthSelect: document.querySelector("#monthSelect"),
  connectionStatus: document.querySelector("#connectionStatus"),
  summaryText: document.querySelector("#summaryText"),
  shipList: document.querySelector("#shipList")
};

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-NZ", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatFullDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatRecordDate(value, fallback = null) {
  const date = toDate(value) || (fallback ? toDate(fallback) : null);
  return date ? formatFullDate(date) : "";
}

function prefs() {
  try {
    return JSON.parse(localStorage.getItem(APP_PREFS_KEY)) || { pilot: "ALL", season: "2026", month: "ALL", reminderHours: "0", remindersSent: {} };
  } catch {
    return { pilot: "ALL", season: "2026", month: "ALL", reminderHours: "0", remindersSent: {} };
  }
}

function savePrefs(next) {
  localStorage.setItem(APP_PREFS_KEY, JSON.stringify(next));
}

function vesselNorm(value) {
  return clean(value).toLowerCase();
}

function vesselHasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function vesselPortText(row) {
  return [row.embark, row.disembark, row.fromTo, row.comments, row.stewartIsland].filter(Boolean).join(" | ");
}

function vesselHasStewart(row) {
  return vesselHasAny(vesselNorm(vesselPortText(row)), ["stewart", "stuart"]);
}

function vesselRouteStartsFromPoe(row) {
  return /^poe\s*\//i.test(clean(row.fromTo));
}

function vesselIsMilfordOnly(row) {
  const route = vesselNorm(row.fromTo);
  if (route.includes("milford only")) return true;
  const embark = vesselNorm(row.embark);
  const disembark = vesselNorm(row.disembark);
  return embark.includes("milford") && disembark.includes("milford");
}

function vesselCategory(row) {
  const embark = vesselNorm(row.embark);
  const routePorts = vesselNorm([row.embark, row.disembark].filter(Boolean).join(" | "));
  if (vesselRouteStartsFromPoe(row)) return "North Bound";
  if (vesselIsMilfordOnly(row)) return "South Bound";
  if (vesselHasAny(routePorts, ["bluff", "bench island", "beach island"])) return "Bluff";
  if (vesselHasAny(embark, ["port chalmers", "portchalmer", "port chlamaers", "port otago", "dunedin"])) return "North Bound";
  if (embark.includes("milford")) return "South Bound";
  if (vesselHasAny(routePorts, ["lyttelton", "timaru"])) return "Lyttelton/Timaru";
  return "Unclassified";
}

function adjustedEmbarkDate(row) {
  if (!row.embarkDate) return null;
  const embark = toDate(row.embarkDate);
  const minutes = timeToMinutes(row.embarkTime ?? row.embark_time ?? row.embarkTimeValue ?? row.embarkDateTime ?? "");
  return minutes !== null && minutes >= 18 * 60 ? addDays(embark, 1) : embark;
}

function timeToMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 24 * 60);
  const match = clean(value).match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function vesselDate(row) {
  return row.etaFiordland ? toDate(row.etaFiordland) : null;
}

function shipRosterDate(row) {
  const route = vesselCategory(row);
  const embark = adjustedEmbarkDate(row);
  if (route === "North Bound" && row.embarkDate) return toDate(row.embarkDate);
  if ((route === "Lyttelton/Timaru" || route === "Bluff") && embark) return embark;
  return vesselDate(row);
}

function vesselAllocationKey(row) {
  const rosterDate = shipRosterDate(row);
  const base = row.sourceRow ?? `${row.vessel}-${row.etaFiordland}`;
  return `${base}:${rosterDate ? dateKey(rosterDate) : "no-date"}`;
}

function allocationsFor(row) {
  const value = vesselAllocations[vesselAllocationKey(row)];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function shipSpecKey(value) {
  return vesselNorm(value).normalize("NFD").replace(/[\u0300-\u036f']/g, "");
}

function shipSpecsFor(row) {
  return (window.SHIP_SPECS || {})[shipSpecKey(row.vessel)] || {};
}

function companyFor(row) {
  return clean(row.company) || clean(shipSpecsFor(row).company);
}

function loaFor(row) {
  return clean(row.length) || clean(row.loa) || clean(shipSpecsFor(row).length);
}

function pilotOptions() {
  const settings = pilotSettings || {};
  return defaultPilots.map(([code, fallback]) => [code, settings[code]?.name || fallback]);
}

function seasonLabel(startYear) {
  return `${startYear}/${Number(startYear) + 1}`;
}

function seasonForDate(date) {
  return date.getMonth() >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

function availableSeasons() {
  const seasons = new Set([2026, 2027, 2028, 2029, 2030]);
  vesselRows.forEach((row) => {
    const rosterDate = shipRosterDate(row);
    if (rosterDate) seasons.add(seasonForDate(rosterDate));
  });
  return [...seasons].sort((a, b) => a - b);
}

function monthLabel(monthKey) {
  if (monthKey === "ALL") return "All months";
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NZ", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function buildSeasonMonthSelects() {
  const pref = prefs();
  const seasons = availableSeasons();
  els.seasonSelect.innerHTML = seasons.map((season) => `<option value="${season}">${seasonLabel(season)}</option>`).join("");
  els.seasonSelect.value = seasons.includes(Number(pref.season)) ? String(pref.season) : String(seasons[0] || 2026);

  const selectedSeason = Number(els.seasonSelect.value);
  const months = new Set(["ALL"]);
  vesselRows.forEach((row) => {
    const rosterDate = shipRosterDate(row);
    if (rosterDate && seasonForDate(rosterDate) === selectedSeason) {
      months.add(`${rosterDate.getFullYear()}-${String(rosterDate.getMonth() + 1).padStart(2, "0")}`);
    }
  });
  els.monthSelect.innerHTML = [...months]
    .map((month) => `<option value="${month}">${monthLabel(month)}</option>`)
    .join("");
  els.monthSelect.value = [...els.monthSelect.options].some((option) => option.value === pref.month) ? pref.month : "ALL";
}

function buildPilotSelect() {
  const pref = prefs();
  els.pilotSelect.innerHTML = `<option value="ALL">All pilots</option>${pilotOptions()
    .map(([code, name]) => `<option value="${code}">${code} - ${name}</option>`)
    .join("")}`;
  els.pilotSelect.value = pref.pilot || "ALL";
}

async function loadSharedData({ notifyChanges = false } = {}) {
  if (!window.OtagoSharedStore?.isReady) {
    els.connectionStatus.textContent = "Shared data unavailable";
    return;
  }

  const [rows, allocations, settings] = await Promise.all([
    window.OtagoSharedStore.load(AGENT_FILE_STORAGE_KEY),
    window.OtagoSharedStore.load(VESSEL_ALLOCATION_KEY),
    window.OtagoSharedStore.load(PILOT_SETTINGS_STORAGE_KEY)
  ]);

  const nextStamp = [rows.updatedAt, allocations.updatedAt, settings.updatedAt].filter(Boolean).join("|");
  if (notifyChanges && lastMasterDataStamp && nextStamp !== lastMasterDataStamp) {
    showNotification("FPS Roster updated", "Master roster data has changed.");
  }
  lastMasterDataStamp = nextStamp;

  vesselRows = (rows.data || []).map((row) => ({
    ...row,
    etaFiordland: row.etaFiordland ? new Date(row.etaFiordland) : null,
    embarkDate: row.embarkDate ? new Date(row.embarkDate) : null,
    disembarkDate: row.disembarkDate ? new Date(row.disembarkDate) : null
  }));
  vesselAllocations = allocations.data || {};
  pilotSettings = settings.data || {};

  buildPilotSelect();
  buildSeasonMonthSelects();
  render();
  scheduleReminders();
  els.connectionStatus.textContent = `Updated ${new Date().toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}`;
}

function routeClass(route) {
  if (route === "North Bound") return "north";
  if (route === "South Bound") return "south";
  return "other";
}

function visibleItems() {
  const selectedPilot = els.pilotSelect.value || "ALL";
  const selectedSeason = Number(els.seasonSelect.value || prefs().season || 2026);
  const selectedMonth = els.monthSelect.value || "ALL";
  return vesselRows
    .map((row) => {
      const rosterDate = shipRosterDate(row);
      if (!clean(row.vessel) || !rosterDate) return null;
      if (seasonForDate(rosterDate) !== selectedSeason) return null;
      const monthKey = `${rosterDate.getFullYear()}-${String(rosterDate.getMonth() + 1).padStart(2, "0")}`;
      if (selectedMonth !== "ALL" && monthKey !== selectedMonth) return null;
      const assigned = allocationsFor(row);
      if (selectedPilot !== "ALL" && !assigned.includes(selectedPilot)) return null;
      const route = vesselCategory(row);
      const isSouthPort = assigned.includes(SOUTH_PORT_ALLOCATION);
      return {
        key: vesselAllocationKey(row),
        date: rosterDate,
        vessel: row.vessel || "Unnamed vessel",
        company: companyFor(row),
        loa: loaFor(row),
        route,
        routeClass: routeClass(route),
        pilots: assigned.length ? assigned.map((code) => code === SOUTH_PORT_ALLOCATION ? "South Port" : code).join(", ") : "Unallocated",
        isSouthPort,
        embark: clean(row.embark) || "-",
        embarkDate: formatRecordDate(row.embarkDate, rosterDate) || "-",
        fiordlandDate: formatRecordDate(row.etaFiordland, rosterDate) || "-",
        disembark: clean(row.disembark) || "-",
        disembarkDate: formatRecordDate(row.disembarkDate) || "-",
        fromTo: clean(row.fromTo),
        stewart: vesselHasStewart(row),
        comments: clean(row.comments)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date || a.vessel.localeCompare(b.vessel));
}

function render() {
  const items = visibleItems();
  const pilot = els.pilotSelect.value || "ALL";
  els.summaryText.textContent = `${pilot === "ALL" ? "All pilots" : pilot}: ${items.length} vessel${items.length === 1 ? "" : "s"}`;
  els.shipList.innerHTML = items.length
    ? items.map((item) => `
      <article class="ship-card ${item.isSouthPort ? "south-port" : ""}">
        <div class="card-top">
          <div>
            <time class="date">${formatShortDate(item.date)}</time>
            <h2>${escapeHtml(item.vessel)}${item.loa ? ` <small>(${escapeHtml(item.loa)}m)</small>` : ""}</h2>
            ${item.company ? `<div class="company">${escapeHtml(item.company)}</div>` : ""}
          </div>
          <span class="route ${item.routeClass}">${escapeHtml(item.route)}</span>
        </div>
        <div class="details">
          <span>Pilot</span><strong class="pilot">${escapeHtml(item.pilots)}</strong>
          <span>Embark</span><strong>${escapeHtml(item.embark)}<small>${escapeHtml(item.embarkDate)}</small></strong>
          <span>Fiordland</span><strong>${escapeHtml(item.fiordlandDate)}</strong>
          <span>Disembark</span><strong>${escapeHtml(item.disembark)}<small>${escapeHtml(item.disembarkDate)}</small></strong>
          ${item.fromTo ? `<span>From / To</span><strong>${escapeHtml(item.fromTo)}</strong>` : ""}
          ${item.stewart ? `<span>Stewart</span><strong class="stewart">Yes</strong>` : ""}
        </div>
        ${item.comments ? `<div class="note">${escapeHtml(item.comments)}</div>` : ""}
      </article>
    `).join("")
    : `<div class="empty">No vessels for this selection.</div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    els.connectionStatus.textContent = "Notifications not supported on this device";
    return;
  }
  const permission = await Notification.requestPermission();
  els.connectionStatus.textContent = permission === "granted" ? "Notifications enabled" : "Notifications not enabled";
}

function showNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  navigator.serviceWorker?.ready?.then((registration) => {
    registration.showNotification(title, { body, icon: "./icon.svg", badge: "./icon.svg" });
  }).catch(() => new Notification(title, { body, icon: "./icon.svg" }));
}

function scheduleReminders() {
  reminderTimers.forEach((timer) => clearTimeout(timer));
  reminderTimers = [];
  const pref = prefs();
  const hours = Number(pref.reminderHours || 0);
  if (!hours) return;
  const sent = pref.remindersSent || {};
  const now = Date.now();

  visibleItems().forEach((item) => {
    const remindAt = item.date.getTime() - hours * 60 * 60 * 1000;
    const delay = remindAt - now;
    const reminderKey = `${item.key}:${hours}`;
    if (sent[reminderKey]) return;
    if (delay <= 0 && delay > -60 * 60 * 1000) {
      notifyReminder(item, reminderKey);
      return;
    }
    if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
      reminderTimers.push(setTimeout(() => notifyReminder(item, reminderKey), delay));
    }
  });
}

function notifyReminder(item, reminderKey) {
  const pref = prefs();
  pref.remindersSent = { ...(pref.remindersSent || {}), [reminderKey]: new Date().toISOString() };
  savePrefs(pref);
  showNotification(`${item.vessel} reminder`, `${formatShortDate(item.date)} - ${item.route} - ${item.pilots}`);
}

els.pilotSelect.addEventListener("change", () => {
  const pref = prefs();
  pref.pilot = els.pilotSelect.value;
  savePrefs(pref);
  render();
  scheduleReminders();
});

els.seasonSelect.addEventListener("change", () => {
  const pref = prefs();
  pref.season = els.seasonSelect.value;
  pref.month = "ALL";
  savePrefs(pref);
  buildSeasonMonthSelects();
  render();
});

els.monthSelect.addEventListener("change", () => {
  const pref = prefs();
  pref.month = els.monthSelect.value;
  savePrefs(pref);
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

window.addEventListener("focus", () => loadSharedData({ notifyChanges: true }));
setInterval(() => {
  if (!document.hidden) loadSharedData({ notifyChanges: true });
}, 60000);

buildPilotSelect();
loadSharedData();
