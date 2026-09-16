"use client";

import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DataManagementCardProps = {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
};

export function DataManagementCard({
  onImport,
  onExport,
}: DataManagementCardProps) {
  const { t } = useTranslation();
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
      <CardContent className="flex flex-col items-start justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">{t("settings.data")}</h2>
          <p className="mt-1 text-sm text-[#718174]">
            {t("settings.dataDescription")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={onImport}
          />
          <Button
            variant="outline"
            className="border-[#dce5de] bg-white"
            onClick={() => importInputRef.current?.click()}
          >
            <Download />
            {t("actions.importAssets")}
          </Button>
          <Button
            className="bg-[#283f34] text-white hover:bg-[#1e3028]"
            onClick={onExport}
          >
            <Upload />
            {t("actions.exportAssets")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
