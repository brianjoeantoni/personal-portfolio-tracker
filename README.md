# Personal Portfolio Tracker

A private, local-first dashboard for tracking a personal portfolio. Add stocks,
ETFs, gold, cash, and custom assets; the app fetches available market prices,
converts everything to a selected reporting currency, and visualizes portfolio
allocation.

The app is designed for one person using one browser. Portfolio data is stored
on that device and is not saved in a database or sent to an account.

## Features

- Overview, Assets, and Settings routes.
- Stock and ETF search with live Yahoo Finance quotes.
- Gold valuation from Yahoo Finance's `GC=F` gold-futures reference.
- Cash and custom assets with manually entered values.
- IDR and USD reporting currencies, with a settings-based preference.
- English and Bahasa Indonesia interface translations, with a settings-based preference.
- Asset and category allocation views.
- Cached market prices with a stale-price indicator when a refresh fails.
- JSON export and import for moving or backing up the local portfolio.
- Light and dark themes that persist across page refreshes.
- A small WebMCP `add_portfolio_asset` tool for compatible agent hosts.

## Tech stack

| Area | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS, shadcn/Base UI components |
| Routing and rendering | Vinext, powered by Vite |
| Client data fetching | TanStack Query |
| Charts | Recharts |
| Theme preference | next-themes |
| Internationalization | i18next and react-i18next |
| Icons | Lucide React |
| Deployment | Cloudflare Workers |
| Market data | Yahoo Finance and ExchangeRate-API |

Vinext provides a Next-compatible app and file-routing model while using Vite
for development and builds. It is not a full Next.js installation.

## Requirements

- Node.js 22.13 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by the development server (normally
`http://localhost:3000`).

Useful commands:

```bash
npm run build   # Production build
npm run start   # Run the built Cloudflare Worker locally
npm run lint    # Run Oxlint
npm run format  # Format with Oxfmt
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/overview` |
| `/overview` | Portfolio summary, asset snapshot, allocation chart |
| `/assets` | Full asset list and asset management |
| `/settings` | Reporting-currency and app-language selection |

## Project structure

```text
app/
  api/
    yahoo-quote/route.ts       # Proxies and validates a Yahoo quote
    yahoo-search/route.ts      # Proxies and filters Yahoo search results
  assets/
    page.tsx                   # /assets route
  lib/
    currency.ts                # Currency registry, formatting, and conversion
    i18n.ts                    # Locale registry and i18next setup
  locales/
    en/common.json             # English interface copy
    id/common.json             # Bahasa Indonesia interface copy
  overview/
    components/
      allocation-card.tsx      # Allocation filter and pie chart
      overview-content.tsx     # Overview-specific layout
    page.tsx                   # /overview route
  settings/
    components/
      language-card.tsx
      reporting-currency-card.tsx
    page.tsx                   # /settings route
  layout.tsx                   # Metadata, fonts, providers
  page.tsx                     # Redirect to /overview
components/
  app-sidebar.tsx              # Main navigation
  dashboard.tsx                # Shared state, shell, and reusable asset UI
  locale-provider.tsx          # Persisted app-language provider
  theme-provider.tsx           # next-themes wrapper
  ui/                          # Reusable UI primitives
public/
  favicon.svg
```

The route pages render the same dashboard component with a different view name,
so portfolio state, market data, theme controls, and import/export behavior
stay consistent as the user moves between pages.

## Data and privacy

### Device-local portfolio

The browser's local storage holds the portfolio, cached market data, and the
reporting-currency and language preferences. Clearing browser site data clears the portfolio,
unless it has been exported first.

Use the gear menu in the top bar to export a JSON backup before changing
browsers, devices, or browser storage. Import replaces the current local
portfolio after confirmation.

### Market data

- **Stocks and ETFs:** Yahoo Finance search and chart endpoints, accessed
  through the app's `/api/yahoo-search` and `/api/yahoo-quote` routes.
- **Gold:** Yahoo Finance's `GC=F` reference converted from troy ounces to
  grams. It is a general market reference, not an official UBS buyback price.
- **Foreign exchange:** ExchangeRate-API's public latest-rates endpoint, with
  IDR as the internal base currency.

Prices are informational and may be delayed, unavailable, or different from a
broker's executable price. A failed refresh keeps the last available quote and
marks it stale where applicable. Cached market data is reused for 15 minutes;
the **Refresh prices** button always performs an immediate refresh.

## Currency architecture

All supported currencies live in `app/lib/currency.ts`. That registry is the
single source of truth for:

- Display labels, locales, and decimal precision.
- Whether a currency can be used for an asset's native value.
- Whether a currency can be selected as the reporting currency.
- Asset-form and Settings dropdown options.
- Import and WebMCP validation.
- Formatting and conversion to or from the internal IDR base value.
- FX rate cache keys and generic ExchangeRate-API fetching.

The app stores calculated portfolio values internally in IDR. The reporting
currency changes only the way those values are displayed; it does not modify
the stored asset amounts.

### Add a future currency

For a normal fiat currency supported by ExchangeRate-API, add one object to
the `currencies` array in `app/lib/currency.ts`:

```ts
{
  code: 'EUR',
  label: 'Euro',
  locale: 'de-DE',
  decimals: 2,
  supportsAssets: true,
  supportsReporting: true,
}
```

That single change automatically makes EUR available in the corresponding
dropdowns, conversion helpers, cache, import validation, and WebMCP schema.

Use the flags to control availability:

- `supportsReporting: true` lets users choose it on the Settings page.
- `supportsAssets: true` lets users enter cash/custom assets in it and permits
  Yahoo instruments whose quote currency is that code.

After adding a currency, verify these cases manually:

1. Select it in **Settings** and confirm the total and allocation values
   convert correctly.
2. Add a cash or custom asset in that currency.
3. If it is asset-enabled, search for a Yahoo-listed instrument quoted in that
   currency.
4. Refresh prices and confirm ExchangeRate-API returns the new code.

No extra conversion code is necessary for standard currencies returned by
ExchangeRate-API. A currency or asset class without an FX rate there—such as
crypto, a commodity, or a specialised local instrument—needs an additional
price provider and mapping before it should be enabled.

`baseCurrency` should remain `IDR` unless the whole valuation model and the
gold-price reference are deliberately redesigned. The USD/IDR line in the
overview and the gold-futures calculation are intentionally USD-specific.

## Interface languages

All visible application copy comes from the matching JSON file in
`app/locales/<locale>/common.json`. The selected language is stored locally
under `personal-portfolio-tracker-locale` and can be changed in **Settings**.

### Add a future language

1. Copy `app/locales/en/common.json` into a new locale folder, for example
   `app/locales/ja/common.json`, and translate every value while keeping the
   keys unchanged.
2. Import that JSON file in `app/lib/i18n.ts`, then add the locale code to the
   `locales` array and the `resources` object.
3. Add the locale code as an option in
   `app/settings/components/language-card.tsx`.

Every component reads the same `common` namespace, so adding a language does
not require changing its UI components.

## Deployment

The production app runs as a Cloudflare Worker. The currently configured
Worker project is `personal-portfolio-tracker`.

For automatic deployments, connect the GitHub repository to that Worker in the
Cloudflare dashboard and use:

```text
Production branch: main
Build command:      npm run build
Deploy command:     npx wrangler deploy
```

Once connected, pushing to `main` triggers a Cloudflare build and deployment.
Enable preview builds if pull-request previews are useful for your workflow.

## Known limitations

- There is no sign-in, server-side account, or cross-device sync.
- Clearing site storage removes the local portfolio unless a JSON export exists.
- Market data is dependent on third-party public endpoints.
- Gold is valued using a general futures reference rather than a UBS-specific
  retail buyback price.

## License

This project does not currently declare a license. Add one before distributing
or open-sourcing the code.
