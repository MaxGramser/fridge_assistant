/* Fridge Assistant panel — vanilla custom element, no external deps.
 *
 * i18n: everything in this file follows a simple rule — Dutch if Home
 * Assistant's (per-user) language is Dutch, English for anything else.
 * See `_lang()`/`t()` below. Only nl/en exist; there is no third language.
 */

const MONTHS = {
  nl: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

// Frontend-only translations of the backend's technical enum keys
// (locations/categories/kinds). The backend still sends emoji/icon; only the
// label text is overridden here, per the active language.
const LOCATION_LABELS = {
  nl: { fridge: "Koelkast", freezer: "Vriezer", pantry: "Buiten koelkast" },
  en: { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry" },
};
const CATEGORY_LABELS = {
  nl: {
    vegetables: "Groente", fruit: "Fruit", dairy: "Zuivel", meat: "Vlees", fish: "Vis",
    prepared_dish: "Bereid gerecht", bread_bakery: "Brood & bakkerij",
    sauces_spices: "Saus & kruiden", drinks: "Dranken", eggs: "Eieren",
    leftovers: "Restjes", other: "Overig",
  },
  en: {
    vegetables: "Vegetables", fruit: "Fruit", dairy: "Dairy", meat: "Meat", fish: "Fish",
    prepared_dish: "Prepared dish", bread_bakery: "Bakery",
    sauces_spices: "Sauces & spices", drinks: "Drinks", eggs: "Eggs",
    leftovers: "Leftovers", other: "Other",
  },
};
const KIND_LABELS = {
  nl: {
    ingredient: { label: "Losse ingrediënten", short: "Ingrediënten" },
    dish: { label: "Gerechten", short: "Gerechten" },
  },
  en: {
    ingredient: { label: "Individual ingredients", short: "Ingredients" },
    dish: { label: "Dishes", short: "Dishes" },
  },
};

const STATUS_COLOR = {
  expired: "var(--fa-red)",
  soon: "var(--fa-orange)",
  ok: "var(--fa-green)",
  none: "var(--fa-muted)",
};

/* ---------------------------------------------------------------- strings */
const STRINGS = {
  nl: {
    appTitle: "Koelkast",
    historyTooltip: (n) => (n ? `Geschiedenis (${n})` : "Geschiedenis"),
    manageTemplates: "Templates beheren",
    settings: "Instellingen",
    searchPlaceholder: "Zoek…",
    cleanUp: "Opruimen",
    loading: "Laden…",
    scanAria: "Scan barcode",
    addItemAria: "Item toevoegen",

    itemsUnit: "items",
    soonUnit: "bijna op",
    expiredUnit: "over datum",
    all: "Alles",

    emptyTitle: "Nog niets in de koelkast",
    emptySub: "Voeg je eerste item toe — houdbaarheid wordt automatisch geschat.",
    addItemBtn: "＋ Item toevoegen",
    useFirst: "⏰ Als eerste op",
    nothingFound: "Niets gevonden.",
    printSticker: "Print sticker",

    addNamePlaceholder: "Wat leg je erin? bv. krop sla",
    dateInFieldLabel: "Datum erin",
    expiryLabel: "Houdbaar tot",
    datePickPlaceholder: "Kies datum",
    dateOptionalPlaceholder: "Optioneel",
    clearDateTitle: "Datum wissen",
    moreOptions: "Meer opties ▾",
    lessOptions: "Minder opties ▴",
    displayNameLabel: "Aparte naam (optioneel)",
    displayNamePlaceholder: "Weergavenaam",
    quantityLabel: "Hoeveelheid",
    quantityPlaceholder: "bv. 2 bakjes",
    emojiLabel: "Emoji",
    notesLabel: "Notitie",
    photoUrlLabel: "Foto-URL (optioneel)",
    photoUrlPlaceholder: "https://…",
    chooseTemplateBtn: "📚 Template kiezen",
    saveBtn: "Opslaan",
    addBtn: "Toevoegen",
    aiEstimateMini: "✨ AI schat",
    unknownProduct: "Onbekend product",
    noTemplateFor: (q, aiEnabled) =>
      `Nog geen template voor "${q}" — vul zelf een datum in${aiEnabled ? " of laat AI schatten" : ""}.`,
    chooseTemplateTitle: "Kies template",
    notSuitableHere: "Niet geschikt voor deze locatie",
    daysAtLocation: (label, days) => `${label}: ${days} dagen`,
    aiEstimateTitle: "AI-schatting",
    otherTemplateTitle: "Andere template",
    notThisManualTitle: "Niet dit — handmatig",
    manualEntry: "Handmatig invullen",
    savedToast: "Opgeslagen ✓",
    addedToast: (code) => `Toegevoegd ✓ ${code ? "code " + code : ""}`,
    printActionLabel: "🏷️ Print",
    errorPrefix: "Fout: ",

    aiThinking: "✨ AI denkt na…",
    estimatingFor: (name) => `Houdbaarheid van "${name}" schatten…`,
    aiFailed: "AI-schatting mislukt",
    dayUnitShort: "dg",
    aiHint: "Klopt niet helemaal? Tik een dag-getal aan en pas het aan 👇",
    saveAsTemplateLabel: "Bewaar (met jouw aanpassingen) als template",

    pickTemplateTitle: "📚 Kies een template",
    searchInTemplates: (n) => `Zoek in ${n} templates…`,
    ownSuffix: " · eigen",

    templatesTitle: "📚 Templates",
    templateWithAiTitle: "Template met AI",
    newTemplateTitleIcon: "Nieuwe template",
    hiddenTemplatesTitle: "Verborgen standaard-templates",
    searchOrFilterPlaceholder: "Zoek of filter…",
    nothingHidden: "Niets verborgen.",
    backBtn: "↩︎ Terug",
    restoredToast: "Teruggezet ✓",
    nothingInGroup: "Niets in deze groep.",
    customizedBadge: "aangepast",
    ownBadge: "eigen",

    templateWithAiSub: "Typ een product; AI schat de houdbaarheid, jij past aan.",
    productOrDishLabel: "Product of gerecht",
    productOrDishPlaceholder: "bv. zelfgemaakte curry",
    estimateWithAiBtn: "✨ Schat met AI",
    aiErrorPrefix: "AI: ",

    newTemplateHeading: "Nieuwe template",
    editTemplateHeading: "Template bewerken",
    overrideNote: "Aanpassing van standaard-template",
    builtinNote: "Standaard-template — wijziging maakt een eigen versie",
    ownTemplateNote: "Eigen template",
    nameLabel: "Naam",
    namePlaceholderTemplate: "bv. Zelfgemaakte pesto",
    kindLabel: "Soort",
    categoryLabel: "Categorie",
    shelfLifeSectionLabel: "Houdbaarheid in dagen — leeg = niet geschikt",
    notApplicablePlaceholder: "n.v.t.",
    aliasesLabel: "Ook herkennen als (komma-gescheiden)",
    aliasesPlaceholder: "pasta bolognese, spaghetti",
    notesTipLabel: "Notitie / bewaartip",
    notesTipPlaceholder: "Laat afkoelen voor invriezen",
    restoreDefaultBtn: "↺ Herstel",
    builtinRemoveBtn: "🙈 Verwijder",
    customRemoveBtn: "🗑 Verwijder",
    templateAddedToast: "Template toegevoegd ✓",
    templateSavedToast: "Template opgeslagen ✓",
    restoredDefaultToast: "Hersteld naar standaard ✓",
    removedFromListToast: "Uit lijst gehaald ✓",
    templateDeletedToast: "Template verwijderd ✓",

    locationLabel: "Locatie",
    addedByLabel: "Toegevoegd door",
    contentsLabel: "Inhoud",
    dateInDetailLabel: "Erin gelegd",
    daysAgoShort: (n) => `${n} dg geleden`,
    stickerBtn: "🏷️ Sticker",
    editBtn: "✏️ Bewerken",
    eatenBtn: "🍽️ Opgegeten",
    tossedBtn: "🗑️ Weggegooid",

    undoLabel: "Ongedaan",
    completedToast: (emoji, name, eaten) => `${emoji} ${name} ${eaten ? "opgegeten" : "weggegooid"}`,

    notOwnLabel: (val) => `Dit is geen eigen koelkast-label (${val})`,
    noActiveItemWithCode: (val) => `Geen actief item met code ${val}`,
    couldNotEatRetry: "Kon niet opeten — probeer opnieuw",
    eatenStatusCount: (name, n) => `🍽️ ${name} opgegeten (${n})`,

    cleanUpTitle: "🧹 Koelkast opruimen",
    expiredSection: "Over datum",
    soonSection: "Bijna over datum",
    allGoodMessage: "Alles is nog goed!",
    removeSelectedBtn: "Verwijder geselecteerde",
    removeNItems: (n) => `Verwijder ${n} item${n === 1 ? "" : "s"}`,
    nothingSelected: "Niets geselecteerd",
    cleanedUpToast: (n) => `🧹 ${n} item${n === 1 ? "" : "s"} opgeruimd`,

    scanTitle: "📷 Scan",
    scanSub: "Je koelkast-label om te zoeken, of een winkelbarcode",
    searchModeBtn: "🔎 Zoeken",
    eatModeBtn: "🍽️ Opeten",
    photoBtn: "📸 Foto",
    typeCodeBtn: "⌨️ Code typen",
    eatModeStatus: "🍽️ Scan je labels — elk item wordt meteen opgegeten",
    aimAtBarcode: "Richt op de barcode…",
    codeInputPlaceholder: "Code, bv. AB12",
    searchBtn: "Zoek",
    readingPhoto: "Foto lezen…",
    noBarcodeFound: "Geen barcode gevonden — probeer dichterbij en scherp.",
    takePhotoOfBarcode: "Maak een foto van de barcode 📸",
    liveScanUnavailable: "Live scannen kan niet op dit toestel. Typ de code ⌨️.",
    noCameraAccess: "Geen camera-toegang. Gebruik 📸 Foto of ⌨️ Code.",
    torchTooltip: "Zaklamp",

    foundToast: (name) => `🔎 ${name} gevonden`,
    noActiveItemHistoryHint: (val) => `Geen actief item met code ${val} — misschien al opgegeten/weggegooid (📜)`,
    unknownCode: (val) => `Onbekende code: ${val}`,

    lookingUpProduct: (code) => `🔎 Product opzoeken… (${code})`,
    retailBarcodeNote: (code) => `Winkelbarcode ${code}`,
    noProductNameFound: (code) => `Geen productnaam gevonden (${code}) — vul zelf in`,
    recognizedBefore: "🔁 Eerder toegevoegd — herkend",
    productFoundToast: (name) => `🛒 ${name}`,

    justNow: "net",
    minutesAgo: (m) => `${m} min geleden`,
    hoursAgo: (h) => `${h} uur geleden`,
    yesterday: "gisteren",
    daysAgo: (d) => `${d} dagen geleden`,

    restoreToFridgeTitle: "Terugzetten in de koelkast",
    historyHeading: "📜 Geschiedenis",
    loadMoreBtn: "Meer laden",
    historyLoadFailed: "Kon geschiedenis niet laden.",
    historyEmpty: "Nog niets opgegeten of weggegooid.",
    historySummary: (total) => `${total} afgerond${total >= 500 ? " (laatste 500)" : ""}`,
    restoreFailedToast: "Herstellen mislukt",
    restoredToFridgeToast: "↩︎ Teruggezet in de koelkast",

    printerOnNote: (label, size, copies) =>
      `Label <b>${label}</b> (${size}, getest) · printer automatisch gedetecteerd. Print ${copies}× per keer.`,
    printerOffNote: (label, size) =>
      `Label <b>${label}</b> (${size}).<br>De printer staat uit — installeer de <b>Label Printer</b> add-on en zet 'm aan bij ⚙️ instellingen.`,
    printStickerModalTitle: "🏷️ Sticker printen",
    previewLoading: "Voorbeeld laden…",
    closeBtn: "Sluiten",
    printBtnLabel: (copies) => `🖨️ Print${copies > 1 ? ` (${copies}×)` : ""}`,
    previewUnavailable: (err) => `Voorbeeld niet beschikbaar: ${err}`,
    workingLabel: "Bezig…",
    stickerPrintedToast: (code, copies) => `🖨️ Sticker ${code} geprint${copies > 1 ? ` (${copies}×)` : ""}`,
    printerDisabledReason: "Printer staat uit — zet 'm aan bij ⚙️ instellingen.",
    printerUnreachableReason: "Label Printer add-on niet bereikbaar. Staat de add-on aan?",
    printerNotConnectedReason: "De DYMO is niet gevonden. Check kabel/stroom en herstart de add-on.",
    renderFailedReason: "Label renderen mislukte.",
    genericPrintFailed: (reason) => `Printen mislukte (${reason || "?"})`,
    printFailedError: (err) => `Print mislukt: ${err}`,
  },

  en: {
    appTitle: "Fridge",
    historyTooltip: (n) => (n ? `History (${n})` : "History"),
    manageTemplates: "Manage templates",
    settings: "Settings",
    searchPlaceholder: "Search…",
    cleanUp: "Clean up",
    loading: "Loading…",
    scanAria: "Scan barcode",
    addItemAria: "Add item",

    itemsUnit: "items",
    soonUnit: "soon",
    expiredUnit: "expired",
    all: "All",

    emptyTitle: "Nothing in the fridge yet",
    emptySub: "Add your first item — expiry is estimated automatically.",
    addItemBtn: "＋ Add item",
    useFirst: "⏰ Use first",
    nothingFound: "Nothing found.",
    printSticker: "Print sticker",

    addNamePlaceholder: "What are you putting in? e.g. lettuce",
    dateInFieldLabel: "Date added",
    expiryLabel: "Use by",
    datePickPlaceholder: "Pick a date",
    dateOptionalPlaceholder: "Optional",
    clearDateTitle: "Clear date",
    moreOptions: "More options ▾",
    lessOptions: "Fewer options ▴",
    displayNameLabel: "Custom name (optional)",
    displayNamePlaceholder: "Display name",
    quantityLabel: "Quantity",
    quantityPlaceholder: "e.g. 2 containers",
    emojiLabel: "Emoji",
    notesLabel: "Note",
    photoUrlLabel: "Photo URL (optional)",
    photoUrlPlaceholder: "https://…",
    chooseTemplateBtn: "📚 Choose template",
    saveBtn: "Save",
    addBtn: "Add",
    aiEstimateMini: "✨ AI estimate",
    unknownProduct: "Unknown product",
    noTemplateFor: (q, aiEnabled) =>
      `No template yet for "${q}" — enter a date yourself${aiEnabled ? " or let AI estimate" : ""}.`,
    chooseTemplateTitle: "Choose template",
    notSuitableHere: "Not suitable for this location",
    daysAtLocation: (label, days) => `${label}: ${days} days`,
    aiEstimateTitle: "AI estimate",
    otherTemplateTitle: "Different template",
    notThisManualTitle: "Not this — manual",
    manualEntry: "Manual entry",
    savedToast: "Saved ✓",
    addedToast: (code) => `Added ✓ ${code ? "code " + code : ""}`,
    printActionLabel: "🏷️ Print",
    errorPrefix: "Error: ",

    aiThinking: "✨ AI is thinking…",
    estimatingFor: (name) => `Estimating shelf life for "${name}"…`,
    aiFailed: "AI estimate failed",
    dayUnitShort: "d",
    aiHint: "Not quite right? Tap a day count to adjust it 👇",
    saveAsTemplateLabel: "Save (with your edits) as a template",

    pickTemplateTitle: "📚 Choose a template",
    searchInTemplates: (n) => `Search ${n} templates…`,
    ownSuffix: " · custom",

    templatesTitle: "📚 Templates",
    templateWithAiTitle: "Template with AI",
    newTemplateTitleIcon: "New template",
    hiddenTemplatesTitle: "Hidden built-in templates",
    searchOrFilterPlaceholder: "Search or filter…",
    nothingHidden: "Nothing hidden.",
    backBtn: "↩︎ Back",
    restoredToast: "Restored ✓",
    nothingInGroup: "Nothing in this group.",
    customizedBadge: "customized",
    ownBadge: "custom",

    templateWithAiSub: "Type a product; AI estimates shelf life, you adjust it.",
    productOrDishLabel: "Product or dish",
    productOrDishPlaceholder: "e.g. homemade curry",
    estimateWithAiBtn: "✨ Estimate with AI",
    aiErrorPrefix: "AI: ",

    newTemplateHeading: "New template",
    editTemplateHeading: "Edit template",
    overrideNote: "Customization of a built-in template",
    builtinNote: "Built-in template — editing creates your own version",
    ownTemplateNote: "Your own template",
    nameLabel: "Name",
    namePlaceholderTemplate: "e.g. Homemade pesto",
    kindLabel: "Kind",
    categoryLabel: "Category",
    shelfLifeSectionLabel: "Shelf life in days — empty = not suitable",
    notApplicablePlaceholder: "n/a",
    aliasesLabel: "Also recognize as (comma-separated)",
    aliasesPlaceholder: "pasta bolognese, spaghetti",
    notesTipLabel: "Note / storage tip",
    notesTipPlaceholder: "Let cool before freezing",
    restoreDefaultBtn: "↺ Restore",
    builtinRemoveBtn: "🙈 Remove",
    customRemoveBtn: "🗑 Remove",
    templateAddedToast: "Template added ✓",
    templateSavedToast: "Template saved ✓",
    restoredDefaultToast: "Restored to default ✓",
    removedFromListToast: "Removed from list ✓",
    templateDeletedToast: "Template deleted ✓",

    locationLabel: "Location",
    addedByLabel: "Added by",
    contentsLabel: "Contents",
    dateInDetailLabel: "Added on",
    daysAgoShort: (n) => `${n}d ago`,
    stickerBtn: "🏷️ Sticker",
    editBtn: "✏️ Edit",
    eatenBtn: "🍽️ Eaten",
    tossedBtn: "🗑️ Tossed",

    undoLabel: "Undo",
    completedToast: (emoji, name, eaten) => `${emoji} ${name} ${eaten ? "eaten" : "tossed"}`,

    notOwnLabel: (val) => `This isn't one of your own fridge labels (${val})`,
    noActiveItemWithCode: (val) => `No active item with code ${val}`,
    couldNotEatRetry: "Couldn't mark as eaten — try again",
    eatenStatusCount: (name, n) => `🍽️ ${name} eaten (${n})`,

    cleanUpTitle: "🧹 Clean up the fridge",
    expiredSection: "Past date",
    soonSection: "Expiring soon",
    allGoodMessage: "Everything is still good!",
    removeSelectedBtn: "Remove selected",
    removeNItems: (n) => `Remove ${n} item${n === 1 ? "" : "s"}`,
    nothingSelected: "Nothing selected",
    cleanedUpToast: (n) => `🧹 ${n} item${n === 1 ? "" : "s"} cleaned up`,

    scanTitle: "📷 Scan",
    scanSub: "Your fridge label to search, or a retail barcode",
    searchModeBtn: "🔎 Search",
    eatModeBtn: "🍽️ Eat",
    photoBtn: "📸 Photo",
    typeCodeBtn: "⌨️ Type code",
    eatModeStatus: "🍽️ Scan your labels — each item is marked eaten right away",
    aimAtBarcode: "Point at the barcode…",
    codeInputPlaceholder: "Code, e.g. AB12",
    searchBtn: "Search",
    readingPhoto: "Reading photo…",
    noBarcodeFound: "No barcode found — try closer and in focus.",
    takePhotoOfBarcode: "Take a photo of the barcode 📸",
    liveScanUnavailable: "Live scanning isn't available on this device. Type the code ⌨️.",
    noCameraAccess: "No camera access. Use 📸 Photo or ⌨️ Code.",
    torchTooltip: "Flashlight",

    foundToast: (name) => `🔎 ${name} found`,
    noActiveItemHistoryHint: (val) => `No active item with code ${val} — maybe already eaten/tossed (📜)`,
    unknownCode: (val) => `Unknown code: ${val}`,

    lookingUpProduct: (code) => `🔎 Looking up product… (${code})`,
    retailBarcodeNote: (code) => `Retail barcode ${code}`,
    noProductNameFound: (code) => `No product name found (${code}) — fill it in yourself`,
    recognizedBefore: "🔁 Added before — recognized",
    productFoundToast: (name) => `🛒 ${name}`,

    justNow: "just now",
    minutesAgo: (m) => `${m} min ago`,
    hoursAgo: (h) => `${h} hour${h === 1 ? "" : "s"} ago`,
    yesterday: "yesterday",
    daysAgo: (d) => `${d} days ago`,

    restoreToFridgeTitle: "Put back in the fridge",
    historyHeading: "📜 History",
    loadMoreBtn: "Load more",
    historyLoadFailed: "Couldn't load history.",
    historyEmpty: "Nothing eaten or tossed yet.",
    historySummary: (total) => `${total} completed${total >= 500 ? " (last 500)" : ""}`,
    restoreFailedToast: "Restore failed",
    restoredToFridgeToast: "↩︎ Put back in the fridge",

    printerOnNote: (label, size, copies) =>
      `Label <b>${label}</b> (${size}, tested) · printer detected automatically. Prints ${copies}× per tap.`,
    printerOffNote: (label, size) =>
      `Label <b>${label}</b> (${size}).<br>The printer is off — install the <b>Label Printer</b> add-on and enable it in ⚙️ settings.`,
    printStickerModalTitle: "🏷️ Print sticker",
    previewLoading: "Loading preview…",
    closeBtn: "Close",
    printBtnLabel: (copies) => `🖨️ Print${copies > 1 ? ` (${copies}×)` : ""}`,
    previewUnavailable: (err) => `Preview unavailable: ${err}`,
    workingLabel: "Working…",
    stickerPrintedToast: (code, copies) => `🖨️ Sticker ${code} printed${copies > 1 ? ` (${copies}×)` : ""}`,
    printerDisabledReason: "Printer is off — enable it in ⚙️ settings.",
    printerUnreachableReason: "Label Printer add-on unreachable. Is the add-on running?",
    printerNotConnectedReason: "The DYMO wasn't found. Check cable/power and restart the add-on.",
    renderFailedReason: "Rendering the label failed.",
    genericPrintFailed: (reason) => `Printing failed (${reason || "?"})`,
    printFailedError: (err) => `Print failed: ${err}`,
  },
};

/* ---------- small date helpers (timezone-safe, YYYY-MM-DD) ---------- */
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function parseISO(d) {
  if (!d) return null;
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}
function toISO(dt) {
  return dt.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const dt = parseISO(iso);
  if (!dt) return null;
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}
function daysBetween(fromISO, toISOv) {
  const a = parseISO(fromISO), b = parseISO(toISOv);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}
function fmtDate(iso, lang) {
  const dt = parseISO(iso);
  if (!dt) return "—";
  return `${dt.getUTCDate()} ${MONTHS[lang][dt.getUTCMonth()]}`;
}
function daysLabel(daysLeft, lang) {
  const s = STRINGS[lang];
  if (daysLeft === null || daysLeft === undefined) return lang === "nl" ? "geen datum" : "no date";
  if (daysLeft < 0) {
    const abs = Math.abs(daysLeft);
    return lang === "nl"
      ? `${abs} dag${abs === 1 ? "" : "en"} over datum`
      : `${abs} day${abs === 1 ? "" : "s"} past date`;
  }
  if (daysLeft === 0) return lang === "nl" ? "vandaag!" : "today!";
  if (daysLeft === 1) return lang === "nl" ? "nog 1 dag" : "1 day left";
  return lang === "nl" ? `nog ${daysLeft} dagen` : `${daysLeft} days left`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

class FridgeAssistantPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = null;
    this._filterLoc = "all";
    this._filterKind = "all";
    this._search = "";
    this._unsub = null;
    this._shellBuilt = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._shellBuilt) this._init();
    if (!this._unsub && hass) this._subscribe();
    if (this._shellBuilt) this._applyChrome();
  }
  get hass() { return this._hass; }

  // HA sets these properties on the panel element; `narrow` drives mobile layout.
  set narrow(v) { this._narrow = v; if (this._shellBuilt) this._applyChrome(); }
  get narrow() { return this._narrow; }
  set route(v) { this._route = v; }
  get route() { return this._route; }
  set panel(v) { this._panel = v; }
  get panel() { return this._panel; }

  connectedCallback() {
    if (!this._shellBuilt && this._hass) this._init();
  }
  disconnectedCallback() {
    if (this._unsub) { try { this._unsub(); } catch (e) {} this._unsub = null; }
  }

  /* ------------------------------------------------------------------ i18n */
  // "nl" only if Home Assistant's (per-user) language is Dutch; English for
  // everything else, including no language at all. Mirrors the backend's
  // resolve_language() so printed labels/notifications match the panel.
  _lang() {
    const raw = (this._hass && this._hass.language) || "en";
    return String(raw).split("-")[0].toLowerCase() === "nl" ? "nl" : "en";
  }

  t(key, ...args) {
    const table = STRINGS[this._lang()] || STRINGS.en;
    const v = (key in table ? table[key] : STRINGS.en[key]);
    return typeof v === "function" ? v(...args) : v;
  }

  // Backend sends location_meta/categories/kinds with Dutch labels (plus
  // emoji/icon, which aren't translated); these merge in the frontend label
  // for the active language while keeping the rest of the backend object.
  _locMeta(key) {
    const base = (this._state && this._state.location_meta || {})[key] || {};
    const table = LOCATION_LABELS[this._lang()] || LOCATION_LABELS.en;
    return { ...base, label: table[key] || base.label || key };
  }
  _catMeta(key) {
    const base = (this._state && this._state.categories || {})[key] || {};
    const table = CATEGORY_LABELS[this._lang()] || CATEGORY_LABELS.en;
    return { ...base, label: table[key] || base.label || key };
  }
  _kindMeta(key) {
    const base = (this._state && this._state.kinds || {})[key] || {};
    const table = (KIND_LABELS[this._lang()] || KIND_LABELS.en)[key] || {};
    const label = table.label || base.label || key;
    return { ...base, label, short: table.short || base.short || label };
  }

  async _subscribe() {
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        (state) => { this._state = state; this._onState(); },
        { type: "fridge_assistant/subscribe" }
      );
    } catch (e) {
      this._unsub = null;
    }
  }

  async _call(type, payload = {}) {
    return this._hass.callWS({ type: `fridge_assistant/${type}`, ...payload });
  }

  _kindOf(t) {
    return (t && t.kind) || (this._state.category_kind || {})[t && t.category] || "ingredient";
  }

  /* Avatar for the person who added an item: their photo if a linked person
     entity has one, else coloured initials derived from the name. */
  _avatar(name, picture, size = 20) {
    const box = `width:${size}px;height:${size}px`;
    if (picture) return `<img class="avatar" style="${box}" src="${esc(picture)}" alt="" title="${esc(name || "")}">`;
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    const initials = (parts.length ? parts.map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
    let hash = 0;
    for (const ch of String(name || "?")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `<span class="avatar avatar-i" style="${box};font-size:${Math.round(size * 0.42)}px;background:hsl(${hash % 360} 52% 52%)" title="${esc(name || "")}">${esc(initials)}</span>`;
  }

  /* ---------------------------------------------------------------- shell */
  _init() {
    this._shellBuilt = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <div class="wrap">
        <header class="topbar">
          <div class="topbar-row">
            <span class="menu-slot" id="menu-slot"></span>
            <div class="brand"><span class="brand-emoji">🧊</span><h1>${this.t("appTitle")}</h1></div>
            <span class="spacer"></span>
            <button class="icon-btn" id="btn-history" title="${this.t("historyTooltip", 0)}">📜</button>
            <button class="icon-btn" id="btn-templates" title="${this.t("manageTemplates")}">📚</button>
            <button class="icon-btn" id="btn-settings" title="${this.t("settings")}">⚙︎</button>
          </div>
          <div class="counts" id="counts"></div>
          <div class="searchrow">
            <div class="search"><span>🔍</span><input id="search" placeholder="${this.t("searchPlaceholder")}" autocomplete="off" enterkeyhint="search"></div>
            <button class="btn ghost icon-only" id="btn-clean" title="${this.t("cleanUp")}">🧹</button>
          </div>
        </header>
        <nav class="filters" id="filters"></nav>
        <main id="list"><div class="loading">${this.t("loading")}</div></main>
      </div>
      <button class="fab fab-scan" id="fab-scan" aria-label="${this.t("scanAria")}">📷</button>
      <button class="fab" id="fab-add" aria-label="${this.t("addItemAria")}">＋</button>
      <div id="modal-root"></div>
      <div id="toast-root"></div>
    `;
    const $ = (s) => this.shadowRoot.getElementById(s);
    $("fab-add").addEventListener("click", () => this._openAddModal());
    $("fab-scan").addEventListener("click", () => this._openScanner());
    $("btn-clean").addEventListener("click", () => this._openCleanModal());
    $("btn-history").addEventListener("click", () => this._openHistory());
    $("btn-templates").addEventListener("click", () => this._openTemplatesManager());
    $("btn-settings").addEventListener("click", () => {
      window.location.href = "/config/integrations/integration/fridge_assistant";
    });
    $("search").addEventListener("input", (e) => { this._search = e.target.value; this._renderList(); });
    this._applyChrome();
    if (this._state) this._onState();
  }

  /* Render the native HA hamburger so the sidebar is reachable on mobile
     (a full-page custom panel has no HA header of its own). */
  _applyChrome() {
    const slot = this.shadowRoot && this.shadowRoot.getElementById("menu-slot");
    if (!slot) return;
    if (!this._menuBtn) {
      this._menuBtn = document.createElement("ha-menu-button");
      slot.appendChild(this._menuBtn);
    }
    this._menuBtn.hass = this._hass;
    this._menuBtn.narrow = this._narrow ?? false;
  }

  _onState() {
    const hb = this.shadowRoot.getElementById("btn-history");
    if (hb) hb.title = this.t("historyTooltip", this._state.history_count || 0);
    this._renderCounts();
    this._renderFilters();
    this._renderList();
  }

  _renderCounts() {
    const c = this._state.counts;
    const el = this.shadowRoot.getElementById("counts");
    el.innerHTML = `
      <span class="pill"><b>${c.total}</b> ${this.t("itemsUnit")}</span>
      ${c.soon ? `<span class="pill warn"><b>${c.soon}</b> ${this.t("soonUnit")}</span>` : ""}
      ${c.expired ? `<span class="pill bad"><b>${c.expired}</b> ${this.t("expiredUnit")}</span>` : ""}
    `;
  }

  _renderFilters() {
    const { locations, counts, kinds } = this._state;
    const el = this.shadowRoot.getElementById("filters");
    const locChip = (key, label, count) =>
      `<button class="chip ${this._filterLoc === key ? "active" : ""}" data-loc="${key}">${label} <span class="chip-n">${count}</span></button>`;
    let html = locChip("all", this.t("all"), counts.total);
    for (const loc of locations) {
      const m = this._locMeta(loc);
      html += locChip(loc, `${m.emoji || ""} ${m.label || loc}`, counts.by_location[loc] || 0);
    }

    const kindKeys = Object.keys(kinds || {});
    if (kindKeys.length) {
      const kindCounts = {};
      for (const i of this._state.items) {
        const k = this._kindOf(i);
        kindCounts[k] = (kindCounts[k] || 0) + 1;
      }
      const kindChip = (key, label, count) =>
        `<button class="chip ${this._filterKind === key ? "active" : ""}" data-kind="${key}">${label} <span class="chip-n">${count}</span></button>`;
      html += `<span class="chip-sep"></span>`;
      html += kindChip("all", this.t("all"), counts.total);
      for (const k of kindKeys) {
        const km = this._kindMeta(k);
        html += kindChip(k, `${km.emoji || ""} ${km.short || km.label}`, kindCounts[k] || 0);
      }
    }

    el.innerHTML = html;
    el.querySelectorAll("[data-loc]").forEach((b) =>
      b.addEventListener("click", () => { this._filterLoc = b.dataset.loc; this._renderFilters(); this._renderList(); })
    );
    el.querySelectorAll("[data-kind]").forEach((b) =>
      b.addEventListener("click", () => { this._filterKind = b.dataset.kind; this._renderFilters(); this._renderList(); })
    );
  }

  _filteredItems() {
    let items = this._state.items.slice();
    if (this._filterLoc !== "all") items = items.filter((i) => i.location === this._filterLoc);
    if (this._filterKind !== "all") items = items.filter((i) => this._kindOf(i) === this._filterKind);
    const q = this._search.trim().toLowerCase();
    if (q) items = items.filter((i) =>
      (i.name || "").toLowerCase().includes(q) ||
      (i.contents || "").toLowerCase().includes(q) ||
      (i.code || "").toLowerCase().includes(q)
    );
    return items;
  }

  _renderList() {
    if (!this._state) return;
    const list = this.shadowRoot.getElementById("list");
    const items = this._filteredItems();
    const lang = this._lang();

    if (this._state.counts.total === 0) {
      list.innerHTML = `<div class="empty">
        <div class="empty-emoji">🧊</div>
        <h2>${this.t("emptyTitle")}</h2>
        <p>${this.t("emptySub")}</p>
        <button class="btn primary" id="empty-add">${this.t("addItemBtn")}</button>
      </div>`;
      list.querySelector("#empty-add").addEventListener("click", () => this._openAddModal());
      return;
    }

    // Urgency strip (expired + soon), only in "all" view without search.
    const urgent = this._state.items.filter((i) => i.status === "expired" || i.status === "soon");
    let html = "";
    if (this._filterLoc === "all" && this._filterKind === "all" && !this._search && urgent.length) {
      const kinds = this._state.kinds || {};
      const order = Object.keys(kinds).length ? Object.keys(kinds) : ["ingredient", "dish"];
      const groups = order
        .map((k) => [k, urgent.filter((i) => this._kindOf(i) === k)])
        .filter(([, arr]) => arr.length);
      html += `<section class="strip"><div class="strip-head">${this.t("useFirst")}</div>
        ${groups.map(([k, arr]) => `<div class="strip-group">
          <div class="strip-sub">${this._kindMeta(k).emoji || ""} ${this._kindMeta(k).short}</div>
          <div class="strip-row">${arr.slice(0, 12).map((i) => this._urgentCard(i, lang)).join("")}</div>
        </div>`).join("")}
      </section>`;
    }

    if (!items.length) {
      html += `<div class="empty small"><p>${this.t("nothingFound")}</p></div>`;
    } else {
      html += `<div class="cards">${items.map((i) => this._itemCard(i, lang)).join("")}</div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll("[data-item]").forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest(".card-print")) return;
        const item = this._state.items.find((x) => x.id === el.dataset.item);
        if (item) this._openItemModal(item);
      })
    );
    list.querySelectorAll(".card-print").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); this._printSticker(b.dataset.print); })
    );
  }

  _urgentCard(i, lang) {
    return `<div class="ucard" data-item="${i.id}" style="--c:${STATUS_COLOR[i.status]}">
      <div class="ucard-emoji">${i.emoji || "🍽️"}</div>
      <div class="ucard-name">${esc(i.name)}</div>
      <div class="ucard-days">${daysLabel(i.days_left, lang)}</div>
    </div>`;
  }

  _itemCard(i, lang) {
    const lm = this._locMeta(i.location);
    // First word of the location label keeps the meta line short in both
    // languages ("Buiten koelkast" -> "Buiten", "Fridge" -> "Fridge").
    const locShort = (lm.label || i.location || "").split(" ")[0];
    const contents = i.contents && i.contents !== i.name ? i.contents : "";
    return `<div class="card" data-item="${i.id}">
      <div class="card-emoji">${i.emoji || "🍽️"}</div>
      <div class="card-main">
        <div class="card-title">${esc(i.name)}</div>
        <div class="card-sub">
          <span class="cs-fix">${lm.emoji || ""} ${esc(locShort)}</span>
          <span class="cs-sep">·</span>
          <span class="code">${esc(i.code)}</span>
          ${contents ? `<span class="cs-sep">·</span><span class="cs-more">${esc(contents)}</span>` : ""}
        </div>
      </div>
      <div class="card-right">
        <div class="status" style="--c:${STATUS_COLOR[i.status]}">${daysLabel(i.days_left, lang)}</div>
        <div class="card-when">${i.added_by_name ? `<span class="who" title="${esc(i.added_by_name)}">${this._avatar(i.added_by_name, i.added_by_picture, 15)}</span>` : ""}${i.expiry_date ? `<span>${fmtDate(i.expiry_date, lang)}</span>` : ""}</div>
      </div>
      <button class="card-print icon-btn" data-print="${i.id}" title="${this.t("printSticker")}">🏷️</button>
    </div>`;
  }

  /* --------------------------------------------------------------- modals */
  _openModal(innerHTML, { wide = false } = {}) {
    const root = this.shadowRoot.getElementById("modal-root");
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog">${innerHTML}</div>`;
    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    const close = () => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 180);
    };
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    // Keep scroll/pull-to-refresh gestures from reaching the page behind the
    // sheet. Deliberately NOT done by touching document.body (the companion
    // app relies on body scrollability for pull-to-refresh, and a global
    // lock can stick if an overlay is ever removed outside close()); the
    // overlay covers the whole viewport, so containing the gestures here is
    // enough and holds no global state. Gestures inside a scrollable part of
    // the modal scroll natively; overscroll-behavior stops the chaining.
    const containScroll = (e) => {
      let el = e.target;
      while (el && el !== overlay) {
        if (el.scrollHeight > el.clientHeight + 1) return;
        el = el.parentElement;
      }
      e.preventDefault();
    };
    overlay.addEventListener("touchmove", containScroll, { passive: false });
    overlay.addEventListener("wheel", containScroll, { passive: false });
    const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
    return { overlay, modal: overlay.querySelector(".modal"), close };
  }

  /* Native date inputs render inconsistently (iOS ignores widths, empty
     fields show nothing useful), so the input sits invisible on top of an
     own display layer: formatted date in the user's language, a clear
     placeholder when empty, and an optional ✕. The native picker stays —
     taps land on the (transparent) input itself. */
  _wireDateField(inp, placeholder, lang) {
    const wrap = inp.closest(".datefield");
    const disp = wrap.querySelector(".df-display");
    const thisYear = new Date().getFullYear();
    const sync = () => {
      const v = inp.value;
      wrap.classList.toggle("has-value", !!v);
      if (v) {
        const dt = parseISO(v);
        const year = dt && dt.getUTCFullYear() !== thisYear ? ` ${dt.getUTCFullYear()}` : "";
        disp.innerHTML = `<span class="df-ico">📅</span><b>${fmtDate(v, lang)}${year}</b>`;
      } else {
        disp.innerHTML = `<span class="df-ico">📅</span><span class="df-ph">${esc(placeholder)}</span>`;
      }
    };
    // Programmatic writes (suggestions, AI estimates) assign .value directly
    // and fire no events; intercept the property on this one instance so the
    // display can never go stale, whatever code sets the date.
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    Object.defineProperty(inp, "value", {
      get() { return desc.get.call(this); },
      set(v) { desc.set.call(this, v); sync(); },
    });
    inp.addEventListener("input", sync);
    inp.addEventListener("change", sync);
    // Desktop browsers only open the calendar from their own icon (which is
    // invisible here) — ask for the picker explicitly on click/tap.
    inp.addEventListener("click", () => { try { inp.showPicker?.(); } catch (_) {} });
    const clr = wrap.querySelector(".df-clear");
    if (clr) clr.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      inp.value = "";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
    sync();
    return sync;
  }

  /* ---- ADD / EDIT ---- */
  _openAddModal(prefill = {}, editItem = null) {
    const isEdit = !!editItem;
    const m = {
      location: prefill.location || editItem?.location || "fridge",
      added: prefill.added_date || editItem?.added_date || todayISO(),
      expiry: prefill.expiry_date || editItem?.expiry_date || "",
      expiryManual: isEdit ? editItem?.expiry_source === "manual" : false,
      emoji: prefill.emoji || editItem?.emoji || "🍽️",
      template_id: prefill.template_id || editItem?.template_id || null,
      category: prefill.category || editItem?.category || null,
      kind: editItem?.kind || prefill.kind || "ingredient",
      kindManual: isEdit,
      aiResult: null,
    };
    const locs = this._state.locations;
    const kinds = this._state.kinds || { ingredient: {}, dish: {} };
    const nameVal = editItem ? editItem.name : (prefill.name || "");

    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-emoji" id="m-emoji">${m.emoji}</div>
        <div class="m-title">
          <input class="m-name" id="f-name" placeholder="${this.t("addNamePlaceholder")}" value="${esc(nameVal)}">
        </div>
        <button class="icon-btn" id="m-close">✕</button>
      </div>
      <div class="suggest" id="f-suggest"></div>
      <div class="seg" id="f-loc">
        ${locs.map((l) => { const lm = this._locMeta(l); return `<button data-loc="${l}" class="${m.location === l ? "on" : ""}">${lm.emoji} ${lm.label}</button>`; }).join("")}
      </div>
      <div class="seg" id="f-kind">
        ${Object.keys(kinds).map((k) => { const km = this._kindMeta(k); return `<button type="button" data-kind="${k}" class="${m.kind === k ? "on" : ""}">${km.emoji || ""} ${km.short}</button>`; }).join("")}
      </div>
      <div class="grid2">
        <label class="field"><span>${this.t("dateInFieldLabel")}</span><div class="datefield"><input type="date" id="f-added" value="${m.added}"><span class="df-display"></span></div></label>
        <label class="field"><span>${this.t("expiryLabel")}</span><div class="datefield"><input type="date" id="f-expiry" value="${m.expiry}"><span class="df-display"></span><button type="button" class="df-clear" title="${this.t("clearDateTitle")}" aria-label="${this.t("clearDateTitle")}">✕</button></div></label>
      </div>
      <div class="expiry-hint" id="f-hint"></div>
      <button class="link" id="f-adv">${this.t("moreOptions")}</button>
      <div class="adv hidden" id="f-advbox">
        <label class="field"><span>${this.t("displayNameLabel")}</span><input id="f-dispname" placeholder="${this.t("displayNamePlaceholder")}" value="${esc(editItem?.name || "")}"></label>
        <div class="grid2">
          <label class="field"><span>${this.t("quantityLabel")}</span><input id="f-qty" placeholder="${this.t("quantityPlaceholder")}" value="${esc(editItem?.quantity ?? prefill.quantity ?? "")}"></label>
          <label class="field"><span>${this.t("emojiLabel")}</span><input id="f-emojiin" maxlength="4" value="${esc(m.emoji)}"></label>
        </div>
        <label class="field"><span>${this.t("notesLabel")}</span><input id="f-notes" placeholder="${this.t("notesLabel")}" value="${esc(editItem?.notes ?? prefill.notes ?? "")}"></label>
        <label class="field"><span>${this.t("photoUrlLabel")}</span><input id="f-photo" placeholder="${this.t("photoUrlPlaceholder")}" value="${esc(editItem?.photo ?? prefill.photo ?? "")}"></label>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="f-template">${this.t("chooseTemplateBtn")}</button>
        <button class="btn primary" id="f-submit">${isEdit ? this.t("saveBtn") : this.t("addBtn")}</button>
      </div>
    `, { wide: false });

    const q = (s) => h.modal.querySelector(s);
    const nameEl = q("#f-name"), addedEl = q("#f-added"), expEl = q("#f-expiry");
    const emojiEl = q("#m-emoji"), suggestEl = q("#f-suggest"), hintEl = q("#f-hint");
    const lang = this._lang();

    const setEmoji = (e) => { m.emoji = e; emojiEl.textContent = e; if (q("#f-emojiin")) q("#f-emojiin").value = e; };
    const setKind = (k) => {
      if (!k) return;
      m.kind = k;
      const ke = q("#f-kind");
      if (ke) ke.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.kind === k));
    };
    const updateHint = () => {
      const val = expEl.value;
      if (!val) { hintEl.textContent = ""; return; }
      const dl = daysBetween(todayISO(), val);
      const col = dl < 0 ? "var(--fa-red)" : dl <= (this._state.options.warn_days || 3) ? "var(--fa-orange)" : "var(--fa-green)";
      hintEl.innerHTML = `<span style="color:${col}">● ${daysLabel(dl, lang)}</span>`;
    };
    updateHint();
    this._wireDateField(addedEl, this.t("datePickPlaceholder"), lang);
    this._wireDateField(expEl, this.t("dateOptionalPlaceholder"), lang);

    const applySuggestion = (expiryDate, source) => {
      if (!m.expiryManual && expiryDate) { expEl.value = expiryDate; m.expiry = expiryDate; }
      m.expirySource = source;
      updateHint();
    };

    const aiCtx = () => ({ m, q, setEmoji, setKind, applySuggestion, suggestEl });
    const wireActions = (query) => {
      const a = q("#s-ai");
      if (a) a.addEventListener("click", () => this._aiEstimate(query, aiCtx()));
      const o = q("#s-other");
      if (o) o.addEventListener("click", () =>
        this._openTemplatePicker((t) => { m.noAutoMatch = false; nameEl.value = t.name; doMatch(); }));
    };

    // Shown when nothing matched, or after the user rejected a wrong guess.
    const showManual = (query, heading) => {
      m.template_id = null; m.category = null;
      suggestEl.className = "suggest";
      const aiBtn = this._state.options.ai_enabled
        ? `<button class="s-mini ai" id="s-ai">${this.t("aiEstimateMini")}</button>` : "";
      suggestEl.innerHTML = `
        <div class="s-body"><b>${heading || this.t("unknownProduct")}</b>
          <div class="s-sub">${esc(this.t("noTemplateFor", query, this._state.options.ai_enabled))}</div></div>
        <div class="s-actions">${aiBtn}<button class="s-mini" id="s-other" title="${this.t("chooseTemplateTitle")}">📚</button></div>`;
      wireActions(query);
    };

    const doMatch = debounce(async () => {
      const query = nameEl.value.trim();
      if (m.noAutoMatch) return;
      if (query.length < 2) { suggestEl.innerHTML = ""; suggestEl.className = "suggest"; return; }
      let res;
      try { res = await this._call("match_template", { query, location: m.location, added_date: addedEl.value }); }
      catch (e) { return; }
      if (m.noAutoMatch) return; // rejected while the request was in flight
      if (res.template) {
        const t = res.template;
        m.template_id = t.id; m.category = t.category; setEmoji(t.emoji || "🍽️");
        if (!m.kindManual) setKind(this._kindOf(t));
        const sl = t.shelf_life || {};
        const noHere = sl[m.location] === null || sl[m.location] === undefined;
        applySuggestion(res.suggestion?.expiry_date, "template");
        suggestEl.className = "suggest ok";
        suggestEl.innerHTML = `
          <span class="s-emoji">${t.emoji || "📋"}</span>
          <div class="s-body"><b>${esc(t.name)}</b>
            <div class="s-sub">${noHere ? this.t("notSuitableHere") : this.t("daysAtLocation", this._locMeta(m.location).label, sl[m.location])}${t.notes ? " · " + esc(t.notes) : ""}</div></div>
          <div class="s-actions">
            ${this._state.options.ai_enabled ? `<button class="s-mini" id="s-ai" title="${this.t("aiEstimateTitle")}">✨</button>` : ""}
            <button class="s-mini" id="s-other" title="${this.t("otherTemplateTitle")}">📚</button>
            <button class="s-mini ghost" id="s-dismiss" title="${this.t("notThisManualTitle")}">✕</button>
          </div>`;
        wireActions(query);
        const d = q("#s-dismiss");
        if (d) d.addEventListener("click", () => {
          m.noAutoMatch = true; m.expiryManual = false; m.expirySource = "manual";
          setEmoji("🍽️"); expEl.value = ""; m.expiry = ""; updateHint();
          showManual(query, this.t("manualEntry"));
        });
      } else {
        showManual(query);
      }
    }, 350);

    nameEl.addEventListener("input", doMatch);
    q("#m-close").addEventListener("click", h.close);
    q("#f-loc").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        m.location = b.dataset.loc;
        q("#f-loc").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        if (m.aiResult) {
          const days = m.aiResult.shelf_life[m.location];
          applySuggestion(days ? addDays(addedEl.value, days) : null, "ai");
        } else doMatch();
      })
    );
    q("#f-kind").querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { m.kindManual = true; setKind(b.dataset.kind); }));
    addedEl.addEventListener("change", () => { if (!m.expiryManual) doMatch(); });
    expEl.addEventListener("input", () => { m.expiryManual = true; m.expiry = expEl.value; updateHint(); });
    q("#f-adv").addEventListener("click", () => {
      const box = q("#f-advbox"); box.classList.toggle("hidden");
      q("#f-adv").textContent = box.classList.contains("hidden") ? this.t("moreOptions") : this.t("lessOptions");
    });
    if (q("#f-emojiin")) q("#f-emojiin").addEventListener("input", (e) => setEmoji(e.target.value || "🍽️"));
    q("#f-template").addEventListener("click", () =>
      this._openTemplatePicker((t) => { nameEl.value = t.name; doMatch(); })
    );

    q("#f-submit").addEventListener("click", async () => {
      const dispName = (q("#f-dispname")?.value || "").trim();
      const payload = {
        name: dispName || nameEl.value.trim(),
        contents: nameEl.value.trim(),
        location: m.location,
        added_date: addedEl.value || todayISO(),
        expiry_date: expEl.value || null,
        expiry_source: m.expiryManual ? "manual" : (m.expirySource || (expEl.value ? "manual" : "none")),
        emoji: m.emoji,
        category: m.category,
        kind: m.kind,
        template_id: m.template_id,
        quantity: (q("#f-qty")?.value || "").trim() || null,
        notes: (q("#f-notes")?.value || "").trim() || null,
        photo: (q("#f-photo")?.value || "").trim() || null,
        barcode: (editItem?.barcode ?? prefill.barcode) || null,
      };
      if (!payload.contents) { nameEl.focus(); return; }
      q("#f-submit").disabled = true;
      try {
        if (isEdit) {
          await this._call("update_item", { item_id: editItem.id, changes: payload });
          h.close();
          this._toast(this.t("savedToast"));
        } else {
          // Save AI result as a template if the user opted in.
          const saveTpl = h.modal.querySelector("#s-savetpl");
          if (m.aiResult && (!saveTpl || saveTpl.checked)) {
            await this._call("add_template", {
              template: {
                name: nameEl.value.trim(),
                category: m.aiResult.category,
                kind: m.kind || m.aiResult.kind,
                emoji: m.aiResult.emoji,
                icon: m.aiResult.icon,
                shelf_life: m.aiResult.shelf_life,
                notes: m.aiResult.notes,
                source: "ai",
              },
            }).catch(() => {});
          }
          const res = await this._call("add_item", { item: payload });
          h.close();
          const code = res?.item?.code;
          if (this._state.options.printer_enabled && res?.item) {
            // Label printing is on -> jump straight into the print flow, so
            // nobody has to hunt the fresh item down in the list.
            this._toast(this.t("addedToast", code));
            this._printSticker(res.item.id, res.item);
          } else {
            this._toast(this.t("addedToast", code), {
              actionLabel: this.t("printActionLabel"), onAction: () => this._printSticker(res.item.id),
            });
          }
        }
      } catch (e) {
        q("#f-submit").disabled = false;
        this._toast(this.t("errorPrefix") + (e.message || e), { type: "bad" });
      }
    });

    // A scanned product prefills advanced fields — open the box so they show.
    if (!isEdit && (prefill.quantity || prefill.notes || prefill.photo)) {
      q("#f-advbox").classList.remove("hidden");
      q("#f-adv").textContent = this.t("lessOptions");
    }

    setTimeout(() => nameEl.focus(), 60);
    if (nameVal) doMatch();
  }

  async _aiEstimate(name, ctx) {
    const { m, setEmoji, setKind, suggestEl } = ctx;
    const lang = this._lang();
    suggestEl.className = "suggest";
    suggestEl.innerHTML = `<div class="s-body"><b>${this.t("aiThinking")}</b><div class="s-sub">${esc(this.t("estimatingFor", name))}</div></div><div class="spinner"></div>`;
    let res;
    try { res = await this._call("estimate", { name }); }
    catch (e) {
      suggestEl.className = "suggest bad";
      suggestEl.innerHTML = `<div class="s-body"><b>${this.t("aiFailed")}</b><div class="s-sub">${esc(e.message || e)}</div></div>`;
      return;
    }
    const est = res.estimate;
    m.aiResult = est; m.category = est.category; m.expirySource = "ai"; setEmoji(est.emoji || "✨");
    if (!m.kindManual && setKind) setKind(est.kind);
    const addedEl = ctx.addedEl || suggestEl.parentNode.querySelector("#f-added");
    const expEl = ctx.expEl || suggestEl.parentNode.querySelector("#f-expiry");
    const hintEl = suggestEl.parentNode.querySelector("#f-hint");
    const warn = this._state.options.warn_days || 3;

    // Recompute the expiry date + hint from the (possibly edited) AI days.
    const recompute = () => {
      const days = m.aiResult.shelf_life[m.location];
      if (!m.expiryManual) {
        expEl.value = days ? addDays(addedEl.value, days) : "";
        m.expiry = expEl.value;
      }
      if (hintEl) {
        if (expEl.value) {
          const dl = daysBetween(todayISO(), expEl.value);
          const col = dl < 0 ? "var(--fa-red)" : dl <= warn ? "var(--fa-orange)" : "var(--fa-green)";
          hintEl.innerHTML = `<span style="color:${col}">● ${daysLabel(dl, lang)}</span>`;
        } else hintEl.innerHTML = "";
      }
    };

    const cell = (loc) => {
      const d = est.shelf_life[loc];
      const lm = this._locMeta(loc);
      return `<div class="ai-loc ${loc === m.location ? "active" : ""}" data-loccell="${loc}">
        <span class="ai-loc-emoji">${lm.emoji}</span>
        <span class="ai-days-wrap"><input class="ai-days" type="number" inputmode="numeric" min="0" max="3650" step="1" data-loc="${loc}" value="${d ?? ""}" placeholder="—"><i>${this.t("dayUnitShort")}</i></span>
        <small>${lm.label}</small>
      </div>`;
    };

    suggestEl.className = "suggest ai";
    suggestEl.innerHTML = `
      <div class="ai-head"><span class="s-emoji">${est.emoji || "✨"}</span><b>${this.t("aiEstimateTitle")}</b><span class="s-badge ai">AI · ${esc(res.estimate.provider || "")}</span></div>
      <div class="ai-sub">${this.t("aiHint")}</div>
      <div class="ai-locs">${this._state.locations.map(cell).join("")}</div>
      ${est.notes ? `<div class="s-sub">💡 ${esc(est.notes)}</div>` : ""}
      <label class="checkline"><input type="checkbox" id="s-savetpl" checked> ${this.t("saveAsTemplateLabel")}</label>
    `;
    suggestEl.querySelectorAll(".ai-days").forEach((inp) =>
      inp.addEventListener("input", () => {
        const raw = inp.value.trim();
        const v = raw === "" ? null : Math.min(3650, Math.max(0, parseInt(raw, 10) || 0));
        m.aiResult.shelf_life[inp.dataset.loc] = v && v > 0 ? v : null;
        recompute();
      })
    );
    recompute();
  }

  /* ---- TEMPLATE PICKER ---- */
  _openTemplatePicker(onPick) {
    const templates = this._state.templates;
    const kinds = this._state.kinds || {};
    let kindFilter = "all";
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><h3>${this.t("pickTemplateTitle")}</h3></div>
        <button class="icon-btn" id="tp-close">✕</button>
      </div>
      <div class="seg" id="tp-kinds">
        <button data-kind="all" class="on">${this.t("all")}</button>
        ${Object.keys(kinds).map((k) => { const km = this._kindMeta(k); return `<button data-kind="${k}">${km.emoji || ""} ${km.short}</button>`; }).join("")}
      </div>
      <div class="search big"><span>🔍</span><input id="tp-search" placeholder="${esc(this.t("searchInTemplates", templates.length))}" autocomplete="off"></div>
      <div class="tp-list" id="tp-list"></div>
    `, { wide: true });
    const listEl = h.modal.querySelector("#tp-list");
    const searchEl = h.modal.querySelector("#tp-search");
    const render = () => {
      const qq = (searchEl.value || "").trim().toLowerCase();
      const filtered = templates.filter((t) => {
        if (kindFilter !== "all" && this._kindOf(t) !== kindFilter) return false;
        if (!qq) return true;
        return t.name.toLowerCase().includes(qq) || (t.aliases || []).some((a) => a.toLowerCase().includes(qq));
      });
      listEl.innerHTML = filtered.map((t) => {
        const c = this._catMeta(t.category);
        const sl = t.shelf_life || {};
        return `<button class="tp-item" data-id="${t.id}">
          <span class="tp-emoji">${t.emoji || c.emoji || "🍽️"}</span>
          <span class="tp-name"><b>${esc(t.name)}</b><small>${this._kindMeta(this._kindOf(t)).emoji || ""} ${esc(c.label || t.category)}${t.source === "user" || t.source === "ai" ? this.t("ownSuffix") : ""}</small></span>
          <span class="tp-sl">${["fridge", "freezer", "pantry"].map((l) => sl[l] ? `<i>${({ fridge: "🧊", freezer: "❄️", pantry: "🧺" })[l]}${sl[l]}d</i>` : "").join("")}</span>
        </button>`;
      }).join("") || `<div class="empty small"><p>${this.t("nothingFound")}</p></div>`;
      listEl.querySelectorAll(".tp-item").forEach((b) =>
        b.addEventListener("click", () => {
          const t = templates.find((x) => x.id === b.dataset.id);
          h.close(); onPick(t);
        })
      );
    };
    render();
    searchEl.addEventListener("input", render);
    const kindsEl = h.modal.querySelector("#tp-kinds");
    kindsEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        kindFilter = b.dataset.kind;
        kindsEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        render();
      })
    );
    h.modal.querySelector("#tp-close").addEventListener("click", h.close);
    setTimeout(() => searchEl.focus(), 60);
  }

  /* ---- TEMPLATES MANAGER (view / edit / add — no AI required) ---- */
  _openTemplatesManager() {
    const kinds = this._state.kinds || {};
    let kindFilter = "all";
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><h3>${this.t("templatesTitle")}</h3></div>
        ${this._state.options.ai_enabled ? `<button class="btn ai icon-only" id="tm-ai" title="${this.t("templateWithAiTitle")}">✨</button>` : ""}
        <button class="btn primary icon-only" id="tm-new" title="${this.t("newTemplateTitleIcon")}">＋</button>
        <button class="icon-btn" id="tm-close">✕</button>
      </div>
      <div class="seg" id="tm-kinds">
        <button data-kind="all" class="on">${this.t("all")}</button>
        ${Object.keys(kinds).map((k) => { const km = this._kindMeta(k); return `<button data-kind="${k}">${km.emoji || ""} ${km.short}</button>`; }).join("")}
        ${(this._state.hidden || []).length ? `<button data-kind="hidden" title="${this.t("hiddenTemplatesTitle")}">🙈</button>` : ""}
      </div>
      <div class="search big"><span>🔍</span><input id="tm-search" placeholder="${this.t("searchOrFilterPlaceholder")}" autocomplete="off"></div>
      <div class="tp-list" id="tm-list"></div>
    `, { wide: true });
    const listEl = h.modal.querySelector("#tm-list");
    const searchEl = h.modal.querySelector("#tm-search");
    const render = () => {
      if (kindFilter === "hidden") {
        const hidden = this._state.hidden || [];
        listEl.innerHTML = hidden.map((t) => {
          const c = this._catMeta(t.category);
          return `<div class="tp-item"><span class="tp-emoji">${t.emoji || c.emoji || "🍽️"}</span>
            <span class="tp-name"><b>${esc(t.name)}</b><small>${esc(c.label || t.category)}</small></span>
            <button class="s-mini" data-unhide="${t.id}">${this.t("backBtn")}</button></div>`;
        }).join("") || `<div class="empty small"><p>${this.t("nothingHidden")}</p></div>`;
        listEl.querySelectorAll("[data-unhide]").forEach((b) =>
          b.addEventListener("click", async () => {
            await this._call("unhide_template", { template_id: b.dataset.unhide });
            this._toast(this.t("restoredToast")); render();
          }));
        return;
      }
      const qq = (searchEl.value || "").trim().toLowerCase();
      const templates = this._state.templates.filter((t) => {
        if (kindFilter !== "all" && this._kindOf(t) !== kindFilter) return false;
        if (!qq) return true;
        return t.name.toLowerCase().includes(qq)
          || (t.aliases || []).some((a) => a.toLowerCase().includes(qq))
          || (this._catMeta(t.category).label || "").toLowerCase().includes(qq);
      });
      listEl.innerHTML = templates.map((t) => {
        const c = this._catMeta(t.category);
        const sl = t.shelf_life || {};
        const badge = t.custom
          ? (t.builtin ? `<span class="tm-badge edit">${this.t("customizedBadge")}</span>` : `<span class="tm-badge own">${this.t("ownBadge")}</span>`)
          : "";
        return `<button class="tp-item" data-id="${t.id}">
          <span class="tp-emoji">${t.emoji || c.emoji || "🍽️"}</span>
          <span class="tp-name"><b>${esc(t.name)}${badge}</b><small>${this._kindMeta(this._kindOf(t)).emoji || ""} ${esc(c.label || t.category)}</small></span>
          <span class="tp-sl">${["fridge", "freezer", "pantry"].map((l) => sl[l] ? `<i>${({ fridge: "🧊", freezer: "❄️", pantry: "🧺" })[l]}${sl[l]}d</i>` : "").join("")}</span>
        </button>`;
      }).join("") || `<div class="empty small"><p>${this.t("nothingInGroup")}</p></div>`;
      listEl.querySelectorAll(".tp-item").forEach((b) =>
        b.addEventListener("click", () => {
          const t = this._state.templates.find((x) => x.id === b.dataset.id);
          this._openTemplateEditor(t, false, render);
        })
      );
    };
    render();
    searchEl.addEventListener("input", render);
    const kindsEl = h.modal.querySelector("#tm-kinds");
    kindsEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        kindFilter = b.dataset.kind;
        kindsEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        render();
      })
    );
    h.modal.querySelector("#tm-close").addEventListener("click", h.close);
    h.modal.querySelector("#tm-new").addEventListener("click", () => this._openTemplateEditor(null, true, render));
    const tmAi = h.modal.querySelector("#tm-ai");
    if (tmAi) tmAi.addEventListener("click", () => this._aiNewTemplate(render));
    setTimeout(() => searchEl.focus(), 60);
  }

  /* Create a template with AI: name in -> estimate -> prefilled editor to tweak & save. */
  _aiNewTemplate(onChanged) {
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-emoji">✨</div>
        <div class="m-title"><h3>${this.t("templateWithAiTitle")}</h3><div class="s-sub">${this.t("templateWithAiSub")}</div></div>
        <button class="icon-btn" id="ai-close">✕</button>
      </div>
      <label class="field"><span>${this.t("productOrDishLabel")}</span><input id="ai-name" placeholder="${this.t("productOrDishPlaceholder")}" enterkeyhint="go" autocomplete="off"></label>
      <div class="modal-actions"><button class="btn ai" id="ai-go">${this.t("estimateWithAiBtn")}</button></div>
    `);
    const q = (s) => h.modal.querySelector(s);
    const nameEl = q("#ai-name");
    q("#ai-close").addEventListener("click", h.close);
    const run = async () => {
      const name = (nameEl.value || "").trim();
      if (name.length < 2) { nameEl.focus(); return; }
      const btn = q("#ai-go");
      btn.disabled = true; btn.textContent = this.t("aiThinking");
      let res;
      try { res = await this._call("estimate", { name }); }
      catch (e) {
        btn.disabled = false; btn.textContent = this.t("estimateWithAiBtn");
        this._toast(this.t("aiErrorPrefix") + (e.message || e), { type: "bad" });
        return;
      }
      const est = res.estimate;
      h.close();
      this._openTemplateEditor({
        name, emoji: est.emoji, icon: est.icon, category: est.category,
        kind: est.kind, shelf_life: est.shelf_life, aliases: [], notes: est.notes,
        custom: false, builtin: false,
      }, true, onChanged);
    };
    q("#ai-go").addEventListener("click", run);
    nameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    setTimeout(() => nameEl.focus(), 60);
  }

  _openTemplateEditor(tpl, isNew, onChanged) {
    const cats = this._state.categories;
    const locs = this._state.locations;
    const t = tpl || { name: "", emoji: "", category: "other", shelf_life: {}, aliases: [], notes: "" };
    const catOf = (k) => this._catMeta(k) || this._catMeta("other");
    const kinds = this._state.kinds || {};
    const curKind = t.kind || this._kindOf(t);
    const sl = t.shelf_life || {};
    const catOptions = Object.keys(cats).map((k) => {
      const cm = this._catMeta(k);
      return `<option value="${k}" ${k === (t.category || "other") ? "selected" : ""}>${cm.emoji} ${cm.label}</option>`;
    }).join("");
    const dayField = (loc) => {
      const lm = this._locMeta(loc);
      return `<label class="field"><span>${lm.emoji} ${lm.label}</span><input type="number" inputmode="numeric" min="0" max="3650" class="te-day" data-loc="${loc}" value="${sl[loc] ?? ""}" placeholder="${this.t("notApplicablePlaceholder")}"></label>`;
    };
    const isBuiltin = !!t.builtin;
    const isOverride = !!(t.custom && t.builtin);
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-emoji" id="te-prev">${t.emoji || catOf(t.category).emoji}</div>
        <div class="m-title"><h3>${isNew ? this.t("newTemplateHeading") : this.t("editTemplateHeading")}</h3>
          ${!isNew ? `<div class="s-sub">${isOverride ? this.t("overrideNote") : (t.builtin ? this.t("builtinNote") : this.t("ownTemplateNote"))}</div>` : ""}
        </div>
        <button class="icon-btn" id="te-close">✕</button>
      </div>
      <div class="grid2">
        <label class="field"><span>${this.t("nameLabel")}</span><input id="te-name" value="${esc(t.name)}" placeholder="${this.t("namePlaceholderTemplate")}"></label>
        <label class="field"><span>${this.t("emojiLabel")}</span><input id="te-emoji" maxlength="4" value="${esc(t.emoji || "")}" placeholder="🥫"></label>
      </div>
      <label class="field"><span>${this.t("kindLabel")}</span>
        <div class="seg" id="te-kind">${Object.keys(kinds).map((k) => { const km = this._kindMeta(k); return `<button type="button" data-kind="${k}" class="${curKind === k ? "on" : ""}">${km.emoji || ""} ${km.short}</button>`; }).join("")}</div>
      </label>
      <label class="field"><span>${this.t("categoryLabel")}</span><div class="select-wrap"><select id="te-cat">${catOptions}</select></div></label>
      <div class="te-sec">${this.t("shelfLifeSectionLabel")}</div>
      <div class="grid3">${locs.map(dayField).join("")}</div>
      <label class="field"><span>${this.t("aliasesLabel")}</span><input id="te-aliases" value="${esc((t.aliases || []).join(", "))}" placeholder="${this.t("aliasesPlaceholder")}"></label>
      <label class="field"><span>${this.t("notesTipLabel")}</span><input id="te-notes" value="${esc(t.notes || "")}" placeholder="${this.t("notesTipPlaceholder")}"></label>
      <div class="modal-actions ${!isNew ? "with-del" : ""}">
        ${isOverride ? `<button class="btn ghost" id="te-reset">${this.t("restoreDefaultBtn")}</button>` : ""}
        ${!isNew ? `<button class="btn ghost danger-text" id="te-del">${isBuiltin ? this.t("builtinRemoveBtn") : this.t("customRemoveBtn")}</button>` : ""}
        <button class="btn primary" id="te-save">${this.t("saveBtn")}</button>
      </div>
    `);
    const q = (s) => h.modal.querySelector(s);
    const prev = q("#te-prev");
    const syncPrev = () => { prev.textContent = (q("#te-emoji").value || "").trim() || catOf(q("#te-cat").value).emoji; };
    q("#te-emoji").addEventListener("input", syncPrev);
    q("#te-cat").addEventListener("change", syncPrev);
    let selKind = curKind;
    const kindEl = q("#te-kind");
    if (kindEl) kindEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        selKind = b.dataset.kind;
        kindEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      }));
    q("#te-close").addEventListener("click", h.close);
    q("#te-save").addEventListener("click", async () => {
      const name = (q("#te-name").value || "").trim();
      if (!name) { q("#te-name").focus(); return; }
      const shelf = {};
      h.modal.querySelectorAll(".te-day").forEach((inp) => {
        const v = inp.value.trim() === "" ? null : Math.min(3650, Math.max(0, parseInt(inp.value, 10) || 0));
        shelf[inp.dataset.loc] = v && v > 0 ? v : null;
      });
      const cat = q("#te-cat").value;
      const template = {
        name,
        emoji: (q("#te-emoji").value || "").trim() || catOf(cat).emoji,
        icon: (tpl && tpl.icon) || catOf(cat).icon,
        category: cat,
        kind: selKind,
        shelf_life: shelf,
        aliases: (q("#te-aliases").value || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
        notes: (q("#te-notes").value || "").trim(),
        source: "user",
      };
      if (tpl && tpl.id) template.id = tpl.id; // keep id → overrides builtin / updates own
      q("#te-save").disabled = true;
      try {
        await this._call("add_template", { template });
        h.close();
        this._toast(isNew ? this.t("templateAddedToast") : this.t("templateSavedToast"));
        onChanged && onChanged();
      } catch (e) {
        q("#te-save").disabled = false;
        this._toast(this.t("errorPrefix") + (e.message || e), { type: "bad" });
      }
    });
    const reset = q("#te-reset");
    if (reset) reset.addEventListener("click", async () => {
      await this._call("remove_template", { template_id: tpl.id });
      h.close();
      this._toast(this.t("restoredDefaultToast"));
      onChanged && onChanged();
    });
    const del = q("#te-del");
    if (del) del.addEventListener("click", async () => {
      if (isBuiltin) await this._call("hide_template", { template_id: tpl.id });
      else await this._call("remove_template", { template_id: tpl.id });
      h.close();
      this._toast(isBuiltin ? this.t("removedFromListToast") : this.t("templateDeletedToast"));
      onChanged && onChanged();
    });
    setTimeout(() => q("#te-name").focus(), 60);
  }

  /* ---- ITEM DETAIL ---- */
  _openItemModal(i) {
    const lm = this._locMeta(i.location);
    const col = STATUS_COLOR[i.status];
    const lang = this._lang();
    const h = this._openModal(`
      <div class="detail-head" style="--c:${col}">
        <div class="d-emoji">${i.emoji || "🍽️"}</div>
        <div class="d-title"><h2>${esc(i.name)}</h2><div class="d-code">${esc(i.code)}</div></div>
        <button class="icon-btn" id="d-close">✕</button>
      </div>
      <div class="d-status" style="--c:${col}">${daysLabel(i.days_left, lang)}${i.expiry_date ? " · " + fmtDate(i.expiry_date, lang) : ""}</div>
      <div class="d-rows">
        <div class="d-row"><span>${this.t("locationLabel")}</span><b>${lm.emoji || ""} ${esc(lm.label || i.location)}</b></div>
        ${i.added_by_name ? `<div class="d-row"><span>${this.t("addedByLabel")}</span><b class="who">${this._avatar(i.added_by_name, i.added_by_picture, 24)} ${esc(i.added_by_name)}</b></div>` : ""}
        ${i.contents && i.contents !== i.name ? `<div class="d-row"><span>${this.t("contentsLabel")}</span><b>${esc(i.contents)}</b></div>` : ""}
        <div class="d-row"><span>${this.t("dateInDetailLabel")}</span><b>${fmtDate(i.added_date, lang)}${i.age_days != null ? ` · ${esc(this.t("daysAgoShort", i.age_days))}` : ""}</b></div>
        <div class="d-row"><span>${this.t("expiryLabel")}</span><b>${i.expiry_date ? fmtDate(i.expiry_date, lang) : "—"}</b></div>
        ${i.quantity ? `<div class="d-row"><span>${this.t("quantityLabel")}</span><b>${esc(i.quantity)}</b></div>` : ""}
        ${i.notes ? `<div class="d-row"><span>${this.t("notesLabel")}</span><b>${esc(i.notes)}</b></div>` : ""}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="d-print">${this.t("stickerBtn")}</button>
        <button class="btn ghost" id="d-edit">${this.t("editBtn")}</button>
      </div>
      <div class="modal-actions done-row">
        <button class="btn good" id="d-eaten">${this.t("eatenBtn")}</button>
        <button class="btn tossed" id="d-tossed">${this.t("tossedBtn")}</button>
      </div>
    `);
    const q = (s) => h.modal.querySelector(s);
    q("#d-close").addEventListener("click", h.close);
    q("#d-print").addEventListener("click", () => this._printSticker(i.id));
    q("#d-edit").addEventListener("click", () => { h.close(); this._openAddModal({}, i); });
    q("#d-eaten").addEventListener("click", () => this._completeItem(i, "eaten", h.close));
    q("#d-tossed").addEventListener("click", () => this._completeItem(i, "tossed", h.close));
  }

  async _completeItem(item, action, close) {
    let ev = null;
    try {
      const res = await this._call("complete_item", { item_id: item.id, action });
      ev = res && res.event;
    } catch (e) {
      this._toast(this.t("errorPrefix") + (e.message || e), { type: "bad" });
      return;
    }
    close && close();
    const eaten = action === "eaten";
    this._toast(
      this.t("completedToast", eaten ? "🍽️" : "🗑️", esc(item.name), eaten),
      ev ? { actionLabel: this.t("undoLabel"), onAction: () => this._call("restore_item", { event_id: ev.id }).catch(() => {}) } : {}
    );
  }

  async _eatScanned(raw, setStatus, count) {
    const val = String(raw || "").trim().toUpperCase();
    if (!(/^[A-Z]{2}\d{2}$/.test(val) || /^\d{2}[A-Z]{2}$/.test(val))) {
      setStatus(this.t("notOwnLabel", val));
      return;
    }
    const item = (this._state.items || []).find((i) => (i.code || "").toUpperCase() === val);
    if (!item) { setStatus(this.t("noActiveItemWithCode", val)); return; }
    let ev = null;
    try {
      const res = await this._call("complete_item", { item_id: item.id, action: "eaten" });
      ev = res && res.event;
    } catch (e) { setStatus(this.t("couldNotEatRetry")); return; }
    count.n = (count.n || 0) + 1;
    setStatus(this.t("eatenStatusCount", item.name, count.n));
    this._toast(this.t("completedToast", "🍽️", esc(item.name), true),
      ev ? { actionLabel: this.t("undoLabel"), onAction: () => this._call("restore_item", { event_id: ev.id }).catch(() => {}) } : {});
  }

  /* ---- CLEAN MODE ---- */
  _openCleanModal() {
    const expired = this._state.items.filter((i) => i.status === "expired");
    const soon = this._state.items.filter((i) => i.status === "soon");
    const lang = this._lang();
    const row = (i, checked) => {
      const lm = this._locMeta(i.location);
      return `<label class="clean-row">
        <input type="checkbox" data-id="${i.id}" ${checked ? "checked" : ""}>
        <span class="cr-emoji">${i.emoji || "🍽️"}</span>
        <span class="cr-name"><b>${esc(i.name)}</b><small>${lm.emoji || ""} ${esc(lm.label || i.location)} · ${esc(i.code)}</small></span>
        <span class="cr-days" style="--c:${STATUS_COLOR[i.status]}">${daysLabel(i.days_left, lang)}</span>
      </label>`;
    };
    const h = this._openModal(`
      <div class="modal-head"><div class="m-title"><h3>${this.t("cleanUpTitle")}</h3></div><button class="icon-btn" id="c-close">✕</button></div>
      ${expired.length ? `<div class="clean-sec">${this.t("expiredSection")}</div>${expired.map((i) => row(i, true)).join("")}` : ""}
      ${soon.length ? `<div class="clean-sec">${this.t("soonSection")}</div>${soon.map((i) => row(i, false)).join("")}` : ""}
      ${!expired.length && !soon.length ? `<div class="empty small"><div class="empty-emoji">✨</div><p>${this.t("allGoodMessage")}</p></div>` : ""}
      ${(expired.length || soon.length) ? `<div class="modal-actions"><button class="btn danger" id="c-remove">${this.t("removeSelectedBtn")}</button></div>` : ""}
    `, { wide: true });
    const q = (s) => h.modal.querySelector(s);
    q("#c-close").addEventListener("click", h.close);
    const rm = q("#c-remove");
    const updateBtn = () => {
      const n = h.modal.querySelectorAll("input[data-id]:checked").length;
      if (rm) { rm.textContent = n ? this.t("removeNItems", n) : this.t("nothingSelected"); rm.disabled = !n; }
    };
    h.modal.querySelectorAll("input[data-id]").forEach((c) => c.addEventListener("change", updateBtn));
    updateBtn();
    if (rm) rm.addEventListener("click", async () => {
      const ids = [...h.modal.querySelectorAll("input[data-id]:checked")].map((c) => c.dataset.id);
      if (!ids.length) return;
      rm.disabled = true;
      const res = await this._call("remove_expired", { ids });
      h.close();
      this._toast(this.t("cleanedUpToast", res.count));
    });
  }

  /* ---- BARCODE SCANNER ---- */
  async _makeDetector() {
    const wanted = ["code_39", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"];
    let formats;
    try {
      const sup = await window.BarcodeDetector.getSupportedFormats();
      formats = wanted.filter((f) => sup.includes(f));
    } catch (e) { /* fall back to all formats */ }
    return formats && formats.length
      ? new window.BarcodeDetector({ formats })
      : new window.BarcodeDetector();
  }

  _loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!this._zxingPromise) {
      this._zxingPromise = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "/fridge_assistant_static/zxing.min.js";
        s.onload = () => resolve(window.ZXing || null);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      });
    }
    return this._zxingPromise;
  }

  async _openScanner() {
    const bd = "BarcodeDetector" in window;
    const zxing = bd ? null : await this._loadZXing();   // decoder for iOS etc.
    const decodable = bd || !!zxing;
    const canLive = decodable && window.isSecureContext
      && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><div class="m-strong">${this.t("scanTitle")}</div>
          <div class="m-sub">${this.t("scanSub")}</div></div>
        <button class="icon-btn" id="sc-close">✕</button>
      </div>
      <div class="seg sc-mode" id="sc-mode">
        <button type="button" data-mode="find" class="on">${this.t("searchModeBtn")}</button>
        <button type="button" data-mode="eat">${this.t("eatModeBtn")}</button>
      </div>
      <div class="scanbox${canLive ? "" : " hidden"}" id="sc-box">
        <video id="sc-video" playsinline muted></video><div class="scan-frame"></div>
        <button class="icon-btn scan-torch hidden" id="sc-torch" title="${this.t("torchTooltip")}">🔦</button>
      </div>
      <div class="scan-status" id="sc-status"></div>
      <div class="modal-actions">
        ${decodable ? `<label class="btn ghost filepick">${this.t("photoBtn")}<input id="sc-file" type="file" accept="image/*" capture="environment"></label>` : ""}
        <button class="btn ghost" id="sc-manual">${this.t("typeCodeBtn")}</button>
      </div>
    `, { wide: false });
    const q = (s) => h.modal.querySelector(s);
    let stopped = false, stream = null, timer = null, reader = null;
    const stop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (reader) { try { reader.reset(); } catch (e) { /* ignore */ } reader = null; }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    };
    let mode = "find", lastCode = "", lastTs = 0;
    const eatCount = { n: 0 };
    const setStatus = (t) => { const s = q("#sc-status"); if (s) s.textContent = t; };
    // Debounced router: search opens the item; eat marks it eaten and keeps scanning.
    const handle = (raw) => {
      const now = Date.now();
      if (raw === lastCode && now - lastTs < 2500) return;
      lastCode = raw; lastTs = now;
      if (mode === "eat") this._eatScanned(raw, setStatus, eatCount);
      else { stop(); this._onScan(raw, h); }
    };
    const modeEl = q("#sc-mode");
    modeEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.dataset.mode;
        modeEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        setStatus(mode === "eat" ? this.t("eatModeStatus") : this.t("aimAtBarcode"));
      }));
    q("#sc-close").addEventListener("click", () => { stop(); h.close(); });

    q("#sc-manual").addEventListener("click", () => {
      stop();
      const box = q("#sc-box"); if (box) box.classList.add("hidden");
      q("#sc-status").innerHTML = `<div class="scan-manual"><input id="sc-code" placeholder="${this.t("codeInputPlaceholder")}" autocomplete="off" autocapitalize="characters" enterkeyhint="search"><button class="btn primary" id="sc-go">${this.t("searchBtn")}</button></div>`;
      const go = () => { const v = (q("#sc-code").value || "").trim(); if (v) handle(v); };
      q("#sc-go").addEventListener("click", go);
      q("#sc-code").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
      setTimeout(() => q("#sc-code") && q("#sc-code").focus(), 60);
    });

    const fileEl = q("#sc-file");
    if (fileEl) fileEl.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      q("#sc-status").textContent = this.t("readingPhoto");
      try {
        let raw = null;
        if (bd) {
          const det = await this._makeDetector();
          const codes = await det.detect(await createImageBitmap(f));
          if (codes && codes.length) raw = codes[0].rawValue;
        } else if (zxing) {
          const hints = new Map();
          hints.set(zxing.DecodeHintType.TRY_HARDER, true);
          const url = URL.createObjectURL(f);
          try { const r = await new zxing.BrowserMultiFormatReader(hints).decodeFromImageUrl(url); raw = r && r.getText(); }
          finally { URL.revokeObjectURL(url); }
        }
        if (raw) { handle(raw); return; }
        q("#sc-status").textContent = this.t("noBarcodeFound");
      } catch (err) { q("#sc-status").textContent = this.t("noBarcodeFound"); }
    });

    if (!canLive) {
      q("#sc-status").textContent = decodable ? this.t("takePhotoOfBarcode") : this.t("liveScanUnavailable");
      if (!decodable) setTimeout(() => q("#sc-manual").click(), 0);
      return;
    }

    const video = q("#sc-video");
    q("#sc-status").textContent = this.t("aimAtBarcode");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          aspectRatio: { ideal: 4 / 3 },
        },
      });
    } catch (err) {
      q("#sc-box").classList.add("hidden");
      q("#sc-status").textContent = this.t("noCameraAccess");
      return;
    }
    video.srcObject = stream;
    try { await video.play(); } catch (e) { /* autoplay quirks */ }

    // Flashlight toggle, only shown when the track actually supports it.
    const track = stream.getVideoTracks()[0];
    const torchBtn = q("#sc-torch");
    let torchOn = false;
    try {
      if (track.getCapabilities && track.getCapabilities().torch && torchBtn) {
        torchBtn.classList.remove("hidden");
        torchBtn.addEventListener("click", async () => {
          const next = !torchOn;
          try { await track.applyConstraints({ advanced: [{ torch: next }] }); torchOn = next; torchBtn.classList.toggle("on", torchOn); }
          catch (e) { /* device refused mid-toggle, leave state as-is */ }
        });
      }
    } catch (e) { /* getCapabilities unsupported (e.g. older iOS) — no flashlight button */ }

    if (bd) {
      // Android/Chromium: native detector on the full frame (proven path).
      const det = await this._makeDetector();
      const tick = async () => {
        if (stopped || !video.isConnected) { stop(); return; }
        try {
          const codes = await det.detect(video);
          if (codes && codes.length) { handle(codes[0].rawValue); return; }
        } catch (e) { /* transient decode error */ }
        if (!stopped) timer = setTimeout(tick, 170);
      };
      tick();
    } else {
      // iOS etc.: ZXing. Decode a native-resolution crop of the .scan-frame
      // region so you can back off to a focusable distance while the barcode
      // still fills the decoder's view. reader.decode(canvas) is broken in this
      // bundle (it reads canvas.naturalWidth → undefined), so build the
      // BinaryBitmap by hand from our own canvas.
      const hints = new Map();
      hints.set(zxing.DecodeHintType.TRY_HARDER, true);
      reader = new zxing.BrowserMultiFormatReader(hints);
      const crop = document.createElement("canvas");
      const cropCtx = crop.getContext("2d", { willReadFrequently: true });
      const decodeCrop = () => {
        const source = new zxing.HTMLCanvasElementLuminanceSource(crop);
        const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source));
        return reader.decodeBitmap(bitmap);   // throws NotFoundException if none
      };
      const tick = async () => {
        if (stopped || !video.isConnected) { stop(); return; }
        const vw = video.videoWidth, vh = video.videoHeight;
        if (vw && vh) {
          const sx = Math.round(vw * 0.08), sy = Math.round(vh * 0.30);
          const sw = Math.round(vw * 0.84), sh = Math.round(vh * 0.40);
          if (crop.width !== sw) crop.width = sw;
          if (crop.height !== sh) crop.height = sh;
          cropCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
          try {
            const result = decodeCrop();
            if (result) { handle(result.getText()); return; }
          } catch (e) { /* no barcode in this frame */ }
        }
        if (!stopped) timer = setTimeout(tick, 150);
      };
      tick();
    }
  }

  _onScan(raw, h) {
    const val = String(raw || "").trim().toUpperCase();
    if (h && h.close) h.close();
    // Our own label: 2 letters + 2 digits, either order (AB12 / 12AB).
    if (/^[A-Z]{2}\d{2}$/.test(val) || /^\d{2}[A-Z]{2}$/.test(val)) {
      const item = (this._state.items || []).find((i) => (i.code || "").toUpperCase() === val);
      if (item) { this._openItemModal(item); this._toast(this.t("foundToast", esc(item.name))); }
      else this._toast(this.t("noActiveItemHistoryHint", esc(val)), { type: "bad" });
      return;
    }
    // Public retail barcode: EAN-8/13 or UPC (8–14 digits).
    if (/^\d{8,14}$/.test(val)) { this._onRetailBarcode(val); return; }
    this._toast(this.t("unknownCode", esc(val)), { type: "bad" });
  }

  async _onRetailBarcode(code) {
    // Resolve server-side: our own memory first, then OpenFoodFacts (no key).
    this._toast(this.t("lookingUpProduct", code));
    let res = null;
    try { res = await this._call("lookup_barcode", { barcode: code }); }
    catch (e) { /* offline / not ready — fall through */ }
    const src = (res && (res.known || res.product)) || null;

    if (!src || !src.name) {
      this._openAddModal({ notes: this.t("retailBarcodeNote", code), barcode: code });
      this._toast(this.t("noProductNameFound", code), { type: "bad" });
      return;
    }
    const known = !!(res && res.known);
    this._openAddModal({
      name: src.name,
      category: src.category || null,
      quantity: src.quantity || "",
      photo: src.photo || "",
      emoji: src.emoji || undefined,
      kind: src.kind || undefined,
      notes: known ? "" : this.t("retailBarcodeNote", code),
      barcode: code,
    });
    this._toast(known ? this.t("recognizedBefore") : this.t("productFoundToast", src.name));
  }

  /* ---- HISTORY (paged) ---- */
  _relTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d)) return "";
    const lang = this._lang();
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return this.t("justNow");
    const m = Math.floor(s / 60);
    if (m < 60) return this.t("minutesAgo", m);
    const hh = Math.floor(m / 60);
    if (hh < 24) return this.t("hoursAgo", hh);
    const dd = Math.floor(hh / 24);
    if (dd === 1) return this.t("yesterday");
    if (dd < 7) return this.t("daysAgo", dd);
    return `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`;
  }

  _historyRow(e) {
    const it = e.item || {};
    const lm = this._locMeta(it.location);
    const eaten = e.action === "eaten";
    const act = `<span class="hi-act ${eaten ? "eaten" : "tossed"}">${eaten ? this.t("eatenBtn") : this.t("tossedBtn")}</span>`;
    const who = e.by_name
      ? `<span class="who">${this._avatar(e.by_name, e.by_picture, 18)}${esc(e.by_name)}</span>`
      : `<span class="muted">—</span>`;
    return `<div class="hi-row">
      <span class="hi-emoji">${it.emoji || "🍽️"}</span>
      <div class="hi-main">
        <div class="hi-title">${esc(it.name || "?")} ${it.code ? `<span class="code">${esc(it.code)}</span>` : ""}</div>
        <div class="hi-sub2">${act}${it.location ? ` · ${lm.emoji || ""} ${esc(lm.label || it.location)}` : ""}</div>
      </div>
      <div class="hi-right">${who}<div class="hi-time">${esc(this._relTime(e.ts))}</div>
        <button class="hi-undo" data-restore="${esc(e.id)}" title="${this.t("restoreToFridgeTitle")}">${this.t("backBtn")}</button>
      </div>
    </div>`;
  }

  _openHistory() {
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><h3>${this.t("historyHeading")}</h3><div class="s-sub" id="hi-sub"></div></div>
        <button class="icon-btn" id="hi-close">✕</button>
      </div>
      <div class="tp-list" id="hi-list"><div class="loading">${this.t("loading")}</div></div>
      <div class="modal-actions" id="hi-more-wrap" style="display:none">
        <button class="btn ghost" id="hi-more">${this.t("loadMoreBtn")}</button>
      </div>
    `, { wide: true });
    const q = (s) => h.modal.querySelector(s);
    q("#hi-close").addEventListener("click", h.close);
    const PAGE = 25;
    let offset = 0, total = 0;
    const loaded = [];
    const listEl = q("#hi-list");
    const load = async () => {
      const more = q("#hi-more");
      if (more) more.disabled = true;
      let res;
      try { res = await this._call("history", { limit: PAGE, offset }); }
      catch (e) { listEl.innerHTML = `<div class="empty small"><p>${this.t("historyLoadFailed")}</p></div>`; return; }
      total = res.total;
      loaded.push(...(res.events || []));
      offset += (res.events || []).length;
      if (!loaded.length) {
        listEl.innerHTML = `<div class="empty small"><div class="empty-emoji">📭</div><p>${this.t("historyEmpty")}</p></div>`;
      } else {
        listEl.innerHTML = loaded.map((e) => this._historyRow(e)).join("");
        listEl.querySelectorAll("[data-restore]").forEach((b) =>
          b.addEventListener("click", async () => {
            const id = b.dataset.restore;
            b.disabled = true;
            try { await this._call("restore_item", { event_id: id }); }
            catch (e) { b.disabled = false; this._toast(this.t("restoreFailedToast"), { type: "bad" }); return; }
            const idx = loaded.findIndex((x) => x.id === id);
            if (idx >= 0) loaded.splice(idx, 1);
            total = Math.max(0, total - 1);
            offset = Math.max(0, offset - 1);
            const row = b.closest(".hi-row"); if (row) row.remove();
            q("#hi-sub").textContent = total ? this.t("historySummary", total) : "";
            this._toast(this.t("restoredToFridgeToast"));
          }));
      }
      q("#hi-sub").textContent = total ? this.t("historySummary", total) : "";
      const wrap = q("#hi-more-wrap");
      if (offset < total) { wrap.style.display = ""; if (more) more.disabled = false; }
      else wrap.style.display = "none";
    };
    q("#hi-more").addEventListener("click", load);
    load();
  }

  _printSticker(id, itemHint = null) {
    // itemHint covers the just-added case: the state push may not have
    // landed yet, but the add response already has name/code.
    const item = (this._state.items || []).find((x) => x.id === id) || itemHint;
    const opts = this._state.options || {};
    const p = this._state.printer || {};
    const copies = opts.label_copies || 1;
    const note = opts.printer_enabled
      ? this.t("printerOnNote", esc(p.label || "99014"), esc(p.label_size || "54 × 101 mm"), copies)
      : this.t("printerOffNote", esc(p.label || "99014"), esc(p.label_size || "54 × 101 mm"));

    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><div class="m-strong">${this.t("printStickerModalTitle")}</div>
          <div class="m-sub">${esc(item?.name || "")} · <code>${esc(item?.code || "")}</code></div>
        </div>
        <button class="icon-btn" id="p-close">✕</button>
      </div>
      <div class="label-preview" id="p-preview"><div class="muted">${this.t("previewLoading")}</div></div>
      <div class="print-note">${note}</div>
      <div class="modal-actions">
        <button class="btn ghost" id="p-cancel">${this.t("closeBtn")}</button>
        <button class="btn primary" id="p-print">${this.t("printBtnLabel", copies)}</button>
      </div>
    `, { wide: false });
    const q = (s) => h.modal.querySelector(s);
    q("#p-close").addEventListener("click", h.close);
    q("#p-cancel").addEventListener("click", h.close);

    (async () => {
      try {
        const r = await this._call("render_label", { item_id: id });
        q("#p-preview").innerHTML = `<img alt="Label ${esc(item?.code || "")}" src="data:image/png;base64,${r.png_base64}">`;
      } catch (e) {
        q("#p-preview").innerHTML = `<div class="muted">${esc(this.t("previewUnavailable", e.message || e))}</div>`;
      }
    })();

    q("#p-print").addEventListener("click", async () => {
      const btn = q("#p-print");
      btn.disabled = true; btn.textContent = this.t("workingLabel");
      try {
        const res = await this._call("print_sticker", { item_id: id });
        if (res.printed) {
          this._toast(this.t("stickerPrintedToast", res.code, res.copies || 1));
          h.close();
          return;
        }
        const map = {
          printer_disabled: this.t("printerDisabledReason"),
          printer_unreachable: this.t("printerUnreachableReason"),
          printer_not_connected: this.t("printerNotConnectedReason"),
          render_failed: this.t("renderFailedReason"),
        };
        this._toast("🖨️ " + (map[res.reason] || this.t("genericPrintFailed", res.reason)), { type: "bad" });
        btn.disabled = false; btn.textContent = this.t("printBtnLabel", copies);
      } catch (e) {
        this._toast(this.t("printFailedError", e.message || e), { type: "bad" });
        btn.disabled = false; btn.textContent = this.t("printBtnLabel", copies);
      }
    });
  }

  /* ---- TOAST ---- */
  _toast(msg, { actionLabel, onAction, type = "" } = {}) {
    const root = this.shadowRoot.getElementById("toast-root");
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    if (actionLabel) {
      const b = document.createElement("button");
      b.textContent = actionLabel;
      b.addEventListener("click", () => { onAction && onAction(); t.remove(); });
      t.appendChild(b);
    }
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 250); }, actionLabel ? 6000 : 3200);
  }
}

const STYLES = `
:host{
  --fa-accent:#007AFF; --fa-red:#FF3B30; --fa-orange:#FF9500; --fa-green:#34C759;
  --fa-bg:var(--primary-background-color,#f5f5f7);
  --fa-card:var(--card-background-color,#fff);
  --fa-text:var(--primary-text-color,#1d1d1f);
  --fa-muted:var(--secondary-text-color,#86868b);
  --fa-border:var(--divider-color,rgba(0,0,0,.1));
  display:block; height:100%; background:var(--fa-bg); color:var(--fa-text);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,system-ui,sans-serif;
}
*{box-sizing:border-box;}
.wrap{max-width:960px;margin:0 auto;padding:16px 16px 96px;}
.topbar{position:sticky;top:0;z-index:5;padding:14px 4px;background:linear-gradient(var(--fa-bg),var(--fa-bg) 70%,transparent);}
.brand{display:flex;align-items:center;gap:10px;}
.brand-emoji{font-size:26px;}
.brand h1{font-size:26px;font-weight:700;margin:0;letter-spacing:-.02em;}
.counts{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;}
.pill{background:var(--fa-card);border:1px solid var(--fa-border);border-radius:999px;padding:5px 12px;font-size:13px;color:var(--fa-muted);}
.pill b{color:var(--fa-text);}
.pill.warn{color:var(--fa-orange);} .pill.warn b{color:var(--fa-orange);}
.pill.bad{color:var(--fa-red);} .pill.bad b{color:var(--fa-red);}
.top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.search{display:flex;align-items:center;gap:6px;background:var(--fa-card);border:1px solid var(--fa-border);border-radius:12px;padding:0 12px;height:40px;flex:1;min-width:140px;}
.search input{border:none;background:none;outline:none;color:var(--fa-text);font-size:15px;width:100%;}
.search.big{height:46px;margin:6px 0 12px;}
.filters{display:flex;gap:8px;overflow-x:auto;padding:6px 4px 12px;scrollbar-width:none;}
.filters::-webkit-scrollbar{display:none;}
.chip{white-space:nowrap;border:1px solid var(--fa-border);background:var(--fa-card);color:var(--fa-text);border-radius:999px;padding:7px 14px;font-size:14px;cursor:pointer;transition:.15s;}
.chip.active{background:var(--fa-accent);color:#fff;border-color:var(--fa-accent);}
.chip-n{opacity:.6;font-size:12px;margin-left:2px;}
.chip.active .chip-n{opacity:.85;}
.chip-sep{width:1px;flex:none;background:var(--fa-border);margin:4px 2px;}

.btn{border:none;border-radius:12px;padding:0 16px;height:40px;font-size:15px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:.15s;}
.btn.small{height:40px;padding:0 13px;font-size:14px;}
.btn.primary{background:var(--fa-accent);color:#fff;}
.btn.primary:hover{filter:brightness(1.08);transform:translateY(-1px);}
.btn.ghost{background:var(--fa-card);color:var(--fa-text);border:1px solid var(--fa-border);}
.btn.good{background:var(--fa-green);color:#fff;}
.btn.danger{background:var(--fa-red);color:#fff;width:100%;}
.btn.ai{background:linear-gradient(135deg,#7B61FF,#B06AFF);color:#fff;}
.btn:disabled{opacity:.5;cursor:default;transform:none;}
.icon-btn{border:none;background:transparent;color:var(--fa-muted);font-size:18px;cursor:pointer;width:40px;height:40px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;}
.icon-btn:hover{background:var(--fa-border);}
.link{background:none;border:none;color:var(--fa-accent);cursor:pointer;font-size:14px;padding:8px 2px;font-weight:500;}

.cards{display:flex;flex-direction:column;gap:8px;}
.card{display:flex;align-items:center;gap:10px;background:var(--fa-card);border:1px solid var(--fa-border);border-radius:16px;padding:11px 12px;cursor:pointer;transition:.15s;position:relative;}
.card:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.08);}
.card-emoji{font-size:26px;width:38px;text-align:center;flex:none;}
.card-main{flex:1;min-width:0;}
.card-title{font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.card-sub{display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:nowrap;overflow:hidden;font-size:12px;color:var(--fa-muted);}
.cs-fix,.cs-sep,.card-sub .code{flex:none;}
.cs-more{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tag{font-size:12px;color:var(--fa-muted);}
.code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;background:var(--fa-border);border-radius:6px;padding:1px 6px;letter-spacing:.05em;}
.muted{color:var(--fa-muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}
.card-right{text-align:right;flex:none;}
.who{display:inline-flex;align-items:center;gap:5px;}
.card-sub .who{font-size:12px;color:var(--fa-muted);}
.avatar{border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;background:var(--fa-border);}
.avatar-i{color:#fff;font-weight:700;line-height:1;}
.d-row b.who{gap:7px;}
.status{font-size:13px;font-weight:600;color:var(--c);}
.card-when{font-size:11px;color:var(--fa-muted);margin-top:2px;display:flex;align-items:center;gap:5px;justify-content:flex-end;min-height:15px;}
.card-print{font-size:15px;flex:none;}

.strip{margin-bottom:16px;}
.strip-head{font-size:13px;font-weight:600;color:var(--fa-muted);margin:2px 4px 8px;}
.strip-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
.strip-row::-webkit-scrollbar{display:none;}
.ucard{flex:none;width:120px;background:var(--fa-card);border:1px solid var(--fa-border);border-top:3px solid var(--c);border-radius:14px;padding:12px 10px;cursor:pointer;transition:.15s;}
.ucard:hover{transform:translateY(-2px);}
.ucard-emoji{font-size:26px;}
.ucard-name{font-weight:600;font-size:14px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ucard-days{font-size:12px;color:var(--c);font-weight:600;margin-top:2px;}

.loading,.empty{text-align:center;color:var(--fa-muted);padding:60px 20px;}
.empty-emoji{font-size:52px;margin-bottom:12px;}
.empty h2{color:var(--fa-text);margin:0 0 6px;font-size:20px;}
.empty.small{padding:30px;}
.empty .btn{margin-top:14px;}

/* modal */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s;z-index:50;padding:0;}
.overlay.show{opacity:1;}
@media(min-width:640px){.overlay{align-items:center;padding:24px;}}
.modal{background:var(--fa-card);width:100%;max-width:520px;max-height:92vh;overflow-y:auto;overscroll-behavior:contain;border-radius:22px 22px 0 0;padding:18px;transform:translateY(24px);transition:transform .2s;box-shadow:0 -10px 40px rgba(0,0,0,.2);}
.modal.wide{max-width:600px;}
@media(min-width:640px){.modal{border-radius:22px;transform:translateY(12px) scale(.98);}}
.overlay.show .modal{transform:none;}
.modal-head{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.m-emoji{font-size:34px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:var(--fa-bg);border-radius:14px;flex:none;}
.m-title{flex:1;min-width:0;}
.m-title h2,.m-title h3{margin:0;font-size:19px;}
.m-name{width:100%;border:none;background:none;outline:none;font-size:19px;font-weight:600;color:var(--fa-text);border-bottom:2px solid var(--fa-border);padding:4px 0;}
.m-name:focus{border-color:var(--fa-accent);}
.m-strong{font-size:18px;font-weight:700;}
.m-sub{font-size:13px;color:var(--fa-muted);margin-top:2px;}
.m-sub code{font-family:ui-monospace,"SF Mono",Menlo,monospace;background:var(--fa-border);border-radius:5px;padding:1px 5px;}
.label-preview{display:flex;align-items:center;justify-content:center;min-height:220px;padding:14px;background:repeating-conic-gradient(var(--fa-bg) 0% 25%,var(--fa-border) 0% 50%) 0/22px 22px;border-radius:14px;}
.label-preview img{max-height:420px;width:auto;max-width:100%;border-radius:10px;box-shadow:0 4px 22px rgba(0,0,0,.25);background:#fff;}
.print-note{font-size:12.5px;color:var(--fa-muted);line-height:1.5;margin:12px 4px 0;text-align:center;}
.print-note b{color:var(--fa-text);}

.field{display:flex;flex-direction:column;gap:5px;margin:10px 0;}
.field>span{font-size:13px;color:var(--fa-muted);font-weight:500;}
.field input{min-width:0;width:100%;box-sizing:border-box;height:44px;border:1.5px solid var(--fa-border);border-radius:12px;padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);outline:none;transition:.15s;}
.field input:focus{border-color:var(--fa-accent);box-shadow:0 0 0 4px rgba(0,122,255,.1);}
.datefield{position:relative;min-width:0;}
.datefield input[type=date]{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;z-index:1;cursor:pointer;-webkit-appearance:none;appearance:none;}
.df-display{display:flex;align-items:center;gap:8px;height:44px;border:1.5px solid var(--fa-border);border-radius:12px;padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);white-space:nowrap;overflow:hidden;min-width:0;}
.df-display b{font-weight:600;}
.df-ico{flex:none;}
.df-ph{color:var(--fa-muted);overflow:hidden;text-overflow:ellipsis;}
.datefield input:focus + .df-display{border-color:var(--fa-accent);box-shadow:0 0 0 4px rgba(0,122,255,.1);}
.df-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:2;display:none;width:28px;height:28px;border:none;border-radius:50%;background:var(--fa-border);color:var(--fa-muted);font-size:13px;cursor:pointer;align-items:center;justify-content:center;padding:0;}
.datefield.has-value .df-clear{display:flex;}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;}
.expiry-hint{font-size:13px;font-weight:600;min-height:18px;margin:-2px 2px 4px;}

.seg{display:flex;gap:6px;background:var(--fa-bg);border-radius:12px;padding:4px;margin:12px 0;}
.seg button{flex:1;border:none;background:none;color:var(--fa-text);padding:9px 4px;border-radius:9px;font-size:14px;cursor:pointer;transition:.15s;}
.seg button.on{background:var(--fa-card);box-shadow:0 1px 4px rgba(0,0,0,.12);font-weight:600;}

.suggest{margin:4px 0 6px;padding:12px;border-radius:14px;background:var(--fa-bg);display:flex;align-items:center;gap:10px;min-height:10px;}
.suggest:empty{display:none;}
.suggest.ok{background:rgba(52,199,89,.12);}
.suggest.ai{background:rgba(123,97,255,.1);flex-direction:column;align-items:stretch;}
.suggest.bad{background:rgba(255,59,48,.12);}
.s-emoji{font-size:24px;}
.s-body{flex:1;min-width:0;}
.s-sub{font-size:12.5px;color:var(--fa-muted);margin-top:2px;}
.s-badge{font-size:10px;text-transform:uppercase;letter-spacing:.06em;background:var(--fa-green);color:#fff;border-radius:6px;padding:2px 6px;font-weight:700;}
.s-badge.ai{background:#7B61FF;}
.ai-head{display:flex;align-items:center;gap:8px;font-size:15px;}
.ai-locs{display:flex;gap:8px;margin:10px 0;}
.ai-loc{flex:1;background:var(--fa-card);border-radius:10px;padding:8px 4px;text-align:center;}
.ai-loc span{font-size:18px;display:block;}
.ai-loc b{display:block;font-size:15px;margin:2px 0;}
.ai-loc small{color:var(--fa-muted);font-size:11px;}
.checkline{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--fa-muted);margin-top:6px;cursor:pointer;}
.spinner{width:20px;height:20px;border:2.5px solid var(--fa-border);border-top-color:#7B61FF;border-radius:50%;animation:spin .7s linear infinite;flex:none;}
@keyframes spin{to{transform:rotate(360deg);}}

.adv.hidden,.hidden{display:none;}
.modal-actions{display:flex;gap:10px;margin-top:18px;}
.modal-actions .btn{flex:1;}
.modal-actions.three .btn{font-size:14px;padding:0 8px;}

.tp-list{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto;overscroll-behavior:contain;}
.tp-item{display:flex;align-items:center;gap:12px;background:var(--fa-bg);border:1px solid transparent;border-radius:12px;padding:10px;cursor:pointer;text-align:left;color:var(--fa-text);}
.tp-item:hover{border-color:var(--fa-accent);}
.tp-emoji{font-size:24px;width:34px;text-align:center;}
.tp-name{flex:1;display:flex;flex-direction:column;}
.tp-name small{color:var(--fa-muted);font-size:12px;}
.tp-sl{display:flex;gap:5px;}
.tp-sl i{font-style:normal;font-size:11px;color:var(--fa-muted);background:var(--fa-card);border-radius:6px;padding:2px 5px;}

.detail-head{display:flex;align-items:center;gap:12px;}
.d-emoji{font-size:40px;width:60px;height:60px;display:flex;align-items:center;justify-content:center;background:var(--fa-bg);border-radius:16px;}
.d-title{flex:1;} .d-title h2{margin:0;font-size:21px;}
.d-code{font-family:ui-monospace,monospace;font-size:13px;color:var(--fa-muted);letter-spacing:.08em;margin-top:2px;}
.d-status{margin:14px 0;padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c);font-weight:600;text-align:center;}
.d-rows{display:flex;flex-direction:column;}
.d-row{display:flex;justify-content:space-between;gap:12px;padding:11px 2px;border-bottom:1px solid var(--fa-border);font-size:15px;}
.d-row:last-child{border:none;}
.d-row span{color:var(--fa-muted);}
.d-row b{text-align:right;font-weight:600;}

/* done actions + history */
.btn.tossed{background:var(--fa-red);color:#fff;}
.done-row{margin-top:10px;}
.hi-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--fa-border);}
.hi-row:last-child{border:none;}
.hi-emoji{font-size:24px;width:34px;text-align:center;flex:none;}
.hi-main{flex:1;min-width:0;}
.hi-title{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hi-title .code{font-weight:400;}
.hi-sub2{font-size:12px;color:var(--fa-muted);margin-top:2px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.hi-act{font-weight:600;}
.hi-act.eaten{color:var(--fa-green);}
.hi-act.tossed{color:var(--fa-red);}
.hi-right{flex:none;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.hi-right .who{font-size:12px;color:var(--fa-muted);}
.hi-time{font-size:11px;color:var(--fa-muted);}
.hi-undo{border:none;background:transparent;color:var(--fa-accent);font-size:12px;font-weight:600;cursor:pointer;padding:3px 6px;margin-top:2px;border-radius:8px;}
.hi-undo:hover{background:var(--fa-border);}
.hi-undo:disabled{opacity:.5;}
.sc-mode{margin:2px 0 10px;}

.clean-sec{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--fa-muted);margin:14px 2px 6px;font-weight:600;}
.clean-row{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--fa-border);}
.clean-row input{width:20px;height:20px;accent-color:var(--fa-red);}
.cr-emoji{font-size:22px;}
.cr-name{flex:1;display:flex;flex-direction:column;}
.cr-name small{color:var(--fa-muted);font-size:12px;}
.cr-days{font-size:12px;font-weight:600;color:var(--c);}

#toast-root{position:fixed;bottom:20px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:100;pointer-events:none;}
.toast{background:#1d1d1f;color:#fff;border-radius:12px;padding:12px 16px;font-size:14px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 30px rgba(0,0,0,.3);transform:translateY(20px);opacity:0;transition:.25s;pointer-events:auto;max-width:90%;}
.toast.show{transform:none;opacity:1;}
.toast.bad{background:var(--fa-red);}
.toast.info{background:var(--fa-accent);}
.toast button{background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer;}

/* ===================== mobile-first / companion app ===================== */
:host{overflow-x:hidden;-webkit-tap-highlight-color:transparent;}
.wrap{padding:0 max(14px,env(safe-area-inset-right)) calc(104px + env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));overflow-x:hidden;}
.topbar{padding:calc(10px + env(safe-area-inset-top)) 2px 6px;}
.topbar-row{display:flex;align-items:center;gap:6px;min-height:44px;}
.brand{gap:8px;}
.brand h1{font-size:22px;}
.spacer{flex:1;}
.menu-slot{display:flex;align-items:center;}
.menu-slot ha-menu-button{--mdc-icon-button-size:44px;color:var(--fa-text);margin-right:2px;}
.counts{margin:8px 0 0;}
.searchrow{display:flex;gap:8px;align-items:center;margin-top:8px;}
.search{height:44px;}
.search input{font-size:16px;}
.btn{height:44px;}
.btn.icon-only{width:44px;padding:0;font-size:18px;flex:none;}
.icon-btn{width:44px;height:44px;font-size:19px;}

/* Floating add button — thumb-reachable when you're standing at the fridge */
.fab{position:fixed;z-index:40;right:calc(18px + env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:20px;border:none;background:var(--fa-accent);color:#fff;font-size:34px;font-weight:300;line-height:0;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(0,122,255,.5);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;padding-bottom:4px;}
.fab:active{transform:scale(.92);}
/* secondary camera FAB, sits left of the add button */
.fab-scan{width:54px;height:54px;right:calc(90px + env(safe-area-inset-right));bottom:calc(23px + env(safe-area-inset-bottom));font-size:24px;background:var(--fa-card);color:var(--fa-text);border:1px solid var(--fa-border);box-shadow:0 8px 22px rgba(0,0,0,.2);}

/* scanner */
.scanbox{position:relative;background:#000;border-radius:16px;overflow:hidden;aspect-ratio:4/3;max-height:48vh;display:flex;align-items:center;justify-content:center;margin-bottom:2px;}
.scanbox.hidden{display:none;}
.scanbox video{width:100%;height:100%;object-fit:cover;}
.scan-frame{position:absolute;left:8%;right:8%;top:30%;bottom:30%;border:3px solid rgba(255,255,255,.92);border-radius:12px;}
.scan-torch{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.45);color:#fff;}
.scan-torch:hover{background:rgba(0,0,0,.6);}
.scan-torch.on{background:var(--fa-accent);color:#fff;}
.scan-torch.hidden{display:none;}
.scan-status{min-height:20px;font-size:13px;color:var(--fa-muted);text-align:center;margin:8px 4px 0;}
.scan-manual{display:flex;gap:8px;}
.scan-manual input{flex:1;height:46px;border:1.5px solid var(--fa-border);border-radius:12px;padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);text-transform:uppercase;letter-spacing:.05em;outline:none;}
.filepick{position:relative;overflow:hidden;}
.filepick input{position:absolute;inset:0;opacity:0;font-size:0;}

/* suggestion action buttons: accept implicitly, or override / reject a guess */
.s-actions{display:flex;gap:6px;align-items:center;flex:none;flex-wrap:wrap;justify-content:flex-end;}
.s-mini{border:1px solid var(--fa-border);background:var(--fa-card);color:var(--fa-text);border-radius:10px;min-width:40px;height:36px;padding:0 10px;font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;}
.s-mini.ghost{color:var(--fa-muted);}
.s-mini.ai{background:linear-gradient(135deg,#7B61FF,#B06AFF);color:#fff;border:none;}

/* bottom-sheet: clear the iPhone home indicator + contain scroll */
.modal{padding-bottom:calc(18px + env(safe-area-inset-bottom));max-height:min(92vh,92dvh);overscroll-behavior:contain;}
.modal-actions .btn{min-height:48px;}

/* toasts sit above the FAB */
#toast-root{bottom:calc(90px + env(safe-area-inset-bottom));}
.toast{max-width:88%;}

/* no sticky :hover state on touch devices */
@media (hover:none){
  .card:hover,.ucard:hover,.tp-item:hover,.btn.primary:hover,.icon-btn:hover{transform:none;box-shadow:none;}
  .icon-btn:hover{background:transparent;}
}

/* editable AI day inputs */
.ai-sub{font-size:12px;color:var(--fa-muted);margin:2px 0 8px;}
.ai-loc.active{outline:2px solid var(--fa-accent);outline-offset:-1px;}
.ai-loc-emoji{font-size:18px;display:block;}
.ai-days-wrap{display:inline-flex;align-items:baseline;gap:2px;justify-content:center;margin:4px 0 2px;}
.ai-days{width:46px;text-align:center;font-size:16px;font-weight:700;border:1.5px solid var(--fa-border);border-radius:8px;background:var(--fa-card);color:var(--fa-text);height:34px;padding:0 2px;-moz-appearance:textfield;}
.ai-days::-webkit-outer-spin-button,.ai-days::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.ai-days:focus{outline:none;border-color:var(--fa-accent);}
.ai-days-wrap i{font-style:normal;font-size:11px;color:var(--fa-muted);}

/* templates manager + editor */
.tm-badge{font-size:9px;text-transform:uppercase;letter-spacing:.04em;border-radius:5px;padding:1px 5px;font-weight:700;vertical-align:middle;margin-left:6px;}
.tm-badge.own{background:var(--fa-accent);color:#fff;}
.tm-badge.edit{background:var(--fa-orange);color:#fff;}
.te-sec{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--fa-muted);font-weight:600;margin:14px 2px 2px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.grid3 .field{margin:4px 0;}
.grid3 .field input{text-align:center;padding:0 6px;}
.select-wrap{position:relative;}
.select-wrap select{width:100%;height:44px;border:1.5px solid var(--fa-border);border-radius:12px;background:var(--fa-bg);color:var(--fa-text);font-size:16px;padding:0 32px 0 14px;-webkit-appearance:none;appearance:none;}
.select-wrap::after{content:"▾";position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--fa-muted);pointer-events:none;}
.modal-actions.with-del{flex-wrap:wrap;}
.btn.danger-text{color:var(--fa-red);}
.seg button{white-space:nowrap;}
.strip-group{margin-bottom:4px;}
.strip-sub{font-size:12px;font-weight:600;color:var(--fa-muted);margin:8px 4px 6px;}

/* desktop niceties */
@media (min-width:640px){
  .brand h1{font-size:26px;}
}
`;

customElements.define("fridge-assistant-panel", FridgeAssistantPanel);
