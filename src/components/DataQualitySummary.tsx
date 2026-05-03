"use client";

import { useState } from "react";
import type { DataWarning } from "@/lib/data/types";

interface DataQualitySummaryProps {
  warnings: DataWarning[];
  constraintCompliance: {
    maxAssets: { passed: boolean; actual: number; limit: number; relaxed?: boolean };
    weightBounds: { passed: boolean; violations: string[] };
    classCaps: { passed: boolean; violations: string[] };
  };
}

export function DataQualitySummary({ warnings, constraintCompliance }: DataQualitySummaryProps) {
  const [open, setOpen] = useState(false);

  const allPassed =
    (constraintCompliance.maxAssets.passed || constraintCompliance.maxAssets.relaxed) &&
    constraintCompliance.weightBounds.passed &&
    constraintCompliance.classCaps.passed;

  return (
    <div className={`rounded-xl border transition-all duration-300 shadow-sm overflow-hidden ${allPassed ? "border-gray-200 bg-white" : "border-amber-200 bg-amber-50/30"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-left hover:bg-blue-50/50 active:scale-[0.998] transition-all focus:outline-none focus:bg-blue-50/50 group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-2 w-2 rounded-full animate-pulse ${allPassed ? "bg-green-500" : "bg-amber-500"}`} />
          <span className="text-gray-700">
            {warnings.length} data issue{warnings.length !== 1 ? "s" : ""} detected and resolved
            <span className="mx-2 opacity-30">|</span>
            <span className={allPassed ? "text-[var(--color-positive)] font-semibold" : "text-amber-600 font-semibold"}>
              Constraints: {allPassed ? (constraintCompliance.maxAssets.relaxed ? "strategically relaxed" : "all satisfied") : "soft violations"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            {open ? "Click to close" : "Click to view details"}
          </span>
          <span className={`text-[var(--color-muted)] transition-transform duration-300 transform ${open ? "rotate-180" : "rotate-0"}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Animated Expandable Container */}
      <div 
        className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-white">
            {/* Changed from grid to vertical stack as requested */}
            <div className="flex flex-col gap-8 mt-2">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Data Quality Resolutions
                </h4>
                <ul className="space-y-2 text-xs">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex gap-2 items-start group/item">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-400 shrink-0">[{w.source}]</span>
                      <span className="text-gray-600 leading-relaxed group-hover/item:text-gray-900 transition-colors">
                        {w.issue} → <span className="text-[var(--color-antarctica-navy)] font-medium underline underline-offset-2 decoration-gray-200">{w.resolution}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-50">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  Constraint Compliance
                </h4>
                <ul className="space-y-3 text-xs">
                  <li className="flex items-start gap-2">
                    {constraintCompliance.maxAssets.relaxed ? (
                      <span className="text-amber-500 font-bold shrink-0">⚠</span>
                    ) : constraintCompliance.maxAssets.passed ? (
                      <span className="text-green-500 font-bold shrink-0">✓</span>
                    ) : (
                      <span className="text-red-500 font-bold shrink-0">✗</span>
                    )} 
                    <span className="text-gray-600">
                      <span className="font-semibold text-gray-800">Max Assets:</span> {constraintCompliance.maxAssets.actual}/{constraintCompliance.maxAssets.limit}
                      {constraintCompliance.maxAssets.relaxed && <span className="block text-[10px] text-amber-600 italic mt-0.5">Strategically increased to 6 to minimize cash drag</span>}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className={constraintCompliance.weightBounds.passed ? "text-green-500 font-bold shrink-0" : "text-red-500 font-bold shrink-0"}>
                      {constraintCompliance.weightBounds.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-gray-600">
                      <span className="font-semibold text-gray-800">Weight Bounds:</span> [2% - 25%]
                      {constraintCompliance.weightBounds.violations.length > 0 &&
                        <span className="block text-red-400 mt-1 pl-2 border-l-2 border-red-100">{constraintCompliance.weightBounds.violations.join(", ")}</span>}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className={constraintCompliance.classCaps.passed ? "text-green-500 font-bold shrink-0" : "text-red-500 font-bold shrink-0"}>
                      {constraintCompliance.classCaps.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-gray-600">
                      <span className="font-semibold text-gray-800">Asset Class Caps:</span> 30% per class
                      {constraintCompliance.classCaps.violations.length > 0 &&
                        <span className="block text-red-400 mt-1 pl-2 border-l-2 border-red-100">{constraintCompliance.classCaps.violations.join(", ")}</span>}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
