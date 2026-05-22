const ports = [
  "Auckland",
  "Awanui",
  "Bluff",
  "Coromandel",
  "Foxton",
  "Gisborne",
  "Greymouth",
  "Herekino",
  "Hokianga",
  "Hokitika",
  "Kaikoura",
  "Kaipara",
  "Kawhia",
  "Lyttelton",
  "Mangonui",
  "Napier",
  "Nelson",
  "Oamaru",
  "Onehunga",
  "Opotiki",
  "Parengarenga",
  "Patea",
  "Picton",
  "Port Chalmers",
  "Port Taranaki",
  "Raglan",
  "Russell",
  "Tauranga",
  "Thames",
  "Timaru",
  "Tokomaru Bay",
  "Waitangi",
  "Wellington",
  "Westport",
  "Whakatane",
  "Whanganui",
  "Whangape",
  "Whangarei",
  "Whangaroa",
];

const seededRows = {
  Auckland: [0, 177, 950, 35, 625, 298, 707, 288, 317, 728, 596, 404, 466, 675, 161, 372, 633, 788, 427, 179, 191, 570, 583, 831, 509, 453, 129, 144, 41, 756, 246, 663, 551, 662, 171, 600, 293, 84, 146],
  Bluff: [950, 936, 0, 931, 503, 666, 408, 813, 815, 388, 365, 785, 664, 312, 947, 610, 553, 172, 733, 809, 913, 533, 467, 141, 598, 682, 980, 865, 953, 220, 702, 667, 455, 454, 821, 532, 801, 968, 955],
  Lyttelton: [675, 651, 312, 662, 218, 391, 426, 524, 533, 441, 85, 503, 382, 0, 665, 335, 271, 150, 451, 530, 631, 252, 185, 192, 316, 402, 698, 590, 675, 118, 432, 462, 174, 373, 545, 251, 530, 689, 671],
  "Port Chalmers": [831, 815, 141, 812, 377, 553, 545, 694, 694, 524, 249, 664, 544, 192, 826, 491, 432, 50, 613, 696, 792, 413, 372, 0, 478, 561, 860, 746, 835, 98, 588, 559, 334, 538, 706, 412, 689, 853, 834],
  Wellington: [551, 515, 455, 533, 75, 268, 287, 393, 394, 303, 89, 364, 243, 174, 526, 212, 126, 292, 313, 411, 492, 115, 51, 334, 178, 261, 560, 467, 556, 260, 303, 419, 0, 238, 423, 112, 394, 570, 534],
};

const distances = new Map();

for (const [from, row] of Object.entries(seededRows)) {
  row.forEach((distance, index) => {
    const to = ports[index];
    distances.set(routeKey(from, to), distance);
    distances.set(routeKey(to, from), distance);
  });
}

const portA = document.querySelector("#port-a");
const portB = document.querySelector("#port-b");
const distanceInput = document.querySelector("#distance");
const speedInput = document.querySelector("#speed");
const departureInput = document.querySelector("#departure");
const lookupNote = document.querySelector("#lookup-note");
const timeResult = document.querySelector("#time-result");
const hoursResult = document.querySelector("#hours-result");
const etaResult = document.querySelector("#eta-result");
const swapButton = document.querySelector("#swap-ports");

populatePorts();
setInitialDeparture();
updateDistanceFromPorts();
calculate();

document.querySelector("#route-form").addEventListener("submit", (event) => {
  event.preventDefault();
});

portA.addEventListener("change", () => {
  updateDistanceFromPorts();
  calculate();
});

portB.addEventListener("change", () => {
  updateDistanceFromPorts();
  calculate();
});

distanceInput.addEventListener("input", calculate);
speedInput.addEventListener("input", calculate);
departureInput.addEventListener("input", calculate);

swapButton.addEventListener("click", () => {
  const oldA = portA.value;
  portA.value = portB.value;
  portB.value = oldA;
  updateDistanceFromPorts();
  calculate();
});

function populatePorts() {
  for (const port of ports) {
    portA.add(new Option(port, port));
    portB.add(new Option(port, port));
  }

  portA.value = "Auckland";
  portB.value = "Port Chalmers";
}

function updateDistanceFromPorts() {
  const distance = distances.get(routeKey(portA.value, portB.value));

  lookupNote.classList.remove("warning");

  if (portA.value === portB.value) {
    distanceInput.value = "0";
    lookupNote.textContent = "Same port selected.";
    return;
  }

  if (typeof distance === "number") {
    distanceInput.value = distance.toString();
    lookupNote.textContent = "Distance loaded from the seeded coastal-distance table.";
    return;
  }

  distanceInput.value = "";
  lookupNote.textContent = "This pair is not seeded yet. Type the nautical-mile distance from the table.";
  lookupNote.classList.add("warning");
}

function calculate() {
  const distance = Number(distanceInput.value);
  const speed = Number(speedInput.value);

  if (distanceInput.value === "" || speedInput.value === "" || distance < 0 || speed <= 0) {
    timeResult.textContent = "--";
    hoursResult.textContent = "--";
    etaResult.textContent = "--";
    return;
  }

  const totalHours = distance / speed;
  const totalMinutes = Math.round(totalHours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  timeResult.textContent = formatDuration(days, hours, minutes);
  hoursResult.textContent = `${totalHours.toFixed(2)} h`;
  etaResult.textContent = formatEta(totalMinutes);
}

function formatDuration(days, hours, minutes) {
  const parts = [];
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (minutes || !parts.length) parts.push(`${minutes} min`);
  return parts.join(" ");
}

function formatEta(totalMinutes) {
  if (!departureInput.value) return "--";

  const departure = new Date(departureInput.value);
  if (Number.isNaN(departure.getTime())) return "--";

  const eta = new Date(departure.getTime() + totalMinutes * 60 * 1000);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(eta);
}

function setInitialDeparture() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  departureInput.value = now.toISOString().slice(0, 16);
}

function routeKey(from, to) {
  return `${from}::${to}`;
}
