"use client";

import { reportingCurrencies, type Currency } from "@/app/lib/currency";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReportingCurrencyCardProps = {
  value: Currency;
  onValueChange: (currency: Currency) => void;
};

export function ReportingCurrencyCard({
  value,
  onValueChange,
}: ReportingCurrencyCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-6 px-6 py-5">
          <div>
            <Label htmlFor="reporting-currency" className="font-semibold">
              {t("settings.reportingCurrency")}
            </Label>
            <p className="mt-1 text-sm text-[#718174]">
              {t("settings.reportingCurrencyDescription")}
            </p>
          </div>
          <Select
            value={value}
            onValueChange={(nextValue) => onValueChange(nextValue as Currency)}
          >
            <SelectTrigger
              id="reporting-currency"
              className="w-24 bg-[#eff3ed] dark:bg-[#273a2f]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              sideOffset={6}
              align="start"
              alignItemWithTrigger={false}
            >
              {reportingCurrencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
