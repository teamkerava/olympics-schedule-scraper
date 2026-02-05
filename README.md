# Milano Cortina 2026 Winter Olympics Schedule

A static site displaying the Winter Olympics schedule, built with Astro and TypeScript.

## Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

## Updating Schedule (automated)

This repo includes a scraper (`src/scripts/scrape.ts`) and a helper script `npm run fetch-schedule` that writes `public/schedule.json` and `public/last-updated.json`.

CI Workflow: `.github/workflows/deploy.yml` runs on pushes and on a 5-minute schedule. To avoid unnecessary scrapes when the workflow runs frequently, the fetch script supports a cache TTL via the `CACHE_TTL_SECONDS` environment variable.

How it works:
1. The scheduled GitHub Action runs every 5 minutes and executes `npm run build`.
2. The build invokes `npm run fetch-schedule` which runs `src/scripts/fetch-schedule.ts`.
3. If `CACHE_TTL_SECONDS` is set and the existing `public/schedule.json` is younger than the TTL, the script skips scraping and uses the cached file.
4. When scraping runs, it updates `public/schedule.json` and `public/last-updated.json` (these files are included in the static site).

Recommended settings:
- Set `CACHE_TTL_SECONDS` to `240` (4 minutes) in the workflow to avoid overlapping scrapes when scheduled every 5 minutes.
- If scraping is unreliable or blocked, set a large TTL or disable schedule triggers and run scrapes manually.

Scraping locally

You can run the scraper locally without running the full build. Useful when iterating on extraction or debugging.

- Fetch the main schedule (writes `public/schedule.json` and `public/last-updated.json`):

```bash
npm run fetch-schedule
```

- Control caching with `CACHE_TTL_SECONDS` (seconds). Example: force a fresh scrape:

```bash
CACHE_TTL_SECONDS=0 npm run fetch-schedule
```

- Typical dev example (use small TTL so frequent local runs still scrape):

```bash
CACHE_TTL_SECONDS=60 npm run fetch-schedule
```

Where files are written

- `public/schedule.json` — used by the static site and by CI for deployment
- `public/last-updated.json` — simple timestamp used by the frontend
- `src/data/*.json` — copies kept for local development (not committed)

Notes

- Puppeteer is used by the scrapers. `npm ci` / `npm install` will install necessary packages; running on CI uses the same package set.
- If the target site blocks automated requests, increase TTL or run scrapes less often.


## Deployment

Push to GitHub and enable GitHub Pages in repository settings. The CI/CD workflow in `.github/workflows/deploy.yml` will automatically build and deploy.

## Tech Stack

- **Astro** - Static site generator
- **TypeScript** - Type safety
- **Puppeteer** - Schedule scraping
- **GitHub Pages** - Hosting
