"use client";

import type { LucideIcon } from "lucide-react";
import { Plus, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AllocationCard, type AllocationView } from "./allocation-card";

type SummaryItem = {
  label: string;
  value: number;
  icon: LucideIcon;
};

type AllocationItem = {
  name: string;
  value: number;
  color: string;
};

type OverviewContentProps = {
  total: number;
  assetCount: number;
  usdIdrRateLabel: string;
  summary: SummaryItem[];
  assetSnapshot: ReactNode;
  allocationView: AllocationView;
  onAllocationViewChange: (view: AllocationView) => void;
  allocationData: AllocationItem[];
  reportingCurrency: string;
  formatValue: (value: number) => string;
  onAddAsset: () => void;
};

export function OverviewContent({
  total,
  assetCount,
  usdIdrRateLabel,
  summary,
  assetSnapshot,
  allocationView,
  onAllocationViewChange,
  allocationData,
  reportingCurrency,
  formatValue,
  onAddAsset,
}: OverviewContentProps) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-[#283f34] px-6 py-7 text-white shadow-[0_18px_45px_rgba(40,63,52,0.12)] sm:px-8 sm:py-9">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#b6c6a9]">
              Total portfolio value
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              {formatValue(total)}
            </p>
            <p className="mt-3 text-sm text-[#d1ddc8]">{usdIdrRateLabel}</p>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-[#d1ddc8]">
              <ShieldCheck size={16} />
              Calculated from {assetCount} {assetCount === 1 ? "asset" : "assets"}
            </p>
          </div>
          <Button
            onClick={onAddAsset}
            className="bg-[#d7f268] text-[#22352a] hover:bg-[#c9e759]"
          >
            <Plus />
            Add asset
          </Button>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <Card
            key={item.label}
            className="dashboard-card border-[#dce5de] bg-white shadow-none"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff3ed] text-[#486451]">
                <item.icon size={18} />
              </div>
              <div>
                <p className="text-sm text-[#718174]">{item.label}</p>
                <p className="mt-1 font-semibold tracking-tight">
                  {formatValue(item.value)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        {assetSnapshot}
        <AllocationCard
          view={allocationView}
          onViewChange={onAllocationViewChange}
          data={allocationData}
          total={total}
          reportingCurrency={reportingCurrency}
          formatValue={formatValue}
        />
      </section>
    </div>
  );
}
