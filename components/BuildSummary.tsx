"use client";

import type { ValidationResult } from "@/lib/validate";

type BuildSummaryProps = {
  validation: ValidationResult;
  placedCount: number;
  onSelectInstance: (instanceId: string) => void;
};

export const BuildSummary = ({
  validation,
  placedCount,
  onSelectInstance,
}: BuildSummaryProps) => {
  const { issues, illegal, weaponCap, weaponCount } = validation;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <div className="flex min-h-[320px] flex-col rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-800">Build Summary</h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            illegal
              ? "bg-red-100 text-red-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {illegal ? "Invalid" : "Valid"}
        </span>
        <span className="text-sm text-zinc-600">
          Weapons: <strong>{weaponCount}</strong> / {weaponCap}
        </span>
        <span className="text-sm text-zinc-600">
          Placed: <strong>{placedCount}</strong>
        </span>
      </div>

      {issues.length > 0 ? (
        <div className="flex flex-1 flex-col gap-2 overflow-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Issues
          </h3>
          <ul className="space-y-1.5">
            {errors.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() =>
                    issue.instanceId
                      ? onSelectInstance(issue.instanceId)
                      : undefined
                  }
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition ${
                    issue.instanceId
                      ? "cursor-pointer border-red-200 bg-red-50 text-red-900 hover:border-red-300 hover:bg-red-100"
                      : "cursor-default border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  <span className="font-medium">Error:</span> {issue.message}
                </button>
              </li>
            ))}
            {warnings.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() =>
                    issue.instanceId
                      ? onSelectInstance(issue.instanceId)
                      : undefined
                  }
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition ${
                    issue.instanceId
                      ? "cursor-pointer border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100"
                      : "cursor-default border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <span className="font-medium">Warning:</span> {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No issues.</p>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        Click an issue with a tile to select it on the board.
      </p>
    </div>
  );
};
