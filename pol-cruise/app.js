const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const DISPLAY_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DISPLAY_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const INITIAL_SEASONS = [2026, 2027, 2028, 2029, 2030];
const NON_CRUISE_SHIPS = new Set(["fortunui", "hapinui", "pacinui"]);
const CRUISE_COUNTS_STORAGE_KEY = "pol-cruise-counts-v1";
const CRUISE_RECORDS_STORAGE_KEY = "pol-cruise-records-v1";
const KNOWN_CRUISE_SHIPS = [
  "Anthem of the Seas",
  "Asuka II",
  "Azamara Pursuit",
  "Carnival Splendor",
  "Celebrity Edge",
  "Celebrity Solstice",
  "Coral Adventurer",
  "Coral Princess",
  "Crystal Serenity",
  "Grand Princess",
  "Greg Mortimer",
  "Hanseatic Spirit",
  "Heritage Adventurer",
  "Le Soleal",
  "MSC Magnifica",
  "Noordam",
  "Norwegian Spirit",
  "Riviera",
  "Royal Princess",
  "Seabourn Quest",
  "Seven Seas Explorer",
  "SH Minerva",
  "Silver Moon",
  "Viking Orion",
  "Viking Venus",
];

const state = {
  records: loadSavedRecords(),
  selectedSeason: 2026,
  pdfjs: null,
};
let sharedCruiseInitialized = false;
let sharedCruiseRefreshInFlight = false;

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  statusText: document.querySelector("#statusText"),
  recordCount: document.querySelector("#recordCount"),
  ocrProgress: document.querySelector("#ocrProgress"),
  seasonTabs: document.querySelector("#seasonTabs"),
  seasonTotal: document.querySelector("#seasonTotal"),
  busiestDay: document.querySelector("#busiestDay"),
  daysWithShips: document.querySelector("#daysWithShips"),
  calendarBody: document.querySelector("#calendarBody"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  clearBtn: document.querySelector("#clearBtn"),
};

function setStatus(message, progress = null) {
  els.statusText.textContent = message;
  if (progress !== null) {
    els.ocrProgress.value = Math.max(0, Math.min(100, progress));
  }
}

function logPolEvent(title, details) {
  window.OtagoSharedStore?.logEvent?.({
    type: "pol",
    title,
    details,
  }).then(() => {
    window.parent?.postMessage({ type: "otago-event-log-updated" }, window.location.origin);
  }).catch((error) => {
    console.warn("Could not record POL cruise event", error);
  });
}

function reviveCruiseRecord(record) {
  return {
    ...record,
    date: record.date ? new Date(record.date) : makeDate(Number(record.key?.slice(0, 4)) || 2026, 0, 1),
  };
}

function serializeCruiseRecords(records) {
  return JSON.parse(JSON.stringify(records || []));
}

function loadSavedRecords() {
  try {
    const saved = localStorage.getItem(CRUISE_RECORDS_STORAGE_KEY);
    return saved ? JSON.parse(saved).map(reviveCruiseRecord) : [];
  } catch {
    return [];
  }
}

function saveCruiseRecords() {
  const payload = serializeCruiseRecords(state.records);
  localStorage.setItem(CRUISE_RECORDS_STORAGE_KEY, JSON.stringify(payload));

  if (sharedCruiseInitialized) {
    window.OtagoSharedStore?.save(CRUISE_RECORDS_STORAGE_KEY, payload).catch((error) => {
      console.warn("Could not save cruise records to Supabase", error);
    });
  }
}

function cruiseRecordsChanged(a, b) {
  return JSON.stringify(serializeCruiseRecords(a)) !== JSON.stringify(serializeCruiseRecords(b));
}

async function refreshSharedCruiseRecords({ seedIfMissing = false } = {}) {
  if (sharedCruiseRefreshInFlight || !window.OtagoSharedStore?.isReady) return;
  sharedCruiseRefreshInFlight = true;

  try {
    const remote = await window.OtagoSharedStore.load(CRUISE_RECORDS_STORAGE_KEY);
    if (!remote.found) {
      if (seedIfMissing) await window.OtagoSharedStore.save(CRUISE_RECORDS_STORAGE_KEY, serializeCruiseRecords(state.records));
      sharedCruiseInitialized = true;
      saveCruiseCounts();
      return;
    }

    const nextRecords = (remote.data || []).map(reviveCruiseRecord);
    sharedCruiseInitialized = true;

    if (cruiseRecordsChanged(state.records, nextRecords)) {
      state.records = nextRecords;
      localStorage.setItem(CRUISE_RECORDS_STORAGE_KEY, JSON.stringify(serializeCruiseRecords(state.records)));
      setStatus("Loaded shared POL cruise ship count.", 100);
      render();
    }
  } catch (error) {
    console.warn("Could not load shared cruise records", error);
  } finally {
    sharedCruiseRefreshInFlight = false;
  }
}

function updateRecordCount() {
  const rowWord = state.records.length === 1 ? "row" : "rows";
  els.recordCount.textContent = `${state.records.length} cruise movement ${rowWord} found`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayTime(value) {
  return value || "-";
}

function movementLabel(record) {
  const movement = record.movement || "Movement";
  const shortMovement = {
    Arrival: "Arr",
    Departure: "Dep",
    Shift: "Shift",
  }[movement] ?? movement;
  return shortMovement;
}

function makeLineList(items, className = "line-list", highlighted = false) {
  const list = document.createElement("div");
  list.className = className;
  items.forEach((item, index) => {
    const line = document.createElement("div");
    line.className = highlighted ? `line-highlight tone-${(index % 4) + 1}` : "";
    line.textContent = item;
    list.append(line);
  });
  return list;
}

function makeDate(year, month, day) {
  return new Date(year, month, day, 12, 0, 0);
}

function formatDate(date) {
  return `${DISPLAY_DAYS[date.getDay()]} ${date.getDate()} ${DISPLAY_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function seasonForDate(date) {
  return date.getMonth() >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

function seasonLabel(startYear) {
  return `${startYear}/${startYear + 1}`;
}

function getSeasonDates(startYear) {
  const dates = [];
  const current = makeDate(startYear, 9, 1);
  const end = makeDate(startYear + 1, 3, 30);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function normalizeShipName(value) {
  return value
    .replace(/\b(arrival|departure|shift|cruise|fish|cargo)\b/gi, " ")
    .replace(/\b(be|psa|ct|tu|oj|xy|tba|le)\b$/i, " ")
    .replace(/[|_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOcrText(rawText) {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/[|_]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/\b0ct\b/gi, "Oct")
    .replace(/\b0et\b/gi, "Oct")
    .replace(/\bOet\b/gi, "Oct")
    .replace(/\bOcl\b/gi, "Oct")
    .replace(/\b0ctober\b/gi, "October")
    .replace(/\bCRU1SE\b/gi, "CRUISE")
    .replace(/\bCRUlSE\b/gi, "CRUISE")
    .replace(/\bCRUI5E\b/gi, "CRUISE")
    .replace(/\bAmval\b/gi, "Arrival")
    .replace(/\bArival\b/gi, "Arrival")
    .replace(/\bDepartura\b/gi, "Departure")
    .replace(/\bDeparlure\b/gi, "Departure")
    .replace(/\bShilt\b/gi, "Shift")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function getKnownShipFromLine(line) {
  const compactLine = line.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return KNOWN_CRUISE_SHIPS.find((ship) => compactLine.includes(ship.toLowerCase().replace(/[^a-z0-9]+/g, ""))) ?? "";
}

function extractShipFromRow(afterDate) {
  const afterTime = afterDate.replace(/^\d{1,2}[:.]\d{2}\s+/, "");
  const knownShip = getKnownShipFromLine(afterTime);

  if (knownShip) {
    return knownShip;
  }

  const beforeMarkers = afterTime.split(/\b(?:CRUISE|FISH|Arrival|Departure|Shift)\b/i)[0];
  return normalizeShipName(beforeMarkers);
}

function isCruiseRow(row, ship, cargo = "") {
  const normalizedShip = ship.toLowerCase();

  if (!ship || NON_CRUISE_SHIPS.has(normalizedShip) || /\bFISH\b/i.test(row) || cargo.toUpperCase() === "FISH") {
    return false;
  }

  if (cargo.toUpperCase() === "CRUISE" || /\bCRUISE\b/i.test(row) || getKnownShipFromLine(row)) {
    return true;
  }

  return false;
}

function parseDateParts(day, monthText, yearText) {
  const month = MONTHS[monthText.toLowerCase()];
  if (month === undefined) {
    return null;
  }

  return makeDate(Number(yearText), month, Number(day));
}

function parsePortOtagoLine(line) {
  const rowMatch = line.match(
    /^(?:(CRUISE|FISH|CARGO|TANKER|BULK|CONTAINER|LOGS?|[-?])\s+)?(\d{1,2}[:.]\d{2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(.+?)\s+(Arrival|Departure|Shift)\b/i,
  );

  if (!rowMatch) {
    return null;
  }

  const [, cargoValue = "", time, , day, monthText, yearText, rawShip, movement] = rowMatch;
  const date = parseDateParts(day, monthText, yearText);
  const ship = normalizeShipName(rawShip);

  if (!date || !isCruiseRow(line, ship, cargoValue)) {
    return null;
  }

  return {
    date,
    key: dateKey(date),
    ship,
    time: time.replace(".", ":").padStart(5, "0"),
    movement,
    cargo: cargoValue.toUpperCase() === "CRUISE" ? "CRUISE" : "",
    sourceText: line,
  };
}

function parsePortOtagoMatches(text) {
  const records = [];
  const rowPattern =
    /(?:^|\s)(?:(CRUISE|FISH|CARGO|TANKER|BULK|CONTAINER|LOGS?|[-?])\s+)?(\d{1,2}[:.]\d{2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+([A-Za-z0-9 .'-]+?)\s+(Arrival|Departure|Shift)\b/gi;

  for (const match of text.matchAll(rowPattern)) {
    const [, cargoValue = "", time, , day, monthText, yearText, rawShip, movement] = match;
    const date = parseDateParts(day, monthText, yearText);
    const ship = normalizeShipName(rawShip);
    const sourceText = match[0].trim();

    if (!date || !isCruiseRow(sourceText, ship, cargoValue)) {
      continue;
    }

    records.push({
      date,
      key: dateKey(date),
      ship,
      time: time.replace(".", ":").padStart(5, "0"),
      movement,
      cargo: cargoValue.toUpperCase() === "CRUISE" ? "CRUISE" : "",
      sourceText,
    });
  }

  return records;
}

function parseDateFirstChunk(chunk) {
  const dateMatch = chunk.match(/^(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\b/i);
  if (!dateMatch) {
    return null;
  }

  const [, , day, monthText, yearText] = dateMatch;
  const date = parseDateParts(day, monthText, yearText);
  if (!date) {
    return null;
  }

  const afterDate = chunk.slice(dateMatch[0].length).trim();
  const timeMatch = afterDate.match(/^(\d{1,2}[:.]\d{2})\s+/);
  const movementMatch = chunk.match(/\b(Arrival|Departure|Shift)\b/i);
  const ship = extractShipFromRow(afterDate);

  if (ship.length < 2 || !isCruiseRow(chunk, ship)) {
    return null;
  }

  return {
    date,
    key: dateKey(date),
    ship,
    time: timeMatch ? timeMatch[1].replace(".", ":").padStart(5, "0") : "",
    movement: movementMatch ? movementMatch[1] : "",
    cargo: /\bCRUISE\b/i.test(chunk) ? "CRUISE" : "",
    sourceText: chunk,
  };
}

function parseScheduleText(rawText) {
  const text = normalizeOcrText(rawText);
  let records = parsePortOtagoMatches(text);
  if (records.length > 0) {
    return records;
  }

  records = [];
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const record = parsePortOtagoLine(line);
    if (record) {
      records.push(record);
    }
  });

  if (records.length > 0) {
    return records;
  }

  const datePattern = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi;
  const matches = [...text.matchAll(datePattern)];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, end).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    const record = parseDateFirstChunk(chunk);
    if (record) {
      records.push(record);
    }
  }

  return records;
}

function mergeRecords(newRecords) {
  const seen = new Set(state.records.map((record) => `${record.key}|${record.ship.toLowerCase()}|${record.time}|${record.movement}`));
  let added = 0;

  newRecords.forEach((record) => {
    const uniqueKey = `${record.key}|${record.ship.toLowerCase()}|${record.time}|${record.movement}`;
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      state.records.push(record);
      added += 1;
    }
  });

  state.records.sort((a, b) => a.date - b.date || displayTime(a.time).localeCompare(displayTime(b.time)) || a.ship.localeCompare(b.ship));
  return added;
}

function recordsByDateForSeason(startYear) {
  const map = new Map();

  state.records.forEach((record) => {
    if (seasonForDate(record.date) !== startYear) {
      return;
    }

    if (!map.has(record.key)) {
      map.set(record.key, []);
    }
    map.get(record.key).push(record);
  });

  return map;
}

function recordsByDate() {
  const map = new Map();

  state.records.forEach((record) => {
    if (!map.has(record.key)) {
      map.set(record.key, []);
    }
    map.get(record.key).push(record);
  });

  return map;
}

function groupedVesselsForDate(records) {
  const vesselMap = new Map();

  records.forEach((record) => {
    const vesselKey = record.ship.toLowerCase();
    if (!vesselMap.has(vesselKey)) {
      vesselMap.set(vesselKey, {
        vessel: record.ship,
        movements: [],
      });
    }
    vesselMap.get(vesselKey).movements.push(record);
  });

  return [...vesselMap.values()]
    .map((entry) => ({
      ...entry,
      movements: entry.movements.sort((a, b) => displayTime(a.time).localeCompare(displayTime(b.time))),
    }))
    .sort((a, b) => displayTime(a.movements[0]?.time).localeCompare(displayTime(b.movements[0]?.time)) || a.vessel.localeCompare(b.vessel));
}

function renderTabs() {
  const parsedSeasons = new Set(state.records.map((record) => seasonForDate(record.date)));
  const seasons = [...new Set([...INITIAL_SEASONS, ...parsedSeasons])].sort((a, b) => a - b);

  if (!seasons.includes(state.selectedSeason)) {
    state.selectedSeason = seasons[0] ?? 2026;
  }

  els.seasonTabs.innerHTML = "";
  seasons.forEach((season) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "season-tab";
    button.textContent = seasonLabel(season);
    button.setAttribute("aria-selected", String(season === state.selectedSeason));
    button.addEventListener("click", () => {
      state.selectedSeason = season;
      render();
    });
    els.seasonTabs.append(button);
  });
}

function renderCalendar() {
  const byDate = recordsByDateForSeason(state.selectedSeason);
  const dates = getSeasonDates(state.selectedSeason);
  const fragment = document.createDocumentFragment();
  let total = 0;
  let shipDays = 0;
  let busiestCount = 0;
  let busiestDate = null;

  dates.forEach((date) => {
    const dayRecords = byDate.get(dateKey(date)) ?? [];
    const vessels = groupedVesselsForDate(dayRecords);
    const count = vessels.length;
    total += count;

    if (count > 0) {
      shipDays += 1;
    }

    if (count > busiestCount) {
      busiestCount = count;
      busiestDate = date;
    }

    const row = document.createElement("tr");
    if (count > 0) {
      row.className = "has-ships";
    }

    const timeCell = document.createElement("td");
    timeCell.className = "time-cell";
    if (vessels.length) {
      timeCell.append(
        makeLineList(
          vessels.map((entry) => entry.movements.map((record) => displayTime(record.time)).join(" / ")),
          "time-list",
          vessels.length > 1,
        ),
      );
    } else {
      timeCell.textContent = "-";
    }

    const dateCell = document.createElement("td");
    dateCell.className = "date-cell";
    dateCell.textContent = formatDate(date);

    const shipCell = document.createElement("td");
    if (vessels.length) {
      const list = document.createElement("div");
      list.className = "ship-list";
      vessels.forEach((entry, index) => {
        const chip = document.createElement("span");
        chip.className = `ship-chip${vessels.length > 1 ? ` line-highlight tone-${(index % 4) + 1}` : ""}`;
        const vesselName = document.createElement("span");
        vesselName.className = "vessel-name";
        vesselName.textContent = entry.vessel;
        const movementText = document.createElement("span");
        movementText.className = "movement-note";
        movementText.textContent = ` (${entry.movements.map(movementLabel).join("/")})`;
        chip.append(vesselName, movementText);
        list.append(chip);
      });
      shipCell.append(list);
    } else {
      const empty = document.createElement("span");
      empty.className = "empty-note";
      empty.textContent = "No cruise cargo";
      shipCell.append(empty);
    }

    const countCell = document.createElement("td");
    countCell.className = "count-cell";
    countCell.textContent = String(count);

    row.append(timeCell, dateCell, shipCell, countCell);
    fragment.append(row);
  });

  els.calendarBody.replaceChildren(fragment);
  els.seasonTotal.textContent = String(total);
  els.busiestDay.textContent = busiestDate ? `${formatDate(busiestDate)} (${busiestCount})` : "-";
  els.daysWithShips.textContent = String(shipDays);
}

function saveCruiseCounts() {
  const counts = {};

  recordsByDate().forEach((records, key) => {
    counts[key] = groupedVesselsForDate(records).length;
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    counts,
  };

  try {
    localStorage.setItem(CRUISE_COUNTS_STORAGE_KEY, JSON.stringify(payload));
    if (sharedCruiseInitialized) {
      window.OtagoSharedStore?.save(CRUISE_COUNTS_STORAGE_KEY, payload).catch((error) => {
        console.warn("Could not save cruise counts to Supabase", error);
      });
    }
    window.parent?.postMessage({ type: "pol-cruise-counts-updated" }, window.location.origin);
  } catch (error) {
    console.warn("Could not save cruise counts", error);
  }
}

function render() {
  renderTabs();
  renderCalendar();
  updateRecordCount();
  saveCruiseRecords();
  saveCruiseCounts();
}

async function getPdfJs() {
  if (!state.pdfjs) {
    state.pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
    state.pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  }

  return state.pdfjs;
}

async function recognizeImage(imageLike, label, progressStart, progressShare) {
  const result = await Tesseract.recognize(
    imageLike,
    "eng",
    {
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789: .-/",
      logger: (event) => {
        if (event.status === "recognizing text") {
          setStatus(`Reading ${label}... ${Math.round(event.progress * 100)}%`, progressStart + event.progress * progressShare);
        }
      },
    },
  );

  return result.data.text;
}

async function imageFileToOcrCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(2, Math.min(4, Math.ceil(1800 / bitmap.width)));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const value = gray > 210 ? 255 : gray < 150 ? 0 : gray;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function extractTextFromPdf(file, fileIndex, fileCount) {
  const pdfjs = await getPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";
  let textLayerText = "";
  let rawOrderText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const rows = new Map();
    rawOrderText += `\n${textContent.items.map((item) => item.str).join(" ")}`;

    textContent.items.forEach((item) => {
      const y = Math.round(item.transform[5] / 3) * 3;
      const x = item.transform[4];
      if (!rows.has(y)) {
        rows.set(y, []);
      }
      rows.get(y).push({ x, value: item.str });
    });

    const pageText = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((item) => item.value)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n");

    textLayerText += `\n${pageText}`;
    setStatus(`Reading text from ${file.name} page ${pageNumber}...`, ((fileIndex + pageNumber / pdf.numPages) / fileCount) * 100);
  }

  const combinedTextLayer = `${textLayerText}\n${rawOrderText}`;
  if (parseScheduleText(combinedTextLayer).length > 0) {
    return combinedTextLayer;
  }

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    const baseProgress = ((fileIndex + (pageNumber - 1) / pdf.numPages) / fileCount) * 100;
    const share = 100 / fileCount / pdf.numPages;
    text += `\n${await recognizeImage(canvas, `${file.name} page ${pageNumber}`, baseProgress, share)}`;
  }

  return text;
}

async function extractTextFromFile(file, index, total) {
  if (/pdf$/i.test(file.name) || file.type === "application/pdf") {
    return extractTextFromPdf(file, index, total);
  }

  const canvas = await imageFileToOcrCanvas(file);
  return recognizeImage(canvas, file.name, (index / total) * 100, 100 / total);
}

async function handleFiles(files) {
  const accepted = [...files].filter((file) => /\.(jpe?g|png|pdf)$/i.test(file.name) || /image|pdf/.test(file.type));

  if (!accepted.length) {
    setStatus("Please upload PDF, JPG, JPEG, or PNG files.", 0);
    return;
  }

  setStatus(`Reading ${accepted.length} file${accepted.length === 1 ? "" : "s"}...`, 0);
  let combinedText = "";

  try {
    for (let index = 0; index < accepted.length; index += 1) {
      combinedText += `\n${await extractTextFromFile(accepted[index], index, accepted.length)}`;
    }

    const parsed = parseScheduleText(combinedText);
    const added = mergeRecords(parsed);
    logPolEvent(
      "POL cruise document uploaded",
      `${accepted.map((file) => file.name).join(", ")} - added ${added} cruise movement row${added === 1 ? "" : "s"}`
    );
    setStatus(`Finished. Added ${added} cruise movement row${added === 1 ? "" : "s"}.`, 100);
    render();
  } catch (error) {
    console.error(error);
    setStatus("Could not read that file. Try pasting the extracted text into the box.", 0);
  }
}

function exportCsv() {
  const byDate = recordsByDateForSeason(state.selectedSeason);
  const rows = [["Time", "Date", "Vessel Name & Movement", "No. of Cruise Vessels"]];

  getSeasonDates(state.selectedSeason).forEach((date) => {
    const dayRecords = byDate.get(dateKey(date)) ?? [];
    const vessels = groupedVesselsForDate(dayRecords);
    rows.push([
      vessels.length ? vessels.map((entry) => entry.movements.map((record) => displayTime(record.time)).join("/")).join("; ") : "",
      formatDate(date),
      vessels.length ? vessels.map((entry) => `${entry.vessel}: ${entry.movements.map(movementLabel).join(", ")}`).join("; ") : "",
      String(vessels.length),
    ]);
  });

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cruise-calendar-${seasonLabel(state.selectedSeason).replace("/", "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearAll() {
  const previousCount = state.records.length;
  state.records = [];
  els.fileInput.value = "";
  setStatus("Ready for upload.", 0);
  logPolEvent("POL cruise records cleared", `${previousCount} cruise movement row${previousCount === 1 ? "" : "s"} removed`);
  render();
}

els.fileInput.addEventListener("change", (event) => handleFiles(event.target.files));
els.exportCsvBtn?.addEventListener("click", exportCsv);
els.clearBtn.addEventListener("click", clearAll);

["dragenter", "dragover"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragover");
  });
});

els.dropZone.addEventListener("drop", (event) => handleFiles(event.dataTransfer.files));

render();
refreshSharedCruiseRecords({ seedIfMissing: true });
setInterval(refreshSharedCruiseRecords, 5000);
window.addEventListener("focus", () => refreshSharedCruiseRecords());

window.cruiseCalendarDebug = {
  parseScheduleText,
  recordsByDateForSeason,
};
