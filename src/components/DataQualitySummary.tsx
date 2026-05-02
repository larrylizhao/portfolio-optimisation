"use client";

import { useState } from "react";
import type { DataWarning } from "@/lib/data/types";

interface DataQualitySummaryProps {
  warnings: DataWarning[];
  constraintCompliance: {
    maxAssets: { passed: boolean; actual: number; limit: number };
    weightBounds: { passed: boolean; violations: string[] };
    classCaps: { passed: boolean; violations: string[] };
  };
}

export function DataQualitySummary({ warnings, constraintCompliance }: DataQualitySummaryProps) {
  const [open, setOpen] = useState(false);

  const allPassed =
    constraintCompliance.maxAssets.passed &&
    constraintCompliance.weightBounds.passed &&
    constraintCompliance.classCaps.passed;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-gray-50"
      >
        <span>
          {warnings.length} data issue{warnings.length !== 1 ? "s" : ""} detected and resolved
          {" · "}
          <span className={allPassed ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}>
            Constraints: {allPassed ? "all satisfied" : "soft violations"}
          </span>
        </span>
        <span className="text-[var(--color-muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mt-3 mb-2">
            Data Quality Issues
          </h4>
          <ul className="space-y-1 text-xs">
            {warnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-[var(--color-muted)] shrink-0">[{w.source}]</span>
                <span>
                  {w.issue} → <span className="text-[var(--color-antarctica-navy)]">{w.resolution}</span>
                </span>
              </li>
            ))}
          </ul>

          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mt-4 mb-2">
            Constraint Compliance
          </h4>
          <ul className="space-y-1 text-xs">
            <li>
              {constraintCompliance.maxAssets.passed ? "✓" : "✗"} Max assets: {constraintCompliance.maxAssets.actual}/{constraintCompliance.maxAssets.limit}
            </li>
            <li>
              {constraintCompliance.weightBounds.passed ? "✓" : "✗"} Weight bounds [2%-25%]
              {constraintCompliance.weightBounds.violations.length > 0 &&
                `: ${constraintCompliance.weightBounds.violations.join(", ")}`}
            </li>
            <li>
              {constraintCompliance.classCaps.passed ? "✓" : "✗"} Asset class caps (30% each)
              {constraintCompliance.classCaps.violations.length > 0 &&
                `: ${constraintCompliance.classCaps.violations.join(", ")}`}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
