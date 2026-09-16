"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  Coins,
  Download,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Moon,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { AppSidebar } from "@/components/app-sidebar";
import { type AllocationView } from "@/app/overview/components/allocation-card";
import { OverviewContent } from "@/app/overview/components/overview-content";
import { ReportingCurrencyCard } from "@/app/settings/components/reporting-currency-card";
import { LanguageCard } from "@/app/settings/components/language-card";
import { useLocale } from "@/components/locale-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import {
  assetCurrencies,
  assetCurrencyCodes,
  baseCurrency,
  currencies,
  convertFromIdr,
  convertToIdr,
  defaultAssetCurrency,
  defaultReportingCurrency,
  formatCurrency,
  isAssetCurrency,
  isReportingCurrency,
  idrRateFor,
  type Currency,
  type FxRates,
} from "@/app/lib/currency";

type AssetType = "stock" | "gold" | "cash" | "custom";

const assetTypeTranslationKeys: Record<AssetType, string> = {
  stock: "assetForm.stock",
  gold: "assetForm.gold",
  cash: "assetForm.cash",
  custom: "assetForm.custom",
};

function assetTypeLabel(type: AssetType, t: TFunction) {
  return t(assetTypeTranslationKeys[type]);
}

type Asset = {
  id: string;
  type: AssetType;
  name: string;
  currency: Currency;
  quantity?: number;
  symbol?: string;
  value?: number;
};
type Quote = {
  price: number;
  currency: Currency;
  updatedAt: string;
  isStale: boolean;
  source: string;
};
type MarketData = {
  fxRates: Partial<Record<Currency, Quote>>;
  gold?: Quote;
  stocks: Record<string, Quote>;
};
type PortfolioBackup = {
  version: 1;
  exportedAt: string;
  assets: Asset[];
  market?: MarketData;
};
type YahooInstrument = {
  symbol: string;
  name: string;
  exchange: string;
  currency: Currency;
};
type ExchangeRateResponse = { rates?: Partial<Record<Currency, number>> };
type WebMCPContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

const ASSET_KEY = "personal-portfolio-tracker-assets-v1";
const MARKET_KEY = "personal-portfolio-tracker-market-v1";
const REPORTING_CURRENCY_KEY = "personal-portfolio-tracker-reporting-currency";
const MARKET_CACHE_TTL_MS = 15 * 60 * 1000;
const colors = [
  "#d7f268",
  "#7b9e89",
  "#f3b56b",
  "#a9c7e8",
  "#c9b6f1",
  "#f3a6b3",
];
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MARKET_CACHE_TTL_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
const emptyMarket: MarketData = { fxRates: {}, stocks: {} };

function normalizeMarketData(value: unknown): MarketData {
  if (!value || typeof value !== "object") return emptyMarket;
  const market = value as Partial<MarketData> & { usdIdr?: Quote };
  return {
    fxRates:
      market.fxRates && typeof market.fxRates === "object"
        ? market.fxRates
        : market.usdIdr
          ? { USD: market.usdIdr }
          : {},
    gold: market.gold,
    stocks:
      market.stocks && typeof market.stocks === "object" ? market.stocks : {},
  };
}

function marketFxRates(market: MarketData): FxRates {
  return Object.fromEntries(
    Object.entries(market.fxRates).map(([currency, quote]) => [
      currency,
      quote.price,
    ]),
  ) as FxRates;
}

function isQuoteCurrent(quote: Quote | undefined, now: number) {
  if (!quote || quote.isStale) return false;
  const updatedAt = Date.parse(quote.updatedAt);
  return (
    Number.isFinite(updatedAt) &&
    updatedAt <= now &&
    now - updatedAt < MARKET_CACHE_TTL_MS
  );
}

function marketNeedsRefresh(
  assets: Asset[],
  reportingCurrency: Currency,
  market: MarketData,
) {
  if (assets.length === 0) return false;

  const now = Date.now();
  const requiredCurrencies = new Set<Currency>([reportingCurrency, "USD"]);

  for (const asset of assets) {
    if (asset.type !== "gold") requiredCurrencies.add(asset.currency);
    if (
      asset.type === "stock" &&
      !isQuoteCurrent(market.stocks[asset.id], now)
    )
      return true;
  }

  if (
    assets.some(
      (asset) =>
        asset.type === "gold" && !isQuoteCurrent(market.gold, now),
    )
  )
    return true;

  return [...requiredCurrencies].some(
    (currency) =>
      currency !== baseCurrency &&
      !isQuoteCurrent(market.fxRates[currency], now),
  );
}

function parsePortfolioBackup(value: unknown, t: TFunction): PortfolioBackup {
  if (!value || typeof value !== "object")
    throw new Error(t("import.invalidBackup"));
  const backup = value as Partial<PortfolioBackup>;
  if (!Array.isArray(backup.assets))
    throw new Error(t("import.missingPortfolio"));
  const validTypes: AssetType[] = ["stock", "gold", "cash", "custom"];
  const validAssets = backup.assets.every((asset) => {
    if (!asset || typeof asset !== "object") return false;
    const item = asset as Partial<Asset>;
    return (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      validTypes.includes(item.type as AssetType) &&
      isAssetCurrency(item.currency)
    );
  });
  if (!validAssets) throw new Error(t("import.invalidAssets"));
  const market =
    backup.market &&
    typeof backup.market === "object" &&
    "stocks" in backup.market &&
    backup.market.stocks &&
    typeof backup.market.stocks === "object"
      ? normalizeMarketData(backup.market)
      : undefined;
  return {
    version: 1,
    exportedAt:
      typeof backup.exportedAt === "string"
        ? backup.exportedAt
        : new Date().toISOString(),
    assets: backup.assets as Asset[],
    market,
  };
}

function formatIDR(value: number) {
  return formatCurrency(value, baseCurrency);
}
function formatMoney(value: number, currency: Currency) {
  return formatCurrency(value, currency);
}
function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
    value || 0,
  );
}
function timeLabel(iso: string | undefined, locale: string) {
  return iso
    ? new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
        timeZoneName: "short",
      }).format(new Date(iso))
    : "";
}

async function yahooPrice(
  symbol: string,
): Promise<{ price: number; currency: Currency }> {
  const response = await fetch(
    `/api/yahoo-quote?symbol=${encodeURIComponent(symbol)}`,
  );
  if (!response.ok) throw new Error(`Could not fetch ${symbol}`);
  return response.json();
}

async function searchYahooInstruments(
  query: string,
): Promise<YahooInstrument[]> {
  const response = await fetch(
    `/api/yahoo-search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) throw new Error("Search unavailable");
  return response.json();
}

async function fetchMarketData(assets: Asset[]): Promise<MarketData> {
  const now = new Date().toISOString();
  const next: MarketData = { fxRates: {}, stocks: {} };
  const fxRates = await fetch("https://open.er-api.com/v6/latest/IDR")
    .then(async (response) => {
      if (!response.ok) throw new Error("FX unavailable");
      const data = (await response.json()) as ExchangeRateResponse;
      return Object.fromEntries(
        currencies
          .filter((currency) => currency.code !== baseCurrency)
          .flatMap((currency) => {
            const unitsPerIdr = data.rates?.[currency.code];
            return unitsPerIdr && unitsPerIdr > 0
              ? [
                  [
                    currency.code,
                    {
                      price: 1 / unitsPerIdr,
                      currency: baseCurrency,
                      updatedAt: now,
                      isStale: false,
                      source: "ExchangeRate-API",
                    },
                  ],
                ]
              : [];
          }),
      ) as Partial<Record<Currency, Quote>>;
    })
    .catch(() => ({}));
  next.fxRates = fxRates;
  const stocks = assets.filter(
    (asset) => asset.type === "stock" && asset.symbol,
  );
  const results = await Promise.allSettled(
    stocks.map((asset) => yahooPrice(asset.symbol!)),
  );
  results.forEach((result, index) => {
    if (result.status === "fulfilled")
      next.stocks[stocks[index].id] = {
        ...result.value,
        updatedAt: now,
        isStale: false,
        source: "Yahoo Finance",
      };
  });
  const usdIdr = idrRateFor("USD", marketFxRates(next));
  if (assets.some((asset) => asset.type === "gold") && usdIdr)
    try {
      const spot = await yahooPrice("GC=F");
      next.gold = {
        price: (spot.price * usdIdr) / 31.1034768,
        currency: baseCurrency,
        updatedAt: now,
        isStale: false,
        source: "Gold futures reference",
      };
    } catch {
      /* preserve cached reference */
    }
  return next;
}

function mergeMarket(previous: MarketData, incoming: MarketData): MarketData {
  const staleFxRates = Object.fromEntries(
    Object.entries(previous.fxRates).map(([currency, quote]) => [
      currency,
      { ...quote, isStale: true },
    ]),
  ) as Partial<Record<Currency, Quote>>;
  const staleStocks = Object.fromEntries(
    Object.entries(previous.stocks).map(([id, quote]) => [
      id,
      { ...quote, isStale: true },
    ]),
  );
  return {
    fxRates: { ...staleFxRates, ...incoming.fxRates },
    gold:
      incoming.gold ??
      (previous.gold ? { ...previous.gold, isStale: true } : undefined),
    stocks: { ...staleStocks, ...incoming.stocks },
  };
}
function quoteFor(asset: Asset, market: MarketData) {
  if (asset.type === "stock") return market.stocks[asset.id];
  if (asset.type === "gold") return market.gold;
  return market.fxRates[asset.currency];
}
function assetValue(asset: Asset, market: MarketData) {
  const fxRates = marketFxRates(market);
  if (asset.type === "cash" || asset.type === "custom")
    return convertToIdr(asset.value ?? 0, asset.currency, fxRates) ?? 0;
  const quote = quoteFor(asset, market);
  if (!quote) return 0;
  const quantity = asset.quantity ?? 0;
  return convertToIdr(quantity * quote.price, quote.currency, fxRates) ?? 0;
}
function formatReportingValue(
  value: number,
  reportingCurrency: Currency,
  market: MarketData,
) {
  const convertedValue = convertFromIdr(
    value,
    reportingCurrency,
    marketFxRates(market),
  );
  return convertedValue === undefined
    ? "—"
    : formatCurrency(convertedValue, reportingCurrency);
}
function AssetIcon({ type }: { type: AssetType }) {
  const props = { size: 17, strokeWidth: 1.8 };
  if (type === "stock") return <TrendingUp {...props} />;
  if (type === "gold") return <Coins {...props} />;
  if (type === "cash") return <Landmark {...props} />;
  return <BriefcaseBusiness {...props} />;
}

function AssetForm({
  asset,
  onSave,
  onClose,
}: {
  asset?: Asset;
  onSave: (asset: Asset) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<AssetType>(asset?.type ?? "stock");
  const [name, setName] = useState(asset?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(
    asset?.currency ?? defaultAssetCurrency,
  );
  const [selectedInstrument, setSelectedInstrument] = useState<
    YahooInstrument | undefined
  >(
    asset?.type === "stock" && asset.symbol
      ? {
          symbol: asset.symbol,
          name: asset.name,
          exchange: "Saved holding",
          currency: asset.currency,
        }
      : undefined,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YahooInstrument[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [amount, setAmount] = useState(
    String(asset?.quantity ?? asset?.value ?? ""),
  );
  useEffect(() => {
    if (type !== "stock" || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchState("idle");
      return;
    }
    const timeout = window.setTimeout(() => {
      setSearchState("loading");
      searchYahooInstruments(searchQuery)
        .then((results) => {
          setSearchResults(results);
          setSearchState("idle");
        })
        .catch(() => {
          setSearchResults([]);
          setSearchState("error");
        });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchQuery, type]);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !Number(amount) ||
      (type === "stock" && !selectedInstrument) ||
      (type !== "stock" && !name.trim())
    )
      return;
    onSave({
      id: asset?.id ?? crypto.randomUUID(),
      type,
      name: type === "stock" ? selectedInstrument!.name : name.trim(),
      currency,
      ...(type === "stock"
        ? {
            symbol: selectedInstrument!.symbol,
            quantity: Number(amount),
            currency: selectedInstrument!.currency,
          }
        : {}),
      ...(type === "gold"
        ? { quantity: Number(amount), currency: baseCurrency }
        : {}),
      ...(type === "cash" || type === "custom"
        ? { value: Number(amount) }
        : {}),
    });
  }
  const amountLabel =
    type === "stock"
      ? t("assetForm.quantity")
      : type === "gold"
        ? t("assetForm.weight")
        : type === "cash"
          ? t("assetForm.balance")
          : t("assetForm.currentValue");
  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="asset-type">{t("assetForm.assetType")}</Label>
        <Select
          value={type}
          onValueChange={(value) => setType(value as AssetType)}
        >
          <SelectTrigger id="asset-type">
            <SelectValue>
              {(value) => assetTypeLabel(value as AssetType, t)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            side="bottom"
            sideOffset={6}
            align="start"
            alignItemWithTrigger={false}
            className="w-56"
          >
            <SelectItem value="stock">{t("assetForm.stock")}</SelectItem>
            <SelectItem value="gold">{t("assetForm.gold")}</SelectItem>
            <SelectItem value="cash">{t("assetForm.cash")}</SelectItem>
            <SelectItem value="custom">{t("assetForm.custom")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {type !== "stock" && (
        <div className="space-y-2">
          <Label htmlFor="asset-name">{t("assetForm.name")}</Label>
          <Input
            id="asset-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              type === "gold"
                ? "UBS Gold"
                : type === "cash"
                  ? "BCA"
                  : t("assetForm.customPlaceholder")
            }
          />
        </div>
      )}
      {type === "stock" && (
        <div className="space-y-2">
          <Label>{t("assetForm.stock")}</Label>
          <Combobox
            value={selectedInstrument ?? null}
            onValueChange={(instrument) => {
              if (instrument) {
                setSelectedInstrument(instrument);
                setSearchQuery(instrument.name);
              }
            }}
            onInputValueChange={(value) => {
              setSearchQuery(value);
              if (selectedInstrument && value !== selectedInstrument.name)
                setSelectedInstrument(undefined);
            }}
            itemToStringLabel={(instrument) => instrument.name}
            itemToStringValue={(instrument) => instrument.symbol}
          >
            <ComboboxInput
              placeholder={t("assetForm.searchPlaceholder")}
              showClear
            />
            <ComboboxContent>
              <ComboboxList>
                {searchResults.map((instrument) => (
                  <ComboboxItem key={instrument.symbol} value={instrument}>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {instrument.symbol} · {instrument.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {instrument.exchange} · {instrument.currency}
                      </p>
                    </div>
                  </ComboboxItem>
                ))}
                <ComboboxEmpty>
                  {searchState === "loading"
                    ? t("assetForm.searching")
                    : searchState === "error"
                      ? t("assetForm.searchUnavailable")
                      : searchQuery.trim().length < 2
                        ? t("assetForm.typeAtLeast")
                        : t("assetForm.noMatches")}
                </ComboboxEmpty>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <p className="text-xs text-[#718174]">
            {t("assetForm.selectYahoo")}
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="asset-amount">{amountLabel}</Label>
        <Input
          id="asset-amount"
          inputMode="decimal"
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
        />
      </div>
      {type !== "gold" && type !== "stock" && (
        <div className="space-y-2">
          <Label>{t("assetForm.currency")}</Label>
          <Select
            value={currency}
            onValueChange={(value) => setCurrency(value as Currency)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              sideOffset={6}
              align="start"
              alignItemWithTrigger={false}
            >
              {assetCurrencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button
          type="submit"
          className="bg-[#283f34] text-white hover:bg-[#1e3028]"
        >
          {asset ? t("actions.saveChanges") : t("actions.addAsset")}
        </Button>
      </div>
    </form>
  );
}

function AssetTable({
  rows,
  total,
  market,
  reportingCurrency,
  onEdit,
  onDelete,
  compact = false,
}: {
  rows: { asset: Asset; value: number }[];
  total: number;
  market: MarketData;
  reportingCurrency: Currency;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="font-semibold">
              {compact ? t("assets.yourAssets") : t("assets.allAssets")}
            </h2>
            <p className="mt-1 text-sm text-[#718174]">
              {compact
                ? t("assets.snapshot")
                : t("assets.reportedIn", { currency: reportingCurrency })}
            </p>
          </div>
          {compact && <ArrowUpRight className="text-[#678072]" size={18} />}
        </div>
        <div className="divide-y divide-[#edf0ed]">
          {rows.map(({ asset, value }) => {
            const quote = quoteFor(asset, market);
            const amount =
              asset.type === "gold"
                ? t("assets.grams", {
                    value: formatNumber(asset.quantity ?? 0, i18n.language),
                  })
                : asset.type === "stock"
                  ? t((asset.quantity ?? 0) === 1 ? "assets.share" : "assets.shares", {
                      value: formatNumber(asset.quantity ?? 0, i18n.language),
                    })
                  : formatMoney(asset.value ?? 0, asset.currency);
            return (
              <div
                key={asset.id}
                className="flex items-center gap-3 px-4 py-4 sm:px-6"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff3ed] text-[#486451]">
                  <AssetIcon type={asset.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{asset.name}</p>
                    {quote?.isStale && (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700"
                      >
                        {t("assets.stale")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#718174]">
                    {asset.type === "stock"
                      ? `${asset.symbol} · ${amount}`
                      : amount}
                    {quote && (asset.type === "stock" || asset.type === "gold")
                      ? ` · ${formatMoney(quote.price, quote.currency)}${asset.type === "gold" ? "/g" : ""}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tracking-tight">
                    {value
                      ? formatReportingValue(value, reportingCurrency, market)
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#718174]">
                    {value && total
                      ? `${((value / total) * 100).toFixed(1)}%`
                      : quote
                        ? t("assets.awaitingFx")
                        : asset.type === "cash" && asset.currency === "IDR"
                          ? t("assets.manualValue")
                          : t("assets.priceUnavailable")}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-1 shrink-0 text-[#718174]"
                      >
                        <MoreHorizontal />
                        <span className="sr-only">
                          {t("assets.actionsFor", { name: asset.name })}
                        </span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(asset)}>
                      <Pencil />
                      {t("actions.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(asset.id)}
                    >
                      <Trash2 />
                      {t("actions.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
        {compact && rows.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-[#718174]">
            {t("assets.noAssetsToShow")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssetRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-[#edf0ed]">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-4 sm:px-6">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-[70%]" />
            <Skeleton className="h-3 w-28 max-w-[50%]" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="ml-auto h-3 w-10" />
          </div>
          <Skeleton className="ml-1 h-8 w-8 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton({ view }: { view: DashboardView }) {
  if (view === "settings") {
    return (
      <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-6 px-6 py-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-72 max-w-[55vw]" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view === "assets") {
    return (
      <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="space-y-2 px-6 py-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
          <AssetRowsSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-[#283f34] px-6 py-7 shadow-[0_18px_45px_rgba(40,63,52,0.12)] sm:px-8 sm:py-9">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div className="space-y-4">
            <Skeleton className="h-4 w-28 bg-white/15" />
            <Skeleton className="h-11 w-64 bg-white/15 sm:h-14" />
            <Skeleton className="h-4 w-52 bg-white/15" />
            <Skeleton className="h-4 w-36 bg-white/15" />
          </div>
          <Skeleton className="h-10 w-28 bg-white/15" />
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card
            key={index}
            className="dashboard-card border-[#dce5de] bg-white shadow-none"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
          <CardContent className="p-0">
            <div className="space-y-2 px-6 py-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
            <AssetRowsSkeleton count={3} />
          </CardContent>
        </Card>
        <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
          <CardContent className="space-y-5 p-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mx-auto h-44 w-44 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

type DashboardView = "overview" | "assets" | "settings";

export function Dashboard({ view }: { view: DashboardView }) {
  const { t, i18n } = useTranslation();
  const { locale, setLocale, ready: localeReady } = useLocale();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [market, setMarket] = useState<MarketData>(emptyMarket);
  const [hydrated, setHydrated] = useState(false);
  const [allocationView, setAllocationView] =
    useState<AllocationView>("asset");
  const [reportingCurrency, setReportingCurrency] =
    useState<Currency>(defaultReportingCurrency);
  const [reportingCurrencyReady, setReportingCurrencyReady] = useState(false);
  const [editing, setEditing] = useState<Asset | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PortfolioBackup>();
  const [importError, setImportError] = useState<string>();
  const [themeMounted, setThemeMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const assetsRef = useRef(assets);
  const importInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const activeTheme = themeMounted ? resolvedTheme : undefined;
  useEffect(() => {
    setThemeMounted(true);
  }, []);
  useEffect(() => {
    try {
      setAssets(JSON.parse(localStorage.getItem(ASSET_KEY) || "[]"));
      setMarket(
        normalizeMarketData(
          JSON.parse(
            localStorage.getItem(MARKET_KEY) || JSON.stringify(emptyMarket),
          ),
        ),
      );
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    const savedCurrency = localStorage.getItem(REPORTING_CURRENCY_KEY);
    if (isReportingCurrency(savedCurrency)) {
      setReportingCurrency(savedCurrency);
    }
    setReportingCurrencyReady(true);
  }, []);
  useEffect(() => {
    if (reportingCurrencyReady) {
      localStorage.setItem(REPORTING_CURRENCY_KEY, reportingCurrency);
    }
  }, [reportingCurrency, reportingCurrencyReady]);
  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(ASSET_KEY, JSON.stringify(assets));
  }, [assets, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(MARKET_KEY, JSON.stringify(market));
  }, [market, hydrated]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMCPContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = context.registerTool(
      {
        name: "add_portfolio_asset",
        title: "Add portfolio asset",
        description:
          "Add a stock, gold holding, cash balance, or custom asset to this device-local portfolio.",
        inputSchema: {
          type: "object",
          properties: {
            type: { enum: ["stock", "gold", "cash", "custom"] },
            name: { type: "string" },
            currency: { enum: assetCurrencyCodes },
            amount: { type: "number", exclusiveMinimum: 0 },
            symbol: { type: "string" },
          },
          required: ["type", "name", "currency", "amount"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const value = input as {
            type?: AssetType;
            name?: string;
            currency?: Currency;
            amount?: number;
            symbol?: string;
          };
          if (
            !value.type ||
            !value.name?.trim() ||
            !isAssetCurrency(value.currency) ||
            !Number.isFinite(value.amount) ||
            value.amount! <= 0 ||
            (value.type === "stock" && !value.symbol?.trim())
          )
            throw new Error(
              "Provide a valid asset type, name, currency, positive amount, and a symbol for stocks.",
            );
          const asset: Asset = {
            id: crypto.randomUUID(),
            type: value.type,
            name: value.name.trim(),
            currency: value.type === "gold" ? baseCurrency : value.currency,
            ...(value.type === "stock"
              ? {
                  symbol: value.symbol!.trim().toUpperCase(),
                  quantity: value.amount,
                }
              : {}),
            ...(value.type === "gold" ? { quantity: value.amount } : {}),
            ...(value.type === "cash" || value.type === "custom"
              ? { value: value.amount }
              : {}),
          };
          setAssets((current) => [...current, asset]);
          return {
            id: asset.id,
            name: asset.name,
            type: asset.type,
            assetCount: assetsRef.current.length + 1,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  const shouldRefreshMarket =
    hydrated && marketNeedsRefresh(assets, reportingCurrency, market);
  const marketQuery = useQuery({
    queryKey: ["market-data", assets, shouldRefreshMarket],
    queryFn: () => fetchMarketData(assets),
    enabled: shouldRefreshMarket,
  });
  useEffect(() => {
    if (marketQuery.data)
      setMarket((previous) => mergeMarket(previous, marketQuery.data!));
  }, [marketQuery.data]);
  const assetRows = useMemo(
    () =>
      assets
        .map((asset) => ({ asset, value: assetValue(asset, market) }))
        .sort((a, b) => b.value - a.value),
    [assets, market],
  );
  const total = assetRows.reduce((sum, row) => sum + row.value, 0);
  const usdIdrQuote = market.fxRates.USD;
  const updatedAt = [
    ...Object.values(market.fxRates).map((quote) => quote.updatedAt),
    market.gold?.updatedAt,
    ...Object.values(market.stocks).map((quote) => quote.updatedAt),
  ]
    .filter(Boolean)
    .sort()
    .at(-1);
  const hasPrices = Boolean(updatedAt);
  const allStale =
    hasPrices &&
    [...Object.values(market.fxRates), market.gold, ...Object.values(market.stocks)]
      .filter(Boolean)
      .every((quote) => quote!.isStale);
  function saveAsset(asset: Asset) {
    setAssets((current) =>
      current.some((item) => item.id === asset.id)
        ? current.map((item) => (item.id === asset.id ? asset : item))
        : [...current, asset],
    );
    setFormOpen(false);
    setEditing(undefined);
  }
  function deleteAsset(id: string) {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    setMarket((current) => {
      const stocks = { ...current.stocks };
      delete stocks[id];
      return { ...current, stocks };
    });
  }
  function openNew() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(asset: Asset) {
    setEditing(asset);
    setFormOpen(true);
  }
  function exportPortfolio() {
    const backup: PortfolioBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      assets,
      market,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function chooseImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void file
      .text()
      .then((text) => {
        setImportError(undefined);
        setPendingImport(parsePortfolioBackup(JSON.parse(text), t));
      })
      .catch((error: unknown) => {
        setPendingImport(undefined);
        setImportError(
          error instanceof Error
            ? error.message
            : t("import.readError"),
        );
      });
  }
  function confirmImport() {
    if (!pendingImport) return;
    setAssets(pendingImport.assets);
    setMarket(pendingImport.market ?? emptyMarket);
    setPendingImport(undefined);
  }
  const assetChartData = assetRows
    .filter((row) => row.value > 0)
    .map((row, index) => ({
      name: row.asset.name,
      value: row.value,
      color: colors[index % colors.length],
    }));
  const categoryChartData = (["stock", "gold", "cash", "custom"] as AssetType[])
    .map((type, index) => ({
      name:
        type === "stock"
          ? t("overview.stocksAndEtfs")
          : type === "gold"
            ? t("overview.gold")
            : type === "cash"
              ? t("overview.cashAndBank")
              : t("overview.customAssets"),
      value: assetRows
        .filter((row) => row.asset.type === type)
        .reduce((sum, row) => sum + row.value, 0),
      color: colors[index],
    }))
    .filter((item) => item.value > 0);
  const chartData =
    allocationView === "asset" ? assetChartData : categoryChartData;
  const summary = [
    {
      labelKey: "overview.investedAssets",
      value: assets
        .filter((asset) => asset.type === "stock" || asset.type === "gold")
        .reduce((sum, asset) => sum + assetValue(asset, market), 0),
      icon: TrendingUp,
    },
    {
      labelKey: "overview.cashAndDeposits",
      value: assets
        .filter((asset) => asset.type === "cash")
        .reduce((sum, asset) => sum + assetValue(asset, market), 0),
      icon: WalletCards,
    },
    {
      labelKey: "overview.otherAssets",
      value: assets
        .filter((asset) => asset.type === "custom")
        .reduce((sum, asset) => sum + assetValue(asset, market), 0),
      icon: BriefcaseBusiness,
    },
  ];
  return (
    <SidebarProvider>
      <AppSidebar
        activeView={view}
        onNavigate={(nextView) =>
          router.push(
            nextView === "assets"
              ? "/assets"
              : nextView === "settings"
                ? "/settings"
                : "/overview",
          )
        }
      />
      <SidebarInset>
        <main className="dashboard-main min-h-screen bg-[#f5f7f3] text-[#1d2b24]">
          <div className="dashboard-header flex h-16 shrink-0 items-center gap-2 border-b border-[#dce5de] bg-white px-4">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <span className="text-[#718174]">{t("navigation.personalFinance")}</span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {view === "overview"
                      ? t("navigation.portfolioOverview")
                      : view === "assets"
                        ? t("navigation.allAssets")
                        : t("navigation.settings")}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label={t("theme.switchTo", {
                mode: t(activeTheme === "dark" ? "theme.light" : "theme.dark"),
              })}
              title={t("theme.switchTo", {
                mode: t(activeTheme === "dark" ? "theme.light" : "theme.dark"),
              })}
              onClick={() =>
                setTheme(activeTheme === "dark" ? "light" : "dark")
              }
            >
              {activeTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={chooseImport}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("settings.portfolioSettings")}
                    title={t("settings.portfolioSettings")}
                  >
                    <Settings />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-nowrap"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload />
                  {t("actions.importAssets")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-nowrap"
                  onClick={exportPortfolio}
                >
                  <Download />
                  {t("actions.exportAssets")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-base font-medium text-[#678072]">
                  {t("navigation.personalFinance")}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {view === "overview"
                    ? t("navigation.overview")
                    : view === "assets"
                      ? t("navigation.assets")
                      : t("navigation.settings")}
                </h1>
              </div>
              {view !== "settings" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div id="market-data" className="text-sm text-[#678072]">
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${allStale ? "bg-amber-400" : hasPrices ? "bg-emerald-500" : "bg-[#a9b7ae]"}`}
                  />
                  {hasPrices
                    ? allStale
                      ? t("market.lastKnownPrices", {
                          updatedAt: timeLabel(updatedAt, i18n.language),
                        })
                      : t("market.marketData", {
                          updatedAt: timeLabel(updatedAt, i18n.language),
                        })
                    : hydrated
                      ? t("market.addAssetToLoad")
                      : t("market.loadingSavedPortfolio")}
                </div>
                <Button
                  variant="outline"
                  onClick={() => marketQuery.refetch()}
                  disabled={!hydrated || assets.length === 0 || marketQuery.isFetching}
                  className="border-[#dce5de] bg-white"
                >
                  <RefreshCw
                    className={marketQuery.isFetching ? "animate-spin" : ""}
                  />
                  {t("actions.refreshPrices")}
                </Button>
                <Button
                  onClick={openNew}
                  disabled={!hydrated}
                  className="bg-[#283f34] text-white hover:bg-[#1e3028]"
                >
                  <Plus />
                  {t("actions.addAsset")}
                </Button>
                </div>
              )}
            </header>
            {importError && (
              <p role="alert" className="-mt-5 mb-5 text-sm text-destructive">
                {importError}
              </p>
            )}
            {!hydrated || !localeReady ? (
              <DashboardSkeleton view={view} />
            ) : view === "settings" ? (
              <div className="space-y-6">
                <ReportingCurrencyCard
                  value={reportingCurrency}
                  onValueChange={setReportingCurrency}
                />
                <LanguageCard value={locale} onValueChange={setLocale} />
              </div>
            ) : assets.length === 0 ? (
              <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
                <CardContent className="flex min-h-[470px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#eef3e9] text-[#486451]">
                    <Banknote size={28} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {t("empty.title")}
                  </h2>
                  <p className="mt-2 max-w-sm text-[15px] leading-6 text-[#678072]">
                    {t("empty.description", {
                      currency: t(`currency.${reportingCurrency}`),
                    })}
                  </p>
                  <Button
                    className="mt-7 bg-[#283f34] text-white hover:bg-[#1e3028]"
                    onClick={openNew}
                  >
                    <Plus />
                    {t("actions.addFirstAsset")}
                  </Button>
                  <p className="mt-5 text-xs text-[#8b9a90]">
                    {t("empty.storedOnDevice")}
                  </p>
                </CardContent>
              </Card>
            ) : view === "assets" ? (
              <AssetTable
                rows={assetRows}
                total={total}
                market={market}
                reportingCurrency={reportingCurrency}
                onEdit={openEdit}
                onDelete={deleteAsset}
              />
            ) : (
              <OverviewContent
                total={total}
                assetCount={assets.length}
                usdIdrRateLabel={
                  usdIdrQuote
                    ? `${usdIdrQuote.isStale ? t("overview.lastKnownUsdIdr") : t("overview.usdIdr")} | USD 1 = ${formatIDR(usdIdrQuote.price)}`
                    : t("overview.usdIdrUnavailable")
                }
                summary={summary}
                assetSnapshot={
                  <AssetTable
                    rows={assetRows.slice(0, 5)}
                    total={total}
                    market={market}
                    reportingCurrency={reportingCurrency}
                    onEdit={openEdit}
                    onDelete={deleteAsset}
                    compact
                  />
                }
                allocationView={allocationView}
                onAllocationViewChange={setAllocationView}
                allocationData={chartData}
                reportingCurrency={reportingCurrency}
                formatValue={(value) =>
                  formatReportingValue(value, reportingCurrency, market)
                }
                onAddAsset={openNew}
              />
            )}
          </div>
          <Dialog
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) setEditing(undefined);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editing ? t("assetForm.editTitle") : t("assetForm.addTitle")}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? t("assetForm.editDescription")
                    : t("assetForm.addDescription")}
                </DialogDescription>
              </DialogHeader>
              <AssetForm
                asset={editing}
                onSave={saveAsset}
                onClose={() => setFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog
            open={Boolean(pendingImport)}
            onOpenChange={(open) => {
              if (!open) setPendingImport(undefined);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("import.replaceTitle")}</DialogTitle>
                <DialogDescription>
                  {t("import.replaceDescription", {
                    count: pendingImport?.assets.length ?? 0,
                  })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingImport(undefined)}
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={confirmImport}
                  className="bg-[#283f34] text-white hover:bg-[#1e3028]"
                >
                  {t("actions.replaceAssets")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardPage({ view }: { view: DashboardView }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard view={view} />
    </QueryClientProvider>
  );
}
