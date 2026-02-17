import type { BuildStateV1, Rotation } from "@/lib/types";

export const BUILD_PARAM = "b";

export type SharePayloadV1 = BuildStateV1;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value);

const isRotation = (value: unknown): value is Rotation =>
  value === 0 || value === 90 || value === 180 || value === 270;

const fromBase64 = (value: string): string => {
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(value);
  }

  throw new Error("base64 decode unavailable");
};

const toBase64 = (value: string): string => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }

  throw new Error("base64 encode unavailable");
};

export const base64UrlEncode = (str: string): string => {
  const bytes = textEncoder.encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return toBase64(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const base64UrlDecode = (str: string): string => {
  const padded = str
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(str.length / 4) * 4, "=");
  const binary = fromBase64(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return textDecoder.decode(bytes);
};

const isPlacedEntry = (
  value: unknown,
): value is BuildStateV1["placed"][number] => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.instanceId !== "string" ||
    typeof candidate.itemId !== "string" ||
    !isInteger(candidate.x) ||
    !isInteger(candidate.y) ||
    !isRotation(candidate.rot)
  ) {
    return false;
  }

  if (
    candidate.level !== undefined &&
    candidate.level !== 1 &&
    candidate.level !== 2 &&
    candidate.level !== 3
  ) {
    return false;
  }

  return true;
};

const isTrinketEntry = (
  value: unknown,
): value is BuildStateV1["trinkets"][number] => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (candidate.slot === 0 || candidate.slot === 1 || candidate.slot === 2) &&
    (candidate.half === 0 || candidate.half === 1) &&
    typeof candidate.itemId === "string"
  );
};

const isBuildStateV1 = (value: unknown): value is BuildStateV1 => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.v !== 1) {
    return false;
  }

  if (
    candidate.heroId !== undefined &&
    typeof candidate.heroId !== "string"
  ) {
    return false;
  }

  if (
    !Array.isArray(candidate.unlocked) ||
    !candidate.unlocked.every((index) => isInteger(index))
  ) {
    return false;
  }

  if (!Array.isArray(candidate.placed) || !candidate.placed.every(isPlacedEntry)) {
    return false;
  }

  if (
    !Array.isArray(candidate.trinkets) ||
    !candidate.trinkets.every(isTrinketEntry)
  ) {
    return false;
  }

  return true;
};

export const encodeBuildToString = (state: BuildStateV1): string => {
  return base64UrlEncode(JSON.stringify(state));
};

export const decodeBuildFromString = (value: string): BuildStateV1 | null => {
  try {
    const decoded = base64UrlDecode(value);
    const parsed: unknown = JSON.parse(decoded);
    return isBuildStateV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
