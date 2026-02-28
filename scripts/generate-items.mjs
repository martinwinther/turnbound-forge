import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, "..");
const CSV_PATH = path.join(PROJECT_ROOT, "data", "items.csv");
const JSON_PATH = path.join(PROJECT_ROOT, "data", "items.json");

const VALID_CATEGORIES = new Set([
  "hero",
  "weapon",
  "armor",
  "accessory",
  "consumable",
  "trinket",
]);

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = i + 1 < line.length ? line[i + 1] : null;
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((field) => field.trim());
}

function parseBoolean(value, { defaultValue = false } = {}) {
  if (!value) {
    return defaultValue;
  }

  const lowered = value.toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;

  throw new Error(`Expected "true" or "false" but got "${value}"`);
}

function parseInteger(value, fieldName) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected integer for ${fieldName} but got "${value}"`);
  }
  return parsed;
}

function parseShapeCells(raw, lineNumber) {
  if (!raw) {
    throw new Error(`Line ${lineNumber}: shapeCells is required`);
  }

  const pairs = raw.split(";").map((pair) => pair.trim()).filter(Boolean);
  if (pairs.length === 0) {
    throw new Error(`Line ${lineNumber}: shapeCells must contain at least one cell`);
  }

  const cells = pairs.map((pair) => {
    const [xStr, yStr] = pair.split(" ").map((part) => part.trim());
    const x = Number.parseInt(xStr, 10);
    const y = Number.parseInt(yStr, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new Error(`Line ${lineNumber}: invalid shape cell "${pair}" (expected "x y")`);
    }
    return [x, y];
  });

  return cells;
}

function parsePivot(raw, lineNumber) {
  if (!raw) {
    throw new Error(`Line ${lineNumber}: pivot is required (expected "x y")`);
  }

  const [xStr, yStr] = raw.split(" ").map((part) => part.trim());
  const x = Number.parseInt(xStr, 10);
  const y = Number.parseInt(yStr, 10);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`Line ${lineNumber}: invalid pivot "${raw}" (expected "x y")`);
  }
  return [x, y];
}

function parseTags(raw) {
  if (!raw) return [];
  return raw
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildItemFromRow(row, header, lineNumber) {
  const get = (fieldName) => {
    const index = header.indexOf(fieldName);
    if (index === -1) return "";
    return row[index] ?? "";
  };

  const id = get("id");
  const name = get("name");
  const category = get("category");
  const tagsRaw = get("tags");
  const rulesText = get("rulesText");
  const shapeCellsRaw = get("shapeCells");
  const pivotRaw = get("pivot");
  const rotatableRaw = get("rotatable");
  const isUniqueRaw = get("isUnique");
  const iconRaw = get("icon");
  const isHalfTrinketRaw = get("isHalfTrinket");
  const weaponCapBonusRaw = get("weaponCapBonus");

  if (!id) {
    throw new Error(`Line ${lineNumber}: id is required`);
  }
  if (!name) {
    throw new Error(`Line ${lineNumber}: name is required (id="${id}")`);
  }
  if (!category) {
    throw new Error(`Line ${lineNumber}: category is required (id="${id}")`);
  }
  if (!VALID_CATEGORIES.has(category)) {
    const allowed = Array.from(VALID_CATEGORIES).join(", ");
    throw new Error(
      `Line ${lineNumber}: invalid category "${category}" for id="${id}". Expected one of: ${allowed}`,
    );
  }

  const cells = parseShapeCells(shapeCellsRaw, lineNumber);
  const pivot = parsePivot(pivotRaw, lineNumber);
  const rotatable = parseBoolean(rotatableRaw, { defaultValue: false });
  const isUnique = parseBoolean(isUniqueRaw, { defaultValue: false });
  const isHalfTrinket = parseBoolean(isHalfTrinketRaw, { defaultValue: false });
  const weaponCapBonus = parseInteger(weaponCapBonusRaw, "weaponCapBonus");

  const tags = parseTags(tagsRaw);

  const icon = iconRaw || "/icons/placeholder.png";

  const item = {
    id,
    name,
    category,
    tags,
    shape: {
      cells,
      pivot,
      rotatable,
    },
    rulesText: rulesText || "",
    icon,
  };

  if (isUnique) {
    item.isUnique = true;
  }
  if (isHalfTrinket) {
    item.isHalfTrinket = true;
  }
  if (weaponCapBonus !== undefined) {
    item.modifiers = { weaponCapBonus };
  }

  return item;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("CSV is empty");
  }

  const header = parseCsvLine(lines[0]);

  const items = [];
  const seenIds = new Set();

  for (let i = 1; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i];
    const row = parseCsvLine(line);

    if (row.every((cell) => cell.trim().length === 0)) {
      continue;
    }

    try {
      const item = buildItemFromRow(row, header, lineNumber);
      if (seenIds.has(item.id)) {
        throw new Error(`Line ${lineNumber}: duplicate id "${item.id}"`);
      }
      seenIds.add(item.id);
      items.push(item);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error;
    }
  }

  return items;
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.category < b.category) return -1;
    if (a.category > b.category) return 1;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

function generateJson({ checkMode }) {
  const csvContent = readFileSafe(CSV_PATH);
  if (csvContent == null) {
    console.error(`Could not find CSV at ${CSV_PATH}`);
    process.exitCode = 1;
    return;
  }

  let items;
  try {
    items = parseCsv(csvContent);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Unknown error while parsing CSV.");
    }
    process.exitCode = 1;
    return;
  }

  const sorted = sortItems(items);
  const output = `${JSON.stringify(sorted, null, 2)}\n`;

  if (checkMode) {
    const existing = readFileSafe(JSON_PATH);
    if (existing == null) {
      console.error("data/items.json does not exist but would be generated.");
      process.exitCode = 1;
      return;
    }

    if (existing !== output) {
      console.error("data/items.json is out of date. Run `npm run gen:items`.");
      process.exitCode = 1;
      return;
    }

    console.log("data/items.json is up to date.");
    return;
  }

  fs.writeFileSync(JSON_PATH, output, "utf8");
  console.log(`Generated ${JSON_PATH} with ${sorted.length} items.`);
}

function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes("--check");
  generateJson({ checkMode });
}

main();

