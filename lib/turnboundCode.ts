import type { BuildStateV1 } from "@/lib/types";
import {
  base64UrlDecode,
  decodeExportFileFromJson,
  validateBuildStateShape,
} from "@/lib/share";

export type DecodeResult =
  | { ok: true; state: BuildStateV1; meta?: unknown }
  | { ok: false; reason: string; debug?: unknown };

type StageDebug = {
  stage: string;
  ok: boolean;
  note?: string;
  error?: string;
  data?: unknown;
};

type DecodeDebug = {
  input: {
    raw: string;
    extractedFromUrl?: boolean;
    extractedParam?: string;
    compact: string;
    compactUpper: string;
  };
  stages: StageDebug[];
};

const textDecoder = new TextDecoder();

const isDev = process.env.NODE_ENV !== "production";
const MAX_INPUT_CHARS = 4096;

const pushStage = (debug: DecodeDebug, entry: StageDebug) => {
  debug.stages.push(entry);
};

const safeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const tryParseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const looksLikeJson = (value: string): boolean => {
  const trimmed = value.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
};

const looksLikeBase64Url = (value: string): boolean => /^[A-Za-z0-9_-]+$/.test(value);

const looksLikeBase64 = (value: string): boolean => /^[A-Za-z0-9+/]+={0,2}$/.test(value);

const padBase64 = (value: string): string =>
  value.padEnd(Math.ceil(value.length / 4) * 4, "=");

const base64ToBytes = (value: string): Uint8Array => {
  if (typeof globalThis.atob !== "function") {
    throw new Error("base64 decode unavailable");
  }
  const binary = globalThis.atob(padBase64(value));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return base64ToBytes(padded);
};

const base64ToText = (value: string): string => textDecoder.decode(base64ToBytes(value));
const base64UrlToText = (value: string): string =>
  // Prefer the existing implementation to reduce drift.
  base64UrlDecode(value);

const decodeJsonTextToState = (
  text: string,
): { state: BuildStateV1; meta: unknown } | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (validateBuildStateShape(parsed)) {
    return { state: parsed, meta: { format: "json-build-state-v1" } };
  }

  const exportFile = decodeExportFileFromJson(text);
  if (exportFile) {
    return {
      state: exportFile.state,
      meta: { format: "json-export-file-v1", app: exportFile.app, v: exportFile.v },
    };
  }

  return null;
};

const tryDecompressToText = async (
  bytes: Uint8Array,
  format: "gzip" | "deflate",
): Promise<string> => {
  if (typeof (globalThis as unknown as { DecompressionStream?: unknown })
    .DecompressionStream !== "function") {
    throw new Error("DecompressionStream unavailable");
  }

  const inputBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(inputBuffer).set(bytes);
  const stream = new Blob([inputBuffer])
    .stream()
    .pipeThrough(new DecompressionStream(format));
  const outputBuffer = await new Response(stream).arrayBuffer();
  return textDecoder.decode(new Uint8Array(outputBuffer));
};

export const decodeTurnboundCode = async (code: string): Promise<DecodeResult> => {
  const debug: DecodeDebug = {
    input: { raw: String(code ?? ""), compact: "", compactUpper: "" },
    stages: [],
  };

  try {
    const rawTrimmed = String(code ?? "").trim();
    if (!rawTrimmed) {
      pushStage(debug, { stage: "a:normalize", ok: false, note: "empty input" });
      return { ok: false, reason: "Paste a code to decode.", debug: isDev ? debug : undefined };
    }

    if (rawTrimmed.length > MAX_INPUT_CHARS) {
      pushStage(debug, { stage: "a:normalize", ok: false, note: "too long" });
      return {
        ok: false,
        reason: "That code is too long to decode safely.",
        debug: isDev ? debug : undefined,
      };
    }

    const parsedUrl = tryParseUrl(rawTrimmed);
    let candidate = rawTrimmed;
    if (parsedUrl) {
      const extracted = parsedUrl.searchParams.get("b");
      if (extracted) {
        candidate = extracted;
        debug.input.extractedFromUrl = true;
        debug.input.extractedParam = "b";
        pushStage(debug, { stage: "a:normalize", ok: true, note: "extracted b= param" });
      }
    }

    const compact = candidate.replace(/[\s-]+/g, "");
    const compactUpper = compact.toUpperCase();
    debug.input.compact = compact;
    debug.input.compactUpper = compactUpper;

    if (compact.length < 4) {
      pushStage(debug, { stage: "a:normalize", ok: false, note: "too short" });
      return { ok: false, reason: "Code is too short.", debug: isDev ? debug : undefined };
    }

    const isAlnumOnly = /^[A-Za-z0-9]+$/.test(compact);
    if (isAlnumOnly && compact.length > 64) {
      pushStage(debug, { stage: "a:normalize", ok: false, note: "alnum length > 64" });
      return {
        ok: false,
        reason: "That code looks like a short duel code but is too long.",
        debug: isDev ? debug : undefined,
      };
    }

    const isRecognizedCharSet =
      looksLikeJson(candidate) ||
      looksLikeBase64Url(compact) ||
      looksLikeBase64(compact) ||
      isAlnumOnly;
    if (!isRecognizedCharSet) {
      pushStage(debug, { stage: "a:normalize", ok: false, note: "unsupported characters" });
      return {
        ok: false,
        reason: "That code contains unsupported characters.",
        debug: isDev ? debug : undefined,
      };
    }

    // Stage B) known-simple forms
    if (looksLikeJson(candidate)) {
      const decoded = decodeJsonTextToState(candidate);
      pushStage(debug, {
        stage: "b:json",
        ok: Boolean(decoded),
        note: decoded ? "validated json" : "json parse/validate failed",
      });
      if (decoded) {
        return { ok: true, state: decoded.state, meta: isDev ? decoded.meta : undefined };
      }
    }

    const base64Attempts: Array<{
      kind: "base64url" | "base64";
      canTry: boolean;
      decodeText: () => string;
      decodeBytes: () => Uint8Array;
    }> = [
      {
        kind: "base64url",
        canTry: looksLikeBase64Url(compact),
        decodeText: () => base64UrlToText(compact),
        decodeBytes: () => base64UrlToBytes(compact),
      },
      {
        kind: "base64",
        canTry: looksLikeBase64(compact),
        decodeText: () => base64ToText(compact),
        decodeBytes: () => base64ToBytes(compact),
      },
    ];

    for (const attempt of base64Attempts) {
      if (!attempt.canTry) {
        pushStage(debug, {
          stage: `b:${attempt.kind}`,
          ok: false,
          note: "pattern mismatch",
        });
        continue;
      }

      try {
        const text = attempt.decodeText();
        const decoded = decodeJsonTextToState(text);
        pushStage(debug, {
          stage: `b:${attempt.kind}`,
          ok: Boolean(decoded),
          note: decoded ? "decoded text → json → validated" : "decoded text but not valid json/state",
          data: isDev ? { decodedTextPrefix: text.slice(0, 80) } : undefined,
        });
        if (decoded) {
          return { ok: true, state: decoded.state, meta: isDev ? decoded.meta : undefined };
        }
      } catch (error) {
        pushStage(debug, {
          stage: `b:${attempt.kind}`,
          ok: false,
          error: safeErrorMessage(error),
        });
      }
    }

    // Stage C) compressed forms (async via DecompressionStream)
    const hasDecompressionStream =
      typeof (globalThis as unknown as { DecompressionStream?: unknown })
        .DecompressionStream === "function";
    if (!hasDecompressionStream) {
      pushStage(debug, {
        stage: "c:decompress",
        ok: false,
        note: "DecompressionStream unavailable",
      });
    } else {
      for (const attempt of base64Attempts) {
        if (!attempt.canTry) {
          continue;
        }

        let bytes: Uint8Array;
        try {
          bytes = attempt.decodeBytes();
        } catch (error) {
          pushStage(debug, {
            stage: `c:bytes:${attempt.kind}`,
            ok: false,
            error: safeErrorMessage(error),
          });
          continue;
        }

        for (const format of ["gzip", "deflate"] as const) {
          try {
            const text = await tryDecompressToText(bytes, format);
            const decoded = decodeJsonTextToState(text);
            pushStage(debug, {
              stage: `c:${attempt.kind}:${format}`,
              ok: Boolean(decoded),
              note: decoded
                ? "decompressed → json → validated"
                : "decompressed but not valid json/state",
              data: isDev ? { decodedTextPrefix: text.slice(0, 80) } : undefined,
            });
            if (decoded) {
              return { ok: true, state: decoded.state, meta: isDev ? decoded.meta : undefined };
            }
          } catch (error) {
            pushStage(debug, {
              stage: `c:${attempt.kind}:${format}`,
              ok: false,
              error: safeErrorMessage(error),
            });
          }
        }
      }
    }

    // Stage D) heuristics (unknown formats)
    const isLookupLike = /^[A-Z0-9]{6}$/.test(compactUpper);
    if (isLookupLike) {
      pushStage(debug, {
        stage: "d:heuristic",
        ok: true,
        note: "lookup-like short code",
        data: { type: "lookup-like" },
      });
      return {
        ok: false,
        reason:
          "This code appears to be a server lookup code and can’t be decoded offline yet.",
        debug: isDev ? { ...debug, hint: { type: "lookup-like" } } : undefined,
      };
    }

    pushStage(debug, {
      stage: "unknown",
      ok: false,
      note: "no supported format matched",
    });
    return {
      ok: false,
      reason: "Unsupported code format. Please paste a Turnbound Forge share payload or JSON export.",
      debug: isDev ? debug : undefined,
    };
  } catch (error) {
    pushStage(debug, { stage: "fatal", ok: false, error: safeErrorMessage(error) });
    return {
      ok: false,
      reason: "Decode failed unexpectedly, but the app is still safe. Try again with a different code.",
      debug: isDev ? debug : undefined,
    };
  }
};

