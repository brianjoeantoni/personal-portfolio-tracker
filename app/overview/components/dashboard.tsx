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
  ShieldCheck,
  Moon,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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
  reportingCurrencies,
  reportingCurrencyLabel,
  type Currency,
  type FxRates,
} from "@/app/lib/currency";

type AssetType = "stock" | "gold" | "cash" | "custom";

const assetTypeLabels: Record<AssetType, string> = {
  stock: "Stock / ETF",
  gold: "Gold",
  cash: "Cash / bank balance",
  custom: "Custom asset",
};

const allocationViewLabels = {
  asset: "Asset",
  category: "Category",
} as const;
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

const ASSET_KEY = "net-worth-assets-v1";
const MARKET_KEY = "net-worth-market-v1";
const REPORTING_CURRENCY_KEY = "net-worth-reporting-currency";
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
      staleTime: 5 * 60 * 1000,
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

function parsePortfolioBackup(value: unknown): PortfolioBackup {
  if (!value || typeof value !== "object")
    throw new Error("Choose a valid portfolio backup file.");
  const backup = value as Partial<PortfolioBackup>;
  if (!Array.isArray(backup.assets))
    throw new Error("This file does not contain a portfolio.");
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
  if (!validAssets) throw new Error("This backup contains invalid assets.");
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
function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(
    value || 0,
  );
}
function timeLabel(iso?: string) {
  return iso
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
        timeZoneName: "short",
      }).format(new Date(iso))
    : "No market data yet";
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
    ? `${reportingCurrency} rate unavailable`
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
      ? "Quantity"
      : type === "gold"
        ? "Weight (grams)"
        : type === "cash"
          ? "Balance"
          : "Current value";
  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="asset-type">Asset type</Label>
        <Select
          value={type}
          onValueChange={(value) => setType(value as AssetType)}
        >
          <SelectTrigger id="asset-type">
            <SelectValue>
              {(value) => assetTypeLabels[value as AssetType]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            side="bottom"
            sideOffset={6}
            align="start"
            alignItemWithTrigger={false}
            className="w-56"
          >
            <SelectItem value="stock">Stock / ETF</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="cash">Cash / bank balance</SelectItem>
            <SelectItem value="custom">Custom asset</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {type !== "stock" && (
        <div className="space-y-2">
          <Label htmlFor="asset-name">Name</Label>
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
                  : "e.g. Vanguard S&P 500 ETF"
            }
          />
        </div>
      )}
      {type === "stock" && (
        <div className="space-y-2">
          <Label>Stock / ETF</Label>
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
              placeholder="Search VOO, BBRI, or a company name"
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
                    ? "Searching Yahoo Finance…"
                    : searchState === "error"
                      ? "Search unavailable. Try again."
                      : searchQuery.trim().length < 2
                        ? "Type at least 2 characters."
                        : "No matching stock or ETF found."}
                </ComboboxEmpty>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <p className="text-xs text-[#718174]">
            Select a Yahoo Finance result to continue.
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
          <Label>Currency</Label>
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
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-[#283f34] text-white hover:bg-[#1e3028]"
        >
          {asset ? "Save changes" : "Add asset"}
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
  return (
    <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="font-semibold">
              {compact ? "Your assets" : "All assets"}
            </h2>
            <p className="mt-1 text-sm text-[#718174]">
              {compact
                ? "A snapshot of what you own"
                : `Values are reported in ${reportingCurrency}`}
            </p>
          </div>
          {compact && <ArrowUpRight className="text-[#678072]" size={18} />}
        </div>
        <div className="divide-y divide-[#edf0ed]">
          {rows.map(({ asset, value }) => {
            const quote = quoteFor(asset, market);
            const amount =
              asset.type === "gold"
                ? `${formatNumber(asset.quantity ?? 0)} g`
                : asset.type === "stock"
                  ? `${formatNumber(asset.quantity ?? 0)} shares`
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
                        Stale
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
                        ? "Awaiting FX"
                        : asset.type === "cash" && asset.currency === "IDR"
                          ? "Manual value"
                          : "Price unavailable"}
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
                          Actions for {asset.name}
                        </span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(asset)}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(asset.id)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
        {compact && rows.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-[#718174]">
            No assets to show.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type DashboardView = "overview" | "assets" | "settings";

export function Dashboard({ view }: { view: DashboardView }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [market, setMarket] = useState<MarketData>(emptyMarket);
  const [hydrated, setHydrated] = useState(false);
  const [allocationView, setAllocationView] = useState<"asset" | "category">(
    "asset",
  );
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
  const marketQuery = useQuery({
    queryKey: ["market-data", assets],
    queryFn: () => fetchMarketData(assets),
    enabled: hydrated && assets.length > 0,
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
        setPendingImport(parsePortfolioBackup(JSON.parse(text)));
      })
      .catch((error: unknown) => {
        setPendingImport(undefined);
        setImportError(
          error instanceof Error
            ? error.message
            : "Could not read that portfolio backup.",
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
          ? "Stocks & ETFs"
          : type === "gold"
            ? "Gold"
            : type === "cash"
              ? "Cash & bank"
              : "Custom assets",
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
      label: "Invested assets",
      value: assets
        .filter((asset) => asset.type === "stock" || asset.type === "gold")
        .reduce((sum, asset) => sum + assetValue(asset, market), 0),
      icon: TrendingUp,
    },
    {
      label: "Cash & deposits",
      value: assets
        .filter((asset) => asset.type === "cash")
        .reduce((sum, asset) => sum + assetValue(asset, market), 0),
      icon: WalletCards,
    },
    {
      label: "Other assets",
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
                  <span className="text-[#718174]">Personal finance</span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {view === "overview"
                      ? "Portfolio overview"
                      : view === "assets"
                        ? "All assets"
                        : "Settings"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label={`Switch to ${activeTheme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${activeTheme === "dark" ? "light" : "dark"} mode`}
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
                    aria-label="Portfolio settings"
                    title="Portfolio settings"
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
                  Import assets
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-nowrap"
                  onClick={exportPortfolio}
                >
                  <Download />
                  Export assets
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-base font-medium text-[#678072]">
                  Personal finance
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {view === "overview"
                    ? "Overview"
                    : view === "assets"
                      ? "Assets"
                      : "Settings"}
                </h1>
              </div>
              {view !== "settings" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div id="market-data" className="text-sm text-[#678072]">
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${allStale ? "bg-amber-400" : hasPrices ? "bg-emerald-500" : "bg-[#a9b7ae]"}`}
                  />
                  {hasPrices
                    ? `${allStale ? "Using last known prices · " : "Market data · "}${timeLabel(updatedAt)}`
                    : "Add an asset to load market data"}
                </div>
                <Button
                  variant="outline"
                  onClick={() => marketQuery.refetch()}
                  disabled={assets.length === 0 || marketQuery.isFetching}
                  className="border-[#dce5de] bg-white"
                >
                  <RefreshCw
                    className={marketQuery.isFetching ? "animate-spin" : ""}
                  />
                  Refresh prices
                </Button>
                <Button
                  onClick={openNew}
                  className="bg-[#283f34] text-white hover:bg-[#1e3028]"
                >
                  <Plus />
                  Add asset
                </Button>
                </div>
              )}
            </header>
            {importError && (
              <p role="alert" className="-mt-5 mb-5 text-sm text-destructive">
                {importError}
              </p>
            )}
            {view === "settings" ? (
              <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between gap-6 px-6 py-5">
                    <div>
                      <Label
                        htmlFor="reporting-currency"
                        className="font-semibold"
                      >
                        Reporting currency
                      </Label>
                      <p className="mt-1 text-sm text-[#718174]">
                        Used for all dashboard values and price tooltips.
                      </p>
                    </div>
                    <Select
                      value={reportingCurrency}
                      onValueChange={(value) =>
                        setReportingCurrency(value as Currency)
                      }
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
            ) : assets.length === 0 ? (
              <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
                <CardContent className="flex min-h-[470px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#eef3e9] text-[#486451]">
                    <Banknote size={28} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Your dashboard starts here
                  </h2>
                  <p className="mt-2 max-w-sm text-[15px] leading-6 text-[#678072]">
                    Add the assets you own and we’ll convert their current value
                    to {reportingCurrencyLabel(reportingCurrency)}.
                  </p>
                  <Button
                    className="mt-7 bg-[#283f34] text-white hover:bg-[#1e3028]"
                    onClick={openNew}
                  >
                    <Plus />
                    Add your first asset
                  </Button>
                  <p className="mt-5 text-xs text-[#8b9a90]">
                    Your portfolio stays on this device.
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
              <div className="space-y-6">
                <section className="overflow-hidden rounded-3xl bg-[#283f34] px-6 py-7 text-white shadow-[0_18px_45px_rgba(40,63,52,0.12)] sm:px-8 sm:py-9">
                  <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-sm font-medium text-[#b6c6a9]">
                        Total net worth
                      </p>
                      <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                        {formatReportingValue(
                          total,
                          reportingCurrency,
                          market,
                        )}
                      </p>
                      <p className="mt-3 text-sm text-[#d1ddc8]">
                        {usdIdrQuote
                          ? `${usdIdrQuote.isStale ? "Last known USD/IDR" : "USD/IDR"} | USD 1 = ${formatIDR(usdIdrQuote.price)}`
                          : "USD/IDR rate unavailable"}
                      </p>
                      <p className="mt-4 flex items-center gap-1.5 text-sm text-[#d1ddc8]">
                        <ShieldCheck size={16} />
                        Calculated from {assets.length}{" "}
                        {assets.length === 1 ? "asset" : "assets"}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={openNew}
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
                            {formatReportingValue(
                              item.value,
                              reportingCurrency,
                              market,
                            )}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </section>
                <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
                  <AssetTable
                    rows={assetRows.slice(0, 5)}
                    total={total}
                    market={market}
                    reportingCurrency={reportingCurrency}
                    onEdit={openEdit}
                    onDelete={deleteAsset}
                    compact
                  />
                  <Card className="dashboard-card border-[#dce5de] bg-white shadow-none">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">Allocation</h2>
                          <p className="mt-1 text-sm text-[#718174]">
                            {allocationView === "asset"
                              ? "Portfolio weight by asset"
                              : "Portfolio weight by category"}
                          </p>
                          <div className="mt-3 w-40">
                            <Label
                              htmlFor="allocation-filter"
                              className="sr-only"
                            >
                              Group allocation by
                            </Label>
                            <Select
                              value={allocationView}
                              onValueChange={(value) =>
                                setAllocationView(value as "asset" | "category")
                              }
                            >
                              <SelectTrigger
                                id="allocation-filter"
                                className="h-8 bg-[#eff3ed] text-xs dark:bg-[#273a2f]"
                              >
                                <SelectValue>
                                  {(value) =>
                                    allocationViewLabels[
                                      value as "asset" | "category"
                                    ]
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent
                                side="bottom"
                                sideOffset={6}
                                align="start"
                                alignItemWithTrigger={false}
                              >
                                <SelectItem value="asset">Asset</SelectItem>
                                <SelectItem value="category">
                                  Category
                                </SelectItem>
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
                      {chartData.length ? (
                        <>
                          <div className="relative mt-4 h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={62}
                                  outerRadius={88}
                                  paddingAngle={3}
                                  stroke="none"
                                >
                                  {chartData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) =>
                                    formatReportingValue(
                                      Number(value ?? 0),
                                      reportingCurrency,
                                      market,
                                    )
                                  }
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
                                  {chartData.length}
                                </p>
                                <p className="text-xs text-[#718174]">
                                  {allocationView === "asset"
                                    ? "assets"
                                    : "categories"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {chartData.slice(0, 5).map((item) => (
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
                          Live values will appear after a successful price
                          refresh.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>
              </div>
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
                  {editing ? "Edit asset" : "Add an asset"}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? "Update the details stored on this device."
                    : "Enter a holding, balance, or manually valued asset."}
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
                <DialogTitle>Replace these assets?</DialogTitle>
                <DialogDescription>
                  This backup contains {pendingImport?.assets.length ?? 0}{" "}
                  {pendingImport?.assets.length === 1 ? "asset" : "assets"}.
                  Importing it will replace the assets currently stored on this
                  device.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingImport(undefined)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={confirmImport}
                  className="bg-[#283f34] text-white hover:bg-[#1e3028]"
                >
                  Replace assets
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
