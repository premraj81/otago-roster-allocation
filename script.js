const STORAGE_KEY = "otago-roster-edits-v2";
const VESSEL_ALLOCATION_KEY = "otago-vessel-pilot-allocations-v1";
const AGENT_FILE_STORAGE_KEY = "fiordland-calendar-rows-v1";
const POL_CRUISE_COUNTS_KEY = "pol-cruise-counts-v1";
const EVENT_LOG_STORAGE_KEY = "otago-event-log-v1";
const SOUTH_PORT_ALLOCATION = "SOUTH_PORT";

const pilots = [
  {
    code: "TL",
    name: "Tony Lawrence",
    roster: 1,
    color: "#0d73c9",
    start: "2026-10-13",
    onDays: 7,
    offDays: 14,
  },
  {
    code: "SY",
    name: "Scott Young",
    roster: 1,
    color: "#f3b11c",
    start: "2026-09-29",
    onDays: 7,
    offDays: 7,
  },
  {
    code: "SS",
    name: "Sumanth Surendran",
    roster: 1,
    color: "#f6a3a0",
    start: "2026-09-29",
    onDays: 7,
    offDays: 7,
  },
  {
    code: "JC",
    name: "Julien Charpentier",
    roster: 1,
    color: "#ffd446",
    start: "2026-09-29",
    onDays: 7,
    offDays: 7,
  },
  {
    code: "LC",
    name: "Lawrence Clark",
    roster: "floating",
    color: "#c8c2e8",
    start: "2026-10-02",
    onDays: 7,
    offDays: 7,
  },
  {
    code: "PP",
    name: "Premraj Pillai",
    roster: 2,
    color: "#ffd446",
    start: "2026-10-06",
    onDays: 7,
    offDays: 7,
  },
  {
    code: "JO",
    name: "Josh Osborne",
    roster: 2,
    color: "#f4b384",
    start: "2026-10-06",
    onDays: 7,
    offDays: 7,
  },
  {
    code: "AKF",
    name: "Andrew Kerr Fox",
    roster: 2,
    color: "#ffffff",
    start: "2026-10-06",
    onDays: 7,
    offDays: 7,
  },
  {
    code: "WT",
    name: "Wayne Turner",
    roster: "fiords",
    color: "#f7d66f",
    contractor: true,
  },
];

const specialWork = ["NB", "SB", "STEWART", "TOTAL_SHIP"];
const vesselRoutes = [
  "North Bound",
  "South Bound",
  "Bluff",
  "Lyttelton/Timaru",
  "Unclassified",
];
const today = dateOnly(new Date());
const seasonStarts = [2026, 2027, 2028, 2029, 2030];
let selectedSeasonStart = 2026;
let rosterStart = seasonStartDate(selectedSeasonStart);
let rosterEnd = seasonEndDate(selectedSeasonStart);
let edits = loadEdits();
let vesselAllocations = loadVesselAllocations();
let vesselRows = loadAgentVesselRows();
let polCruiseCounts = loadPolCruiseCounts();
let eventLog = loadEventLog();
let remoteRefreshInFlight = false;
const rosterSubtitle = document.querySelector("#rosterSubtitle");
const seasonSelect = document.querySelector("#seasonSelect");
const monthSelect = document.querySelector("#monthSelect");
const pilotHeader = document.querySelector("#pilotHeader");
const rosterBody = document.querySelector("#rosterBody");
const shippingSummary = document.querySelector("#shippingSummary");
const tabButtons = document.querySelectorAll(".tab-button");
const rosterTab = document.querySelector("#rosterTab");
const agentTab = document.querySelector("#agentTab");
const polCruiseTab = document.querySelector("#polCruiseTab");
const printItemsTab = document.querySelector("#printItemsTab");
const printItemsBody = document.querySelector("#printItemsBody");
const printSummary = document.querySelector("#printSummary");
const printItemsButton = document.querySelector("#printItemsButton");
const recordTabs = document.querySelectorAll(".record-tab");
const vesselRecordsView = document.querySelector("#vesselRecordsView");
const pilotRecordsView = document.querySelector("#pilotRecordsView");
const pilotRecordSelect = document.querySelector("#pilotRecordSelect");
const pilotRecordsBody = document.querySelector("#pilotRecordsBody");
const eventsTab = document.querySelector("#eventsTab");
const workbookTab = document.querySelector("#workbookTab");
const workbookBody = document.querySelector("#workbookBody");
const workbookSummary = document.querySelector("#workbookSummary");
const eventItemsBody = document.querySelector("#eventItemsBody");
const eventSummary = document.querySelector("#eventSummary");
const eventRefreshButton = document.querySelector("#eventRefreshButton");
const eventClearButton = document.querySelector("#eventClearButton");

function toDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function seasonStartDate(startYear) {
  return toDate(`${startYear}-10-01`);
}

function seasonEndDate(startYear) {
  return toDate(`${startYear + 1}-04-30`);
}

function seasonLabel(startYear) {
  return `${startYear}/${startYear + 1}`;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(a, b) {
  return Math.floor((dateOnly(a) - dateOnly(b)) / 86400000);
}

function isPilotWorking(pilot, date) {
  if (pilot.contractor) return false;
  const offset = daysBetween(date, toDate(pilot.start));
  if (offset < 0) return false;
  const cycle = pilot.onDays + pilot.offDays;
  return offset % cycle < pilot.onDays;
}

function allDates() {
  const dates = [];
  for (let d = new Date(rosterStart); d <= rosterEnd; d = addDays(d, 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("en-NZ", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadEdits() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveEdits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  saveSharedState(STORAGE_KEY, edits);
}

function loadVesselAllocations() {
  try {
    const raw = JSON.parse(localStorage.getItem(VESSEL_ALLOCATION_KEY)) || {};
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        Array.isArray(value) ? value : value ? [value] : [],
      ])
    );
  } catch {
    return {};
  }
}

function saveVesselAllocations() {
  localStorage.setItem(VESSEL_ALLOCATION_KEY, JSON.stringify(vesselAllocations));
  saveSharedState(VESSEL_ALLOCATION_KEY, vesselAllocations);
}

function loadAgentVesselRows() {
  try {
    const saved = localStorage.getItem(AGENT_FILE_STORAGE_KEY);
    const rows = saved ? JSON.parse(saved) : window.FIORDLAND_INITIAL_ROWS || [];
    return rows.map(reviveVesselRow);
  } catch {
    return (window.FIORDLAND_INITIAL_ROWS || []).map(reviveVesselRow);
  }
}

function loadPolCruiseCounts() {
  try {
    const saved = localStorage.getItem(POL_CRUISE_COUNTS_KEY);
    const payload = saved ? JSON.parse(saved) : {};
    return payload.counts || {};
  } catch {
    return {};
  }
}

function loadEventLog() {
  try {
    return JSON.parse(localStorage.getItem(EVENT_LOG_STORAGE_KEY)) || { events: [] };
  } catch {
    return { events: [] };
  }
}

function saveSharedState(key, data) {
  window.OtagoSharedStore?.save(key, data).catch((error) => {
    console.warn(`Could not save ${key} to Supabase`, error);
  });
}

function normalizeVesselAllocations(raw) {
  return Object.fromEntries(
    Object.entries(raw || {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value : value ? [value] : [],
    ])
  );
}

function serializeVesselRows(rows) {
  return JSON.parse(JSON.stringify(rows || []));
}

function replaceLocalStorageJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function hasJsonChanged(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

async function seedOrLoadSharedState(key, localValue) {
  const shared = window.OtagoSharedStore;
  if (!shared?.isReady) return { value: null, found: false };

  const remote = await shared.load(key);
  if (!remote.found) {
    await shared.save(key, localValue);
    return { value: null, found: false };
  }
  return { value: remote.data, found: true };
}

async function refreshSharedState() {
  if (remoteRefreshInFlight || !window.OtagoSharedStore?.isReady) return;
  remoteRefreshInFlight = true;

  try {
    const [remoteEdits, remoteAllocations, remoteRows, remoteCounts] = await Promise.all([
      seedOrLoadSharedState(STORAGE_KEY, edits),
      seedOrLoadSharedState(VESSEL_ALLOCATION_KEY, vesselAllocations),
      seedOrLoadSharedState(AGENT_FILE_STORAGE_KEY, serializeVesselRows(vesselRows)),
      seedOrLoadSharedState(POL_CRUISE_COUNTS_KEY, { counts: polCruiseCounts }),
    ]);

    let shouldBuildTable = false;

    if (remoteEdits.found && hasJsonChanged(edits, remoteEdits.value || {})) {
      edits = remoteEdits.value || {};
      replaceLocalStorageJson(STORAGE_KEY, edits);
      shouldBuildTable = true;
    }

    if (remoteAllocations.found) {
      const nextAllocations = normalizeVesselAllocations(remoteAllocations.value || {});
      if (hasJsonChanged(vesselAllocations, nextAllocations)) {
        vesselAllocations = nextAllocations;
        replaceLocalStorageJson(VESSEL_ALLOCATION_KEY, vesselAllocations);
        shouldBuildTable = true;
      }
    }

    if (remoteRows.found) {
      const nextRows = (remoteRows.value || []).map(reviveVesselRow);
      if (hasJsonChanged(serializeVesselRows(vesselRows), serializeVesselRows(nextRows))) {
        vesselRows = nextRows;
        replaceLocalStorageJson(AGENT_FILE_STORAGE_KEY, serializeVesselRows(vesselRows));
        shouldBuildTable = true;
      }
    }

    if (remoteCounts.found) {
      const nextCounts = remoteCounts.value?.counts || {};
      if (hasJsonChanged(polCruiseCounts, nextCounts)) {
        polCruiseCounts = nextCounts;
        replaceLocalStorageJson(POL_CRUISE_COUNTS_KEY, remoteCounts.value || { counts: nextCounts });
        shouldBuildTable = true;
      }
    }

    if (shouldBuildTable) {
      const shell = document.querySelector(".table-shell");
      const left = shell.scrollLeft;
      const top = shell.scrollTop;
      buildTable();
      shell.scrollLeft = left;
      shell.scrollTop = top;
      if (printItemsTab.classList.contains("active")) renderPrintItems();
    }
  } catch (error) {
    console.warn("Could not refresh shared roster data", error);
  } finally {
    remoteRefreshInFlight = false;
  }
}

async function recordEvent(type, title, details = "") {
  const event = { type, title, details };

  try {
    if (window.OtagoSharedStore?.logEvent) {
      await window.OtagoSharedStore.logEvent(event);
    } else {
      const next = {
        events: [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: new Date().toISOString(),
            source: "Otago Roster",
            ...event,
          },
          ...(eventLog.events || []),
        ].slice(0, 800),
      };
      eventLog = next;
      localStorage.setItem(EVENT_LOG_STORAGE_KEY, JSON.stringify(next));
    }
    await refreshEventLog();
  } catch (error) {
    console.warn("Could not record event", error);
  }
}

async function refreshEventLog({ seedIfMissing = false } = {}) {
  try {
    const shared = window.OtagoSharedStore;
    if (shared?.isReady) {
      const remote = await shared.load(EVENT_LOG_STORAGE_KEY);
      if (!remote.found && seedIfMissing) {
        await shared.save(EVENT_LOG_STORAGE_KEY, eventLog);
      } else if (remote.found) {
        eventLog = remote.data || { events: [] };
        localStorage.setItem(EVENT_LOG_STORAGE_KEY, JSON.stringify(eventLog));
      }
    } else {
      eventLog = loadEventLog();
    }
    renderEvents();
  } catch (error) {
    console.warn("Could not refresh events", error);
  }
}

function formatEventTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function renderEvents() {
  const events = eventLog.events || [];
  eventSummary.textContent = `${events.length} recorded event${events.length === 1 ? "" : "s"}`;
  eventItemsBody.innerHTML = events.length
    ? events
        .map((event) => `
          <tr data-event-id="${escapeHtml(event.id || "")}">
            <td>${escapeHtml(formatEventTime(event.createdAt))}</td>
            <td>
              <span class="event-type event-type-${escapeHtml(event.type || "general")}">${escapeHtml(event.title || "Event")}</span>
            </td>
            <td>${escapeHtml(event.details || "")}</td>
            <td><button class="event-delete-button" type="button" data-event-id="${escapeHtml(event.id || "")}">Clear</button></td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="4" class="event-empty">No events recorded yet.</td></tr>`;
}

async function saveEventLog() {
  localStorage.setItem(EVENT_LOG_STORAGE_KEY, JSON.stringify(eventLog));
  if (window.OtagoSharedStore?.isReady) {
    await window.OtagoSharedStore.save(EVENT_LOG_STORAGE_KEY, eventLog);
  }
  renderEvents();
}

async function clearEventRecord(eventId) {
  if (!eventId) return;
  eventLog = {
    events: (eventLog.events || []).filter((event) => event.id !== eventId),
  };
  try {
    await saveEventLog();
  } catch (error) {
    console.warn("Could not clear event record", error);
  }
}

async function clearAllEvents() {
  const count = (eventLog.events || []).length;
  eventLog = { events: [] };
  try {
    await saveEventLog();
    if (count > 0) {
      await recordEvent("general", "Events cleared", `${count} event record${count === 1 ? "" : "s"} cleared`);
    }
  } catch (error) {
    console.warn("Could not clear all events", error);
  }
}

function reviveVesselRow(row) {
  return {
    ...row,
    etaFiordland: row.etaFiordland ? new Date(row.etaFiordland) : null,
    etdFiordland: row.etdFiordland ? new Date(row.etdFiordland) : null,
    embarkDate: row.embarkDate ? new Date(row.embarkDate) : null,
    disembarkDate: row.disembarkDate ? new Date(row.disembarkDate) : null,
  };
}

function refreshVesselRowsFromAgent() {
  const nextRows = loadAgentVesselRows();
  const before = JSON.stringify(vesselRows);
  const after = JSON.stringify(nextRows);
  if (before === after) return;

  vesselRows = nextRows;
  const shell = document.querySelector(".table-shell");
  const left = shell.scrollLeft;
  const top = shell.scrollTop;
  buildTable();
  shell.scrollLeft = left;
  shell.scrollTop = top;
}

function refreshPolCruiseCounts() {
  const nextCounts = loadPolCruiseCounts();
  const before = JSON.stringify(polCruiseCounts);
  const after = JSON.stringify(nextCounts);
  if (before === after) return;

  polCruiseCounts = nextCounts;
  const shell = document.querySelector(".table-shell");
  const left = shell.scrollLeft;
  const top = shell.scrollTop;
  buildTable();
  shell.scrollLeft = left;
  shell.scrollTop = top;
}

function editKey(date, pilot) {
  return `${dateKey(date)}:${pilot.code}`;
}

function baselineValue(pilot, date) {
  return isPilotWorking(pilot, date) ? pilot.code : "";
}

function currentValue(pilot, date) {
  const key = editKey(date, pilot);
  const vesselValue = vesselAssignmentValue(pilot, date);
  if (vesselValue) return vesselValue;
  return Object.prototype.hasOwnProperty.call(edits, key)
    ? edits[key]
    : baselineValue(pilot, date);
}

function isWorkingValue(value) {
  return value !== "" && !value.endsWith("_SICK");
}

function isPolAvailableValue(value) {
  return isWorkingValue(value) && !value.startsWith("FP_");
}

function displayValue(value, pilot, showFullNames) {
  if (!value) return "";
  if (value.endsWith("_SICK")) return `${pilot.code} sick`;
  if (value.startsWith("FP_")) return pilot.code;
  if (value === "WT") return showFullNames ? pilot.name : "WT";
  if (value === pilot.code && showFullNames) return pilot.name;
  if (value === "FIORDS") return "Fiords";
  return value;
}

function cellClass(value, baseline) {
  if (value.endsWith("_SICK")) return "sick";
  if (value.startsWith("FP_")) return "fiordland-work";
  if (value === "FIORDS") return "fiords";
  if (isWorkingValue(value)) return "on";
  return baseline ? "removed" : "off";
}

function buildHeader() {
  pilotHeader.innerHTML = "";
  pilots.forEach((pilot) => {
    const th = document.createElement("th");
    th.className = "pilot-head";
    th.style.background = pilot.color;
    th.textContent = pilot.code;
    th.title = pilot.name;
    pilotHeader.appendChild(th);
  });

  const pol = document.createElement("th");
  pol.className = "pol-col";
  pol.textContent = "";
  pilotHeader.appendChild(pol);
}

function buildSeasonSelect() {
  seasonSelect.innerHTML = "";
  seasonStarts.forEach((startYear, index) => {
    const option = document.createElement("option");
    option.value = String(startYear);
    option.textContent = seasonLabel(startYear);
    seasonSelect.appendChild(option);
  });
  seasonSelect.value = String(selectedSeasonStart);
}

function updateSeasonTitle() {
  rosterSubtitle.textContent = `Roster ${seasonLabel(selectedSeasonStart)}`;
}

function setRosterSeason(startYear) {
  selectedSeasonStart = startYear;
  rosterStart = seasonStartDate(startYear);
  rosterEnd = seasonEndDate(startYear);
  updateSeasonTitle();
  buildMonthSelect();
  buildTable();
  if (printItemsTab.classList.contains("active")) renderPrintItems();
  scrollToDate(dateKey(rosterStart));
}

function buildMonthSelect() {
  const seen = new Set();
  monthSelect.innerHTML = "";
  allDates().forEach((date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const option = document.createElement("option");
    option.value = dateKey(new Date(date.getFullYear(), date.getMonth(), 1));
    option.textContent = formatMonth(date);
    monthSelect.appendChild(option);
  });
}

function buildCellSelect(pilot, date, value) {
  const select = document.createElement("select");
  select.className = "cell-select";
  select.dataset.key = editKey(date, pilot);
  select.dataset.baseline = baselineValue(pilot, date);
  select.dataset.pilot = pilot.code;
  select.dataset.currentValue = value;

  const workLabel = pilot.contractor ? "Fiords" : pilot.code;
  const workValue = pilot.contractor ? "FIORDS" : pilot.code;
  const options = [
    ["", ""],
    [workValue, workLabel],
    [`FP_${pilot.code}`, `FP ${pilot.code}`],
    ...(pilot.contractor ? [["WT", "WT"]] : []),
    ...(pilot.extraOptions || []).map((option) => [option, option]),
    [`${pilot.code}_SICK`, `${pilot.code} sick`],
  ];

  options.forEach(([optionValue, label]) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    if (optionValue.startsWith("FP_") && value === optionValue) option.textContent = pilot.code;
    select.appendChild(option);
  });

  select.value = value;
  return select;
}

function buildTable() {
  const fragment = document.createDocumentFragment();

  allDates().forEach((date) => {
    fragment.appendChild(renderRosterRow(date));
  });

  rosterBody.replaceChildren(fragment);
  updateTracker();
  updateShippingSummary();
}

function renderRosterRow(date) {
  const showFullNames = false;
  const tr = document.createElement("tr");
  tr.id = `date-${dateKey(date)}`;
  tr.classList.add(weekBandClass(date));
  if (date.getDate() === 1) tr.classList.add("month-start");
  if (dateKey(date) === dateKey(today)) tr.classList.add("today-row");

  const workingPilots = pilots.filter((pilot) =>
    isPolAvailableValue(currentValue(pilot, date))
  );
  const count = document.createElement("th");
  count.className = `count-col ${heatClass(workingPilots.length)}`;
  count.scope = "row";
  count.textContent = workingPilots.length.toFixed(1);
  tr.appendChild(count);

  pilots.forEach((pilot) => {
    const value = currentValue(pilot, date);
    const baseline = baselineValue(pilot, date);
    const td = document.createElement("td");
    td.className = cellClass(value, baseline);
    td.title = `${pilot.name} - ${displayValue(value, pilot, showFullNames) || "Blank"}`;

    if (isVesselAssignedValue(pilot, date, value)) {
      const span = document.createElement("span");
      span.className = "fp-label";
      span.textContent = pilot.code;
      td.appendChild(span);
    } else {
      const select = buildCellSelect(pilot, date, value);
      select.title = displayValue(value, pilot, showFullNames) || "Blank";
      td.appendChild(select);
    }
    tr.appendChild(td);
  });

  const polCell = document.createElement("td");
  polCell.className = "pol-col";
  const polCruiseCount = Number(polCruiseCounts[dateKey(date)] || 0);
  polCell.textContent = polCruiseCount > 0 ? String(polCruiseCount) : "";
  polCell.title = `${polCruiseCount} POL cruise vessel${polCruiseCount === 1 ? "" : "s"}`;
  polCell.classList.add(polCruiseClass(polCruiseCount));
  tr.appendChild(polCell);

  const dateCell = document.createElement("td");
  dateCell.className = "date-col";
  dateCell.textContent = formatShortDate(date);
  dateCell.title = formatDate(date);
  tr.appendChild(dateCell);

  shipCellsForDate(date).forEach((items) => {
    const shipCell = document.createElement("td");
    shipCell.className = "ship-cell";
    shipCell.innerHTML = renderShipCell(items);
    tr.appendChild(shipCell);
  });

  return tr;
}

function isVesselAssignedValue(pilot, date, value) {
  return value.startsWith("FP_") && vesselAssignmentValue(pilot, date) === value;
}

function refreshRosterRows(dates) {
  const seen = new Set();
  dates.forEach((date) => {
    if (!date || date < rosterStart || date > rosterEnd) return;
    const key = dateKey(date);
    if (seen.has(key)) return;
    seen.add(key);
    const row = document.querySelector(`#date-${key}`);
    if (row) row.replaceWith(renderRosterRow(date));
  });
}

function updateCell(select) {
  const baseline = select.dataset.baseline;
  const previousValue = select.dataset.currentValue ?? baseline;
  const pilot = pilots.find((item) => item.code === select.dataset.pilot);
  const row = select.closest("tr");
  const date = toDate(row.id.replace("date-", ""));
  if (select.value === baseline) {
    delete edits[select.dataset.key];
  } else {
    edits[select.dataset.key] = select.value;
  }
  saveEdits();

  const td = select.closest("td");
  td.className = cellClass(select.value, baseline);
  td.title = `${select.dataset.pilot} - ${select.value || "Blank"}`;
  select.dataset.currentValue = select.value;
  if (select.value.startsWith("FP_")) {
    refreshRosterRows([date]);
  } else {
    updateRowCount(row);
  }
  updateTracker();

  if (pilot && previousValue !== select.value) {
    const from = displayValue(previousValue, pilot, false) || "Blank";
    const to = displayValue(select.value, pilot, false) || "Blank";
    recordEvent(
      "roster",
      "Pilot roster changed",
      `${formatShortDate(date)} - ${pilot.code}: ${from} to ${to}`
    );
  }
}

function updateVesselAllocation(select) {
  const key = select.dataset.key;
  const vesselRow = vesselRows.find((row) => vesselAllocationKey(row) === key);
  const previous = vesselPilotsForAllocationKey(key);
  const selects = [
    ...select.closest(".ship-allocations").querySelectorAll(".vessel-pilot-select"),
  ];
  const assigned = [...new Set(selects.map((item) => item.value).filter(Boolean))];
  const normalized = assigned.includes(SOUTH_PORT_ALLOCATION)
    ? [SOUTH_PORT_ALLOCATION]
    : assigned;
  if (normalized.length) vesselAllocations[key] = normalized;
  else delete vesselAllocations[key];
  saveVesselAllocations();
  const shell = document.querySelector(".table-shell");
  const left = shell.scrollLeft;
  const top = shell.scrollTop;
  if (vesselRow) {
    refreshRosterRows([
      shipRosterDate(vesselRow),
      ...jobDatesForVessel(vesselRow, rosterDateFromAllocationKey(key)),
    ]);
  } else {
    buildTable();
  }
  shell.scrollLeft = left;
  shell.scrollTop = top;
  if (vesselRow) scheduleSummaryRefresh();
  if (JSON.stringify(previous) !== JSON.stringify(normalized)) {
    const date = vesselRow ? shipRosterDate(vesselRow) : rosterDateFromAllocationKey(key);
    recordEvent(
      "vessel",
      "Vessel allocation changed",
      `${date ? formatShortDate(date) : "No date"} - ${vesselRow?.vessel || "Vessel"}: ${allocationBadgeText(previous) || "Unallocated"} to ${allocationBadgeText(normalized) || "Unallocated"}`
    );
  }
}

function scheduleSummaryRefresh() {
  requestAnimationFrame(() => {
    updateTracker();
    updateShippingSummary();
    if (printItemsTab.classList.contains("active")) renderPrintItems();
  });
}

function updateRowCount(row) {
  const date = toDate(row.id.replace("date-", ""));
  const count = pilots.filter((pilot) => isPolAvailableValue(currentValue(pilot, date))).length;
  const countCell = row.querySelector(".count-col");
  countCell.textContent = count.toFixed(1);
  removeHeatClasses(countCell);
  countCell.classList.add(heatClass(count));
}

function updateTracker() {
  const totals = Object.fromEntries(
    pilots.map((pilot) => [
      pilot.code,
      { RDO: 0, NB: 0, SB: 0, STEWART: 0, TOTAL_SHIP: 0, TOTAL: 0 },
    ])
  );

  allDates().forEach((date) => {
    pilots.forEach((pilot) => {
      const baseline = baselineValue(pilot, date);
      const value = currentValue(pilot, date);
      const wasWorking = isWorkingValue(baseline);
      const isWorking = isWorkingValue(value);

      const isSick = value.endsWith("_SICK");

      if (!isSick && !wasWorking && isWorking) totals[pilot.code].RDO += 1;
      if (!isSick && wasWorking && !isWorking) totals[pilot.code].RDO -= 1;
      if (isWorking) totals[pilot.code].TOTAL += 1;
    });
  });

  vesselRows.forEach((row) => {
    const route = vesselCategory(row);
    vesselPilotsForRow(row).forEach((pilotCode) => {
      if (!totals[pilotCode]) return;
      if (route === "North Bound") totals[pilotCode].NB += 1;
      if (route === "South Bound") totals[pilotCode].SB += 1;
      if (["North Bound", "South Bound"].includes(route)) totals[pilotCode].TOTAL_SHIP += 1;
      if (vesselHasStewart(row)) totals[pilotCode].STEWART += 1;
    });
  });

  pilots.forEach((pilot) => {
    document.querySelector(`[data-rdo="${pilot.code}"]`).textContent =
      totals[pilot.code].RDO;
    document.querySelector(`[data-total="${pilot.code}"]`).textContent =
      totals[pilot.code].TOTAL;
    specialWork.forEach((type) => {
      document.querySelector(
        `[data-track="${type}"][data-pilot="${pilot.code}"]`
      ).textContent = totals[pilot.code][type];
    });
  });
}

function weekBandClass(date) {
  const firstTuesday = toDate("2026-10-06");
  const offset = daysBetween(date, firstTuesday);
  const weekIndex = Math.floor(offset / 7);
  return Math.abs(weekIndex) % 2 === 0 ? "week-blue" : "week-orange";
}

function heatClass(count) {
  if (count >= 5) return "heat-5";
  if (count === 4) return "heat-4";
  if (count === 3) return "heat-3";
  if (count === 2) return "heat-2";
  if (count === 1) return "heat-1";
  return "heat-0";
}

function updateShippingSummary() {
  const stats = shippingAllocationStats();
  const portPercent = stats.total ? Math.round((stats.portOtago / stats.total) * 100) : 0;
  const southPercent = stats.total ? Math.round((stats.southPort / stats.total) * 100) : 0;
  const warnings = [];

  if (stats.total && portPercent > 65) warnings.push("Port Otago above 65%");
  if (stats.total && southPercent > 35) warnings.push("South Port above 35%");

  shippingSummary.innerHTML = `
    <div class="shipping-summary-title">Fiordland Shipping Schedule</div>
    <div class="shipping-summary-grid">
      <span>Total ships</span><strong>${stats.total}</strong>
      <span>Port Otago</span><strong>${stats.portOtago} <em>${portPercent}%</em></strong>
      <span>South Port</span><strong class="south-port-summary">${stats.southPort} <em>${southPercent}%</em></strong>
    </div>
    ${
      warnings.length
        ? `<div class="shipping-warning">${warnings.map(escapeHtml).join(" | ")}</div>`
        : `<div class="shipping-target">Target split: Port Otago 65% / South Port 35%</div>`
    }
  `;
}

function renderPrintItems() {
  const items = printableVesselItems();
  const stats = shippingAllocationStats();
  const portPercent = stats.total ? Math.round((stats.portOtago / stats.total) * 100) : 0;
  const southPercent = stats.total ? Math.round((stats.southPort / stats.total) * 100) : 0;
  const warnings = [];

  if (stats.total && portPercent > 65) warnings.push("Port Otago above 65%");
  if (stats.total && southPercent > 35) warnings.push("South Port above 35%");

  printItemsBody.innerHTML = items
    .map((item) => `
      <tr>
        <td>${escapeHtml(formatDate(item.date))}</td>
        <td>${escapeHtml(item.vessel)}</td>
        <td>${escapeHtml(item.fromTo || "-")}</td>
        <td class="${item.company === "South Port" ? "company-south-port" : item.company === "Port Otago" ? "company-port-otago" : "company-unassigned"}">
          ${escapeHtml(item.company || "Unallocated")}
        </td>
      </tr>
    `)
    .join("");

  printSummary.innerHTML = `
    <span>Total ships <strong>${stats.total}</strong></span>
    <span>Port Otago <strong>${stats.portOtago}</strong> <em>${portPercent}%</em></span>
    <span>South Port <strong>${stats.southPort}</strong> <em>${southPercent}%</em></span>
    ${warnings.length ? `<span class="print-warning">${warnings.map(escapeHtml).join(" | ")}</span>` : ""}
  `;
  renderPilotRecords();
}

function buildPilotRecordSelect() {
  pilotRecordSelect.innerHTML = pilots
    .map((pilot) => `<option value="${pilot.code}">${pilot.code} - ${escapeHtml(pilot.name)}</option>`)
    .join("");
}

function renderPilotRecords() {
  const pilotCode = pilotRecordSelect.value || pilots[0]?.code || "";
  const items = pilotRecordItems(pilotCode);
  const pilot = pilots.find((item) => item.code === pilotCode);

  pilotRecordsBody.innerHTML = items.length
    ? items
        .map((item) => `
          <tr>
            <td>${escapeHtml(item.vessel)}</td>
            <td>${escapeHtml(item.embark)}</td>
            <td>${escapeHtml(item.fiordlandDate)}</td>
            <td>${escapeHtml(item.disembarkPlace)}</td>
            <td>${escapeHtml(item.disembarkDate)}</td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="5" class="record-empty">No Fiordland vessel records for ${escapeHtml(pilot?.code || "this pilot")}.</td></tr>`;

  if (pilotRecordsView.classList.contains("active")) {
    printSummary.innerHTML = `
      <span>Pilot <strong>${escapeHtml(pilot?.code || "-")}</strong></span>
      <span>Vessels <strong>${items.length}</strong></span>
    `;
  }
}

function pilotRecordItems(pilotCode) {
  return vesselRows
    .filter((row) => vesselPilotsForRow(row).includes(pilotCode))
    .map((row) => {
      const rosterDate = shipRosterDate(row);
      if (!vesselClean(row.vessel) || !rosterDate || rosterDate < rosterStart || rosterDate > rosterEnd) {
        return null;
      }

      return {
        vessel: row.vessel || "Unnamed vessel",
        embark: [vesselClean(row.embark) || "-", formatRecordDate(row.embarkDate, rosterDate)].filter(Boolean).join(" - "),
        fiordlandDate: formatRecordDate(row.etaFiordland, rosterDate) || "-",
        disembarkPlace: vesselClean(row.disembark) || "-",
        disembarkDate: formatRecordDate(row.disembarkDate) || "-",
        sortDate: rosterDate,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortDate - b.sortDate || a.vessel.localeCompare(b.vessel));
}

function formatRecordDate(value, fallback = null) {
  if (!value && !fallback) return "";
  const date = dateOnly(new Date(value));
  const validDate = !Number.isNaN(date.getTime()) && date >= rosterStart && date <= rosterEnd
    ? date
    : fallback
      ? dateOnly(new Date(fallback))
      : null;
  return validDate && !Number.isNaN(validDate.getTime()) ? formatDate(validDate) : "";
}

function switchRecordView(view) {
  const showPilots = view === "pilots";
  recordTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.recordView === view);
  });
  vesselRecordsView.classList.toggle("active", !showPilots);
  pilotRecordsView.classList.toggle("active", showPilots);
  pilotRecordSelect.closest(".pilot-record-picker").classList.toggle("active", showPilots);
  if (showPilots) renderPilotRecords();
  else renderPrintItems();
}

function renderWorkbook() {
  const rows = workbookItems();
  workbookSummary.textContent = `${rows.length} workbook row${rows.length === 1 ? "" : "s"}`;
  workbookBody.innerHTML = rows.length
    ? rows
        .map((row) => `
          <tr>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.vessel)}</td>
            <td>${escapeHtml(row.company)}</td>
            <td>${escapeHtml(row.embarkPlace)}</td>
            <td>${escapeHtml(row.embarkDate)}</td>
            <td>${escapeHtml(row.milfordDate)}</td>
            <td>${escapeHtml(row.disembarkPlace)}</td>
            <td>${escapeHtml(row.disembarkDate)}</td>
            <td>${escapeHtml(row.service)}</td>
            <td>${escapeHtml(row.pilot)}</td>
            <td>${escapeHtml(row.trainee)}</td>
            <td>${escapeHtml(row.stewartIsland)}</td>
            <td>${escapeHtml(row.lecturer)}</td>
            <td>${escapeHtml(row.driver)}</td>
            <td>${escapeHtml(row.mhDays)}</td>
            <td>${escapeHtml(row.launch)}</td>
            <td>${escapeHtml(row.actions)}</td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="17" class="workbook-empty">No workbook rows available.</td></tr>`;
}

function workbookItems() {
  return vesselRows
    .map((row) => {
      const rosterDate = shipRosterDate(row);
      if (!vesselClean(row.vessel) && !rosterDate) return null;
      const pilotsForRow = vesselPilotsForRow(row).filter((code) => code !== SOUTH_PORT_ALLOCATION);
      return {
        status: vesselClean(row.status),
        vessel: vesselClean(row.vessel),
        company: vesselClean(row.company),
        embarkPlace: vesselClean(row.embark),
        embarkDate: workbookDate(row.embarkDate, rosterDate),
        milfordDate: workbookDate(row.etaFiordland, rosterDate),
        disembarkPlace: vesselClean(row.disembark),
        disembarkDate: workbookDate(row.disembarkDate),
        service: vesselClean(row.service),
        pilot: vesselClean(row.pilot) || pilotsForRow.join(", "),
        trainee: vesselClean(row.trainee),
        stewartIsland: vesselClean(row.stewartIsland),
        lecturer: vesselClean(row.lecturer),
        driver: vesselClean(row.driver),
        mhDays: vesselClean(row.mhDays),
        launch: vesselClean(row.launch),
        actions: vesselClean(row.actions),
        sortDate: rosterDate || row.etaFiordland || row.embarkDate || row.disembarkDate || new Date(8640000000000000),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortDate - b.sortDate || a.vessel.localeCompare(b.vessel));
}

function workbookDate(value, fallback = null) {
  if (!value && !fallback) return "";
  const date = new Date(value);
  const normalized = dateOnly(date);
  const validDate = !Number.isNaN(normalized.getTime()) && normalized >= rosterStart && normalized <= rosterEnd
    ? normalized
    : fallback
      ? dateOnly(new Date(fallback))
      : null;
  return validDate && !Number.isNaN(validDate.getTime()) ? formatShortDate(validDate) : "";
}

function shippingAllocationStats() {
  const stats = { total: 0, portOtago: 0, southPort: 0 };

  printableVesselItems().forEach((item) => {
    stats.total += 1;
    if (item.company === "South Port") stats.southPort += 1;
    if (item.company === "Port Otago") stats.portOtago += 1;
  });

  return stats;
}

function printableVesselItems() {
  return vesselRows
    .map((row) => {
      const rosterDate = shipRosterDate(row);
      if (!vesselClean(row.vessel) || !rosterDate || rosterDate < rosterStart || rosterDate > rosterEnd) {
        return null;
      }

      return {
        date: rosterDate,
        vessel: row.vessel || "Unnamed vessel",
        fromTo: vesselClean(row.fromTo),
        company: companyForVesselRow(row),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date || a.vessel.localeCompare(b.vessel));
}

function companyForVesselRow(row) {
  const assigned = vesselPilotsForRow(row);
  if (assigned.includes(SOUTH_PORT_ALLOCATION)) return "South Port";
  if (assigned.some(isPilotCode)) return "Port Otago";
  return "";
}

function isPilotCode(value) {
  return pilots.some((pilot) => pilot.code === value);
}

function removeHeatClasses(element) {
  element.classList.remove("heat-0", "heat-1", "heat-2", "heat-3", "heat-4", "heat-5");
}

function polCruiseClass(count) {
  if (count >= 3) return "pol-cruise-3";
  if (count === 2) return "pol-cruise-2";
  if (count === 1) return "pol-cruise-1";
  return "pol-cruise-0";
}

function vesselDate(row) {
  return row.etaFiordland ? new Date(row.etaFiordland) : null;
}

function vesselDateKey(date) {
  return date ? dateKey(date) : "";
}

function vesselMonthKey(date) {
  return date ? date.toISOString().slice(0, 7) : "";
}

function vesselClean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function vesselNorm(value) {
  return vesselClean(value).toLowerCase();
}

function vesselHasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function vesselHasStewart(row) {
  return vesselHasAny(vesselNorm(vesselPortText(row)), ["stewart", "stuart"]);
}

function vesselPortText(row) {
  return [row.embark, row.disembark, row.fromTo, row.comments, row.stewartIsland]
    .filter(Boolean)
    .join(" | ");
}

function vesselIsMilfordOnly(row) {
  const text = vesselNorm(vesselPortText(row));
  const embark = vesselNorm(row.embark);
  const disembark = vesselNorm(row.disembark);
  if (text.includes("milford only") || text.includes("milford sound only")) return true;
  if (
    row.etaFiordland &&
    !embark &&
    !disembark &&
    !vesselHasAny(text, [
      "stewart",
      "stuart",
      "bluff",
      "bench island",
      "beach island",
      "lyttelton",
      "timaru",
    ])
  ) {
    return true;
  }
  return embark.includes("milford") && disembark.includes("milford");
}

function vesselCategory(row) {
  const embark = vesselNorm(row.embark);
  const routePorts = vesselNorm([row.embark, row.disembark].filter(Boolean).join(" | "));
  if (vesselRouteStartsFromPoe(row)) return "North Bound";
  if (vesselIsMilfordOnly(row)) return "South Bound";
  if (vesselHasAny(routePorts, ["bluff", "bench island", "beach island"])) return "Bluff";
  if (
    vesselHasAny(embark, [
      "port chalmers",
      "portchalmer",
      "port chlamaers",
      "port otago",
      "dunedin",
    ])
  ) {
    return "North Bound";
  }
  if (embark.includes("milford")) return "South Bound";
  if (vesselHasAny(routePorts, ["lyttelton", "timaru"])) return "Lyttelton/Timaru";
  return "Unclassified";
}

function vesselRouteStartsFromPoe(row) {
  return /^poe\s*\//i.test(vesselClean(row.fromTo));
}

function vesselRouteClass(route) {
  if (route === "North Bound") return "route-north";
  if (route === "South Bound") return "route-south";
  if (route === "Bluff") return "route-bluff";
  if (route === "Lyttelton/Timaru") return "route-lyttelton";
  return "route-unclassified";
}

function vesselDisplayDate(date) {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function vesselDisplayPort(value) {
  const text = vesselClean(value);
  const normalized = vesselNorm(text);
  if (!text) return "";
  if (
    vesselHasAny(normalized, [
      "port chalmers",
      "portchalmer",
      "port chlamaers",
      "port otago",
      "dunedin",
    ])
  ) {
    return "PC";
  }
  if (normalized.includes("milford")) return "MLF";
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shipCellsForDate(date) {
  const key = dateKey(date);
  const buckets = {
    "North Bound": [],
    "South Bound": [],
    Unspecified: [],
    Comments: [],
  };

  vesselRowsForDate(key).forEach((row) => {
    const route = vesselCategory(row);
    const item = compactShipItem(row);
    if (route === "North Bound") buckets["North Bound"].push(item);
    else if (route === "South Bound") buckets["South Bound"].push(item);
    else buckets.Unspecified.push(item);

    const notes = movementNotes(row);
    if (notes) {
      buckets.Comments.push({
        name: row.vessel || "Unnamed vessel",
        detail: notes,
        stewart: false,
        comment: true,
        allocatable: false,
      });
    }
  });

  return [
    buckets["North Bound"],
    buckets["South Bound"],
    buckets.Unspecified,
    buckets.Comments,
  ];
}

function vesselRowsForDate(key) {
  return vesselRows.filter((row) => vesselDateKey(shipRosterDate(row)) === key);
}

function shipRosterDate(row) {
  const route = vesselCategory(row);
  const embark = adjustedEmbarkDate(row);
  if (route === "North Bound" && row.embarkDate) return dateOnly(new Date(row.embarkDate));
  if (route === "Lyttelton/Timaru" && embark) return embark;
  if (route === "Bluff" && embark) return embark;
  return vesselDate(row);
}

function compactShipItem(row) {
  const disembark = row.disembarkDate ? new Date(row.disembarkDate) : null;
  const disembarkDay = disembark && !Number.isNaN(disembark.getTime())
    ? ordinalDay(disembark.getUTCDate())
    : "";
  const stewart = vesselHasStewart(row)
    ? "Stewart Island"
    : "";
  const commentMark = row.comments ? "*" : "";
  const timeRange = vesselTimeRange(row);
  const milfordOnly = vesselIsMilfordOnly(row) ? "Milford Only" : "";
  const detail = [stewart, milfordOnly, disembarkDay, timeRange, row.fromTo, commentMark]
    .filter(Boolean)
    .join(" - ");
  return {
    key: vesselAllocationKey(row),
    name: row.vessel || "Unnamed vessel",
    detail,
    portMarker: lytteltonTimaruMarker(row),
    stewart: Boolean(stewart),
    milfordOnly: Boolean(milfordOnly),
    comment: Boolean(row.comments),
  };
}

function lytteltonTimaruMarker(row) {
  const embarkPort = portCodeForLytteltonTimaru(row.embark);
  if (embarkPort) return `Embark - ${embarkPort}`;

  const disembarkPort = portCodeForLytteltonTimaru(row.disembark);
  if (disembarkPort) return `Disembark - ${disembarkPort}`;

  return "";
}

function portCodeForLytteltonTimaru(value) {
  const normalized = vesselNorm(value);
  if (normalized.includes("lyttelton")) return "LYT";
  if (normalized.includes("timaru")) return "TIM";
  return "";
}

function vesselAllocationKey(row) {
  const base = row.sourceRow ?? `${row.vessel}-${row.etaFiordland}`;
  const rosterKey = vesselDateKey(shipRosterDate(row)) || "no-date";
  return `${base}:${rosterKey}`;
}

function vesselAssignmentValue(pilot, date) {
  const key = dateKey(date);
  const match = vesselRows.find((row) => {
    const allocationKey = vesselAllocationKey(row);
    if (!vesselPilotsForAllocationKey(allocationKey).includes(pilot.code)) return false;
    return jobDatesForVessel(row, rosterDateFromAllocationKey(allocationKey)).some(
      (jobDate) => dateKey(jobDate) === key
    );
  });
  return match ? `FP_${pilot.code}` : "";
}

function vesselPilotsForRow(row) {
  return vesselPilotsForAllocationKey(vesselAllocationKey(row));
}

function vesselPilotsForAllocationKey(key) {
  const value = vesselAllocations[key];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function rosterDateFromAllocationKey(key) {
  const match = String(key).match(/:(\d{4}-\d{2}-\d{2})$/);
  return match ? toDate(match[1]) : null;
}

function jobDatesForVessel(row, allocationRosterDate = null) {
  const route = vesselCategory(row);
  const eta = vesselDate(row);
  const embark = adjustedEmbarkDate(row);
  const stewart = vesselHasStewart(row);

  if (route === "South Bound" && eta) {
    return consecutiveDates(addDays(dateOnly(eta), -1), stewart ? 4 : 3);
  }

  if (route === "North Bound") {
    const start = allocationRosterDate || (row.embarkDate ? dateOnly(new Date(row.embarkDate)) : null);
    if (start) return consecutiveDates(dateOnly(start), stewart ? 4 : 3);
  }

  if (embark) return consecutiveDates(dateOnly(embark), 3);
  if (eta) return [dateOnly(eta)];
  return [];
}

function consecutiveDates(start, count) {
  const dates = [];
  for (let i = 0; i < count; i++) {
    const d = addDays(start, i);
    if (d >= rosterStart && d <= rosterEnd) dates.push(new Date(d));
  }
  return dates;
}

function adjustedEmbarkDate(row) {
  if (!row.embarkDate) return null;
  const embark = dateOnly(new Date(row.embarkDate));
  return isEveningEmbark(row) ? addDays(embark, 1) : embark;
}

function isEveningEmbark(row) {
  const value =
    row.embarkTime ??
    row.embark_time ??
    row.embarkTimeValue ??
    row.embarkDateTime ??
    "";
  const minutes = timeToMinutes(value);
  return minutes !== null && minutes >= 18 * 60;
}

function timeToMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 24 * 60);
  }
  const text = vesselClean(value);
  const date = new Date(text);
  if (!Number.isNaN(date.getTime()) && text.includes("T")) {
    return date.getHours() * 60 + date.getMinutes();
  }
  const match = text.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function vesselTimeRange(row) {
  const start = compactTime(row.etaTime);
  const end = compactTime(row.etdTime);
  if (start && end) return `${start}-${end}`;
  return start || end;
}

function compactTime(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.round(value * 24 * 60);
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const text = vesselClean(value);
  const match = text.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return text;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function movementNotes(row) {
  return [row.status, row.movement, row.fromTo, row.comments]
    .map(vesselClean)
    .filter(Boolean)
    .join(" | ");
}

function renderShipCell(items) {
  return items
    .map((item, index) => {
      const assigned = vesselPilotsForAllocationKey(item.key);
      return `
        <div class="ship-pill-inline ship-variant-${index % 4} ${assigned.length ? "has-pilot" : ""} ${assigned.includes(SOUTH_PORT_ALLOCATION) ? "south-port-ship" : ""}">
          <div class="ship-line">
            <span class="ship-name-inline">${escapeHtml(item.name)}</span>
            <span class="ship-pilot-badge ${assigned.includes(SOUTH_PORT_ALLOCATION) ? "south-port-badge" : ""}">${escapeHtml(allocationBadgeText(assigned))}</span>
          </div>
          ${
            item.detail
              ? `<span class="ship-detail-inline">${renderShipDetail(item)}</span>`
              : ""
          }
          ${
            item.portMarker
              ? `<span class="port-marker-inline">${escapeHtml(item.portMarker)}</span>`
              : ""
          }
          ${item.allocatable === false ? "" : renderPilotAllocationControls(item.key, assigned)}
        </div>
      `;
    })
    .join("");
}

function renderPilotAllocationControls(key, assigned) {
  const values = assigned.length ? assigned : [""];
  return `
    <div class="ship-allocations">
      ${values.map((value) => renderPilotSelect(key, value)).join("")}
      <button class="add-pilot-button" type="button" data-key="${escapeHtml(key)}" aria-label="Add pilot">+</button>
    </div>
  `;
}

function renderPilotSelect(key, value) {
  return `
    <select class="vessel-pilot-select ${value === SOUTH_PORT_ALLOCATION ? "south-port-select" : ""}" data-key="${escapeHtml(key)}" aria-label="Allocate pilot">
      <option value=""></option>
      <option class="south-port-option" value="${SOUTH_PORT_ALLOCATION}" ${value === SOUTH_PORT_ALLOCATION ? "selected" : ""}>South Port</option>
      ${pilots.map((pilot) => `<option value="${pilot.code}" ${value === pilot.code ? "selected" : ""}>${pilot.code}</option>`).join("")}
    </select>
  `;
}

function allocationBadgeText(assigned) {
  if (assigned.includes(SOUTH_PORT_ALLOCATION)) return "South Port";
  return assigned.join(", ");
}

function addPilotAllocation(button) {
  button.insertAdjacentHTML("beforebegin", renderPilotSelect(button.dataset.key, ""));
}

function renderShipDetail(item) {
  return item.detail
    .split(" - ")
    .map((part) => {
      const cls =
        part === "Stewart Island"
          ? "stewart-inline"
          : part === "Milford Only"
            ? "milford-only-inline"
            : "";
      return `<span class="${cls}">${escapeHtml(part)}</span>`;
    })
    .join(" - ");
}

function ordinalDay(day) {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function scrollToDate(key) {
  const row = document.querySelector(`#date-${key}`);
  if (row) row.scrollIntoView({ block: "start", behavior: "smooth" });
}

function switchTab(tabName) {
  if (tabName === "roster" || tabName === "printItems" || tabName === "workbook") refreshVesselRowsFromAgent();
  if (tabName === "printItems") renderPrintItems();
  if (tabName === "workbook") renderWorkbook();
  if (tabName === "events") refreshEventLog();
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  rosterTab.classList.toggle("active", tabName === "roster");
  agentTab.classList.toggle("active", tabName === "agent");
  polCruiseTab.classList.toggle("active", tabName === "polCruise");
  printItemsTab.classList.toggle("active", tabName === "printItems");
  workbookTab.classList.toggle("active", tabName === "workbook");
  eventsTab.classList.toggle("active", tabName === "events");
}

seasonSelect.addEventListener("change", () => {
  setRosterSeason(Number(seasonSelect.value));
});
monthSelect.addEventListener("change", () => {
  scrollToDate(monthSelect.value);
});
printItemsButton.addEventListener("click", () => window.print());
recordTabs.forEach((button) => {
  button.addEventListener("click", () => switchRecordView(button.dataset.recordView));
});
pilotRecordSelect.addEventListener("change", renderPilotRecords);
eventRefreshButton.addEventListener("click", () => refreshEventLog());
eventClearButton.addEventListener("click", () => clearAllEvents());
eventItemsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".event-delete-button");
  if (button) clearEventRecord(button.dataset.eventId);
});
tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});
window.addEventListener("storage", (event) => {
  if (event.key === AGENT_FILE_STORAGE_KEY) refreshVesselRowsFromAgent();
  if (event.key === POL_CRUISE_COUNTS_KEY) refreshPolCruiseCounts();
});
window.addEventListener("message", (event) => {
  if (event.origin === window.location.origin && event.data?.type === "pol-cruise-counts-updated") {
    refreshPolCruiseCounts();
    refreshSharedState();
  }
  if (event.origin === window.location.origin && event.data?.type === "agent-file-rows-updated") {
    refreshVesselRowsFromAgent();
    refreshSharedState();
  }
  if (event.origin === window.location.origin && event.data?.type === "otago-event-log-updated") {
    refreshEventLog();
  }
});
window.addEventListener("focus", () => {
  refreshVesselRowsFromAgent();
  refreshPolCruiseCounts();
  refreshSharedState();
  refreshEventLog();
});
setInterval(refreshVesselRowsFromAgent, 1500);
setInterval(refreshPolCruiseCounts, 1500);
setInterval(refreshSharedState, 5000);
setInterval(refreshEventLog, 5000);
window.addEventListener("otago-event-log-updated", () => refreshEventLog());
rosterBody.addEventListener("change", (event) => {
  if (event.target.matches(".cell-select")) updateCell(event.target);
  if (event.target.matches(".vessel-pilot-select")) updateVesselAllocation(event.target);
});
rosterBody.addEventListener("click", (event) => {
  if (event.target.matches(".add-pilot-button")) addPilotAllocation(event.target);
});

buildHeader();
buildPilotRecordSelect();
buildSeasonSelect();
updateSeasonTitle();
buildMonthSelect();
buildTable();
refreshSharedState();
refreshEventLog({ seedIfMissing: true });
