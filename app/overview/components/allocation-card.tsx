"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AllocationView = "asset" | "category";

type AllocationItem = {
  name: string;
  value: number;
  color: string;
};

type AllocationCardProps = {
  view: AllocationView;
  onViewChange: (view: AllocationView) => void;
  data: AllocationItem[];
  total: number;
  reportingCurrency: string;
  formatValue: (value: number) => string;
};

export function AllocationCard({
  view,
  onViewChange,
  data,
  total,
  reportingCurrency,
  formatValue,
}: AllocationCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("overview.allocation")}</h2>
            <p className="mt-1 text-sm text-[#718174]">
              {view === "asset"
                ? t("overview.portfolioWeightByAsset")
                : t("overview.portfolioWeightByCategory")}
            </p>
            <div className="mt-3 w-40">
              <Label htmlFor="allocation-filter" className="sr-only">
                {t("overview.groupAllocationBy")}
              </Label>
              <Select
                value={view}
                onValueChange={(value) => onViewChange(value as AllocationView)}
              >
                <SelectTrigger
                  id="allocation-filter"
                  className="h-8 bg-[#eff3ed] text-xs dark:bg-[#273a2f]"
                >
                  <SelectValue>
                    {(value) => t(`overview.${value}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  sideOffset={6}
                  align="start"
                  alignItemWithTrigger={false}
                >
                  <SelectItem value="asset">{t("overview.asset")}</SelectItem>
                  <SelectItem value="category">{t("overview.category")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-[#eff3ed] text-[#486451] dark:bg-[#273a2f] dark:text-[#c8d9cb]"
          >
            {reportingCurrency}
          </Badge>
        </div>
        {data.length ? (
          <>
            <div className="relative mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatValue(Number(value ?? 0))}
                    wrapperStyle={{ zIndex: 20 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #dce5de",
                      boxShadow: "none",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 z-0 grid place-items-center text-center">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">
                    {data.length}
                  </p>
                  <p className="text-xs text-[#718174]">
                    {view === "asset" ? t("overview.assets") : t("overview.categories")}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {data.slice(0, 5).map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="max-w-36 truncate text-[#405246]">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-medium">
                    {((item.value / total) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid h-72 place-items-center text-center text-sm text-[#718174]">
            {t("overview.liveValues")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
