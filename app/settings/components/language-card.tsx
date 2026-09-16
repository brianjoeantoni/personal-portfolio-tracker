"use client";

import { useTranslation } from "react-i18next";
import { type Locale } from "@/app/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LanguageCardProps = {
  value: Locale;
  onValueChange: (locale: Locale) => void;
};

export function LanguageCard({ value, onValueChange }: LanguageCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-6 px-6 py-5">
          <div>
            <Label htmlFor="app-language" className="font-semibold">
              {t("settings.language")}
            </Label>
            <p className="mt-1 text-sm text-[#718174]">
              {t("settings.languageDescription")}
            </p>
          </div>
          <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as Locale)}>
            <SelectTrigger id="app-language" className="w-24 bg-[#eff3ed] dark:bg-[#273a2f]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={6} align="start" alignItemWithTrigger={false}>
              <SelectItem value="en">en</SelectItem>
              <SelectItem value="id">id</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
