import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
import { fileURLToPath } from 'url';
import { writeFile, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// This file is a copy of scrape.ts but it applies the "Finland" filter
// before extracting the schedule. The Finland filter elements have
// class "css-opyxu8" in the page HTML.

export const sportsList = [
  'Alpine Skiing', 'Snowboarding', 'Bobsleigh', 'Skeleton',
  'Curling', 'Figure Skating', 'Freestyle Skiing', 'Ice Hockey',
  'Biathlon', 'Cross-Country', 'Ski Jumping', 'Nordic Combined',
  'Luge', 'Speed Skating', 'Short Track'
];

export const venueList = ['Milano', 'Cortina', 'Livigno', 'Bormio', 'Anterselva'];

export interface ScheduleEvent {
  time: string;
  event: string;
  sport: string;
  venue: string;
  teams?: string;
  status?: string;
  athletes?: string;
}

export interface DaySchedule {
  date: string;
  events: ScheduleEvent[];
}

const venueCodeMap: Record<string, string> = {
  'CCU': 'Milano',
  'SSC': 'Cortina',
  'CSC': 'Cortina',
  'PSJ': 'Cortina',
  'LSP': 'Livigno',
  'BFS': 'Bormio',
  'ANS': 'Anterselva',
  'MSI': 'Milano',
  'IHM': 'Milano',
  'SSL': 'Milano'
};

const countryCodeMap: Record<string, string> = {
  'GER': 'Germany',
  'KOR': 'Korea',
  'NOR': 'Norway',
  'CZE': 'Czechia',
  'SUI': 'Switzerland',
  'UKR': 'Ukraine',
  'EST': 'Estonia',
  'SWE': 'Sweden',
  'USA': 'United States',
  'CAN': 'Canada',
  'GBR': 'Great Britain',
  'ITA': 'Italy',
  'FRA': 'France',
  'AUT': 'Austria',
  'SLO': 'Slovenia',
  'JPN': 'Japan',
  'CHN': 'China',
  'NZL': 'New Zealand',
  'AUS': 'Australia',
  'FIN': 'Finland',
  'RUS': 'ROC',
  'KAZ': 'Kazakhstan',
  'POL': 'Poland',
  'BLR': 'Belarus',
  'LAT': 'Latvia',
  'LTU': 'Lithuania',
  'DEN': 'Denmark',
  'NED': 'Netherlands',
  'BEL': 'Belgium',
  'IRL': 'Ireland',
  'ESP': 'Spain',
  'POR': 'Portugal',
  'BRA': 'Brazil',
  'ARG': 'Argentina',
  'MEX': 'Mexico',
  'RSA': 'South Africa',
  'PHI': 'Philippines',
  'TPE': 'Chinese Taipei',
  'HKG': 'Hong Kong',
  'INA': 'Indonesia',
  'MAS': 'Malaysia',
  'SIN': 'Singapore',
  'THA': 'Thailand',
  'VIE': 'Vietnam',
  'IND': 'India',
  'PAK': 'Pakistan',
  'BGD': 'Bangladesh',
  'SRI': 'Sri Lanka',
  'NEP': 'Nepal',
  'MGL': 'Mongolia',
  'QAT': 'Qatar',
  'UAE': 'UAE',
  'KSA': 'Saudi Arabia',
  'TUR': 'Turkey',
  'ISR': 'Israel',
  'EGY': 'Egypt',
  'MAR': 'Morocco',
  'TUN': 'Tunisia',
  'ALG': 'Algeria',
  'NGA': 'Nigeria',
  'GHA': 'Ghana',
  'SEN': 'Senegal',
  'CAM': 'Cambodia',
  'JOR': 'Jordan',
  'LBN': 'Lebanon',
  'SYR': 'Syria',
  'IRQ': 'Iraq',
  'KUW': 'Kuwait',
  'OMA': 'Oman',
  'BHR': 'Bahrain',
  'ISL': 'Iceland',
  'LUX': 'Luxembourg',
  'MON': 'Monaco',
  'AND': 'Andorra',
  'SMR': 'San Marino',
  'MLT': 'Malta',
  'CYP': 'Cyprus',
  'ARM': 'Armenia',
  'GEO': 'Georgia',
  'AZE': 'Azerbaijan',
  'KOS': 'Kosovo',
  'MKD': 'North Macedonia',
  'ALB': 'Albania',
  'BIH': 'Bosnia',
  'MNE': 'Montenegro',
  'SRB': 'Serbia',
  'CRO': 'Croatia',
  'SVK': 'Slovakia',
  'BUL': 'Bulgaria',
  'ROM': 'Romania',
  'HUN': 'Hungary'
};

const FALLBACK_SCHEDULE: DaySchedule[] = [
  {
    date: 'February 4, 2026',
    events: [
      { time: '10:30', event: "Men's Downhill 1st Official Training", sport: 'Alpine Skiing', venue: 'Cortina' },
      { time: '18:05', event: 'Mixed Doubles Round Robin Session 1', sport: 'Curling', venue: 'Milano' }
    ]
  },
  {
    date: 'February 6, 2026',
    events: [
      { time: '13:00', event: 'Opening Ceremony', sport: 'Opening Ceremony', venue: 'Milano' }
    ]
  },
  {
    date: 'February 22, 2026',
    events: [
      { time: '13:00', event: 'Closing Ceremony', sport: 'Closing Ceremony', venue: 'Milano' }
    ]
  }
];

function parseTime(dateStr: string): string {
  try {
    const match = dateStr.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr.split('+')[0].replace('T', ' '));
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

async function applyFinlandFilter(page: Page): Promise<void> {
  // applying Finland filter
  // small helpers
  async function robustClick(el: ElementHandle<Element> | null) {
    if (!el) return;
    try {
      await el.evaluate((e: any) => {
        try { e.scrollIntoView({ block: 'center' }); } catch {}
        try { e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } catch {}
        try { e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); } catch {}
        try { e.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch {}
        try { e.click(); } catch {}
      });
    } catch {
      try { await el.click({ delay: 10 }); } catch {}
    }
  }

  async function clickFinlandInOpenPanel(page: Page): Promise<boolean> {
    try {
      const dialog = await page.$('[role="dialog"]');
      const scopeHandles = dialog ? await dialog.$$('button, li, div, span, label, a') : await page.$$('button, li, div, span, label, a');
      for (const h of scopeHandles) {
        try {
          const txt = (await (await h.getProperty('textContent')).jsonValue()) as string | null;
          if (txt && txt.trim().toLowerCase().includes('finland')) {
            await robustClick(h);
            return true;
          }
        } catch {}
      }
    } catch {}
    return false;
  }

  // Wait briefly for the filters to render
  await new Promise((res) => setTimeout(res, 800));

  // Try prioritized selectors first
  const preferSelectors = [
    'button[aria-label*="NOC" i]',
    'button[aria-label*="All NOCs" i]',
    'button[aria-label*="All Nations" i]',
    'div.css-1b0c4u2 button.css-c9900d'
  ];

  for (const sel of preferSelectors) {
    try {
      const h = await page.$(sel);
      if (!h) continue;
      await robustClick(h);
      await new Promise((res) => setTimeout(res, 700));
      const found = await clickFinlandInOpenPanel(page);
        if (found) { await new Promise((res) => setTimeout(res, 900)); return; }
      await page.keyboard.press('Escape').catch(()=>{});
      await new Promise((res) => setTimeout(res, 150));
      } catch {}
  }

  // fallback: try all opener buttons with the common class
  try {
    const openers = await page.$$('.css-c9900d');
    for (const op of openers) {
      try {
        await robustClick(op);
        await new Promise((res) => setTimeout(res, 700));
        const found = await clickFinlandInOpenPanel(page);
        if (found) { await new Promise((res) => setTimeout(res, 900)); return; }
        await page.keyboard.press('Escape').catch(()=>{});
        await new Promise((res) => setTimeout(res, 150));
      } catch {}
    }
  } catch {}

  // Finland filter element not found after all attempts
  await new Promise((res) => setTimeout(res, 900));
}

// Click events on the page for today's schedule and capture Finnish athletes via network interception
async function getFinnishAthletesForToday(page: Page, schedules: DaySchedule[]): Promise<any[]> {
  const out: any[] = [];
  try {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const todayDay = schedules.find(d => d.date === todayStr);
    if (!todayDay || !todayDay.events || todayDay.events.length === 0) {
      // No events found for today in scraped schedule
      return out;
    }

    const captured: any[] = [];

    // Attempt 1: fetch the day API from the browser context so cookies/tokens are included
    try {
      const iso = today.toISOString().slice(0, 10);
      const apiUrl = `https://www.olympics.com/wmr-owg2026/schedules/api/ENG/schedule/lite/day/${iso}`;
      // Attempt browser fetch of day API
      const dayJson = await page.evaluate(async (url: string) => {
        try {
          const resp = await fetch(url, { credentials: 'same-origin', method: 'GET' });
          if (!resp.ok) return { __fetch_error: resp.status };
          try { return await resp.json(); } catch (e) { return { __fetch_error: String(e) }; }
        } catch (e) {
          return { __fetch_error: String(e) };
        }
      }, apiUrl);

      if (dayJson && !(dayJson && (dayJson.__fetch_error))) {
        // Try to find event objects (objects that contain eventUnitName/disciplineName/startDate)
        function findEventObjects(obj: any): any[] {
          const found: any[] = [];
          if (!obj || typeof obj !== 'object') return found;
          if (Array.isArray(obj)) {
            for (const item of obj) found.push(...findEventObjects(item));
            return found;
          }
          const keys = Object.keys(obj);
          if (keys.includes('eventUnitName') || keys.includes('disciplineName') || keys.includes('startDate') || keys.includes('eventName')) {
            found.push(obj);
          }
          for (const k of Object.keys(obj)) {
            try { found.push(...findEventObjects(obj[k])); } catch {}
          }
          return found;
        }

        function findArrays(obj: any): any[] {
          const found: any[] = [];
          if (!obj || typeof obj !== 'object') return found;
          if (Array.isArray(obj)) {
            found.push(obj);
            for (const item of obj) found.push(...findArrays(item));
            return found;
          }
          for (const k of Object.keys(obj)) {
            try { found.push(...findArrays(obj[k])); } catch {}
          }
          return found;
        }

        const events = findEventObjects(dayJson);
        for (const ev of events) {
          try {
            const sport = ev.disciplineName || ev.discipline || ev.sport || '';
            const eventName = ev.eventUnitName || ev.eventName || ev.competitionName || ev.name || '';
            const time = ev.startDate || ev.date || '';

            // find participant arrays under this event object
            const arrays = findArrays(ev);
            for (const arr of arrays) {
              if (!Array.isArray(arr)) continue;
              const sample = arr.find((x: any) => x && (x.athleteName || x.name || x.displayName || x.competitorName));
              if (!sample) continue;
              for (const p of arr) {
                try {
                  const noc = (p.noc || p.countryCode || (p.nation && p.nation.code) || '').toString();
                  const name = p.athleteName || p.name || p.competitorName || p.displayName || '';
                  if (name && (noc.toUpperCase().includes('FIN') || /finland/i.test(name))) {
                    captured.push({ name, noc, sport, event: eventName, time, raw: p, url: apiUrl, source: 'day-api' });
                  }
                } catch {}
              }
            }
          } catch {}
        }

        // fallback: scan top-level arrays if no event-specific captures
        if (captured.length === 0) {
          const arraysTop = findArrays(dayJson);
          for (const arr of arraysTop) {
            if (!Array.isArray(arr)) continue;
            const sample = arr.find((x: any) => x && (x.athleteName || x.name || x.displayName || x.competitorName));
            if (!sample) continue;
            for (const p of arr) {
              try {
                const noc = (p.noc || p.countryCode || (p.nation && p.nation.code) || '').toString();
                const name = p.athleteName || p.name || p.competitorName || p.displayName || '';
                if (name && (noc.toUpperCase().includes('FIN') || /finland/i.test(name))) {
                  captured.push({ name, noc, sport: '', event: '', time: '', raw: p, url: apiUrl, source: 'day-api' });
                }
              } catch {}
            }
          }
        }

        // keep captured counts quiet unless there are captures
        if (captured.length > 0) {
          // found some athletes
        }
      } else {
        console.log('Browser day API fetch failed or returned error', dayJson && dayJson.__fetch_error);
      }
    } catch (e) {
      // ignore fetch errors and fall back to network interception + DOM
    }

    const respListener = async (resp: any) => {
      try {
        const headers = resp.headers ? resp.headers() : {};
        const ct = (headers['content-type'] || headers['Content-Type'] || '') as string;
        const url = resp.url();
        // try to parse JSON for common endpoints; if content-type missing, still attempt
        let json: any = null;
        try {
          if (ct.includes('application/json')) {
            json = await resp.json().catch(()=>null);
          } else {
            json = await resp.json().catch(()=>null);
          }
        } catch { json = null; }
        if (!json && !/event|competitor|participant|entry|athlete|competitor/i.test(url)) return;
        if (!json) return;
        // look for arrays
        // recursively scan JSON for arrays of athlete-like objects
        function findArrays(obj: any): any[] {
          const found: any[] = [];
          if (!obj || typeof obj !== 'object') return found;
          if (Array.isArray(obj)) {
            found.push(obj);
            for (const item of obj) {
              found.push(...findArrays(item));
            }
            return found;
          }
          for (const k of Object.keys(obj)) {
            try { found.push(...findArrays(obj[k])); } catch {}
          }
          return found;
        }

        const arrays = findArrays(json);
        for (const arr of arrays) {
          if (!Array.isArray(arr)) continue;
          // check if array looks like athlete list
          const sample = arr.find((x: any) => x && (x.athleteName || x.name || x.displayName || x.competitorName));
          if (!sample) continue;
          for (const p of arr) {
            try {
              const noc = (p.noc || p.countryCode || (p.nation && p.nation.code) || '').toString();
              const name = p.athleteName || p.name || p.competitorName || p.displayName || '';
              if (name) captured.push({ name, noc, raw: p, url });
            } catch {}
          }
        }
      } catch {}
    };

    page.on('response', respListener);

    // For each event for today, try to click an element that matches the event name/time
    for (const ev of todayDay.events) {
      const search = `${ev.event}`.replace(/"/g, '').trim();
      if (!search) continue;
      // try XPath matching case-insensitive
      try {
        // gather candidate elements and try clicking those whose text includes the event name
        const handles = await page.$$('a, button, div, span');
        let clicked = false;
        for (let i = 0; i < Math.min(handles.length, 600) && !clicked; i++) {
          const h = handles[i];
          try {
            const txt = (await (await h.getProperty('textContent')).jsonValue()) as string | null;
            if (!txt) continue;
        if (txt.toLowerCase().includes(search.toLowerCase())) {
              try { await h.evaluate((el: any) => { try { el.scrollIntoView({ block: 'center' }); } catch {} }); } catch {}
              try { await h.click({ delay: 30 }); } catch {}
              clicked = true;
              await new Promise((res) => setTimeout(res, 600));
              // After clicking, also scan any opened dialog for Finnish names (fallback when network doesn't return JSON)
              try {
                const dialogNames = await page.evaluate(() => {
                  try {
                    const dialog = document.querySelector('[role="dialog"]');
                    const scopeText = dialog ? (dialog as HTMLElement).innerText : (document.body && document.body.innerText) || '';
                    if (!scopeText) return [];
                    if (!/finland|lehto/i.test(scopeText)) return [];
                    const nameRegex = /\b[A-ZÄÖÅ][a-zäöå]+(?:\s+[A-ZÄÖÅ][a-zäöå]+)+\b/g;
                    const matches = Array.from(new Set((scopeText.match(nameRegex) || [])));
                    return matches;
                  } catch (e) { return []; }
                });
                for (const nm of dialogNames) {
                  captured.push({ name: nm, noc: '', raw: null, url: page.url(), source: 'dom' });
                }
              } catch {}
              // close modal if opened
              await page.keyboard.press('Escape').catch(()=>{});
              await new Promise((res) => setTimeout(res, 120));
              break;
            }
          } catch {}
        }
      } catch {}
    }

    // allow network responses to arrive
    await new Promise((res) => setTimeout(res, 1200));
    // Puppeteer Page doesn't have removeListener in TS types; use off
    try { (page as any).off && (page as any).off('response', respListener); } catch {}

    // Normalize, enrich and group captured entries into the shape expected by the site
    try {
      function normalizeName(name: string): string {
        if (!name) return '';
        name = name.trim();
        // If name looks like "FAMILY Given" (family name uppercase first), flip
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length >= 2 && parts[0] === parts[0].toUpperCase() && /[A-ZÄÖÅ]{2,}/.test(parts[0])) {
          const family = parts[0];
          const given = parts.slice(1).join(' ');
          name = `${given} ${family}`;
        }
        // Title-case the name
        name = name.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        return name;
      }

      const grouped = new Map<string, any[]>();

      for (const c of captured) {
        try {
          const noc = (c.noc || '').toString();
          const rawName = (c.name || '').toString();
          if (!rawName) continue;
          if (/^finland$/i.test(rawName) || /\bfinland\b/i.test(rawName)) continue; // filter noise
          if (!(noc.toUpperCase().includes('FIN') || /finland/i.test(rawName))) continue;

          const name = normalizeName(rawName);

          // determine date & time
          const iso = (c.time || c.startDate || c.date || '');
          const dateStr = iso ? formatDate(iso) : todayStr;
          const timeStr = iso ? parseTime(iso) : (c.time || '');

          // determine sport and event, try several fallbacks
          const sport = (c.sport || c.discipline || c.disciplineName || '').toString();
          const eventName = (c.event || c.eventUnitName || c.eventName || c.competitionName || c.name || '').toString();

          // If sport/event missing, try to find a match in provided schedules
          let finalSport = sport || '';
          let finalEvent = eventName || '';
          if ((!finalSport || !finalEvent) && Array.isArray(schedules)) {
            for (const day of schedules) {
              for (const ev of day.events) {
                try {
                  const evText = `${ev.event} ${ev.sport}`.toLowerCase();
                  if (rawName && ev.athletes && ev.athletes.toLowerCase().includes(rawName.toLowerCase())) {
                    finalSport = finalSport || ev.sport || '';
                    finalEvent = finalEvent || ev.event || '';
                    // prefer the event's date/time
                    // use day.date (already formatted) and ev.time
                    // override dateStr/timeStr only if missing
                  } else if (finalEvent === '' && rawName && ev.event && ev.event.toLowerCase().includes(rawName.split(' ')[0].toLowerCase())) {
                    finalSport = finalSport || ev.sport || '';
                    finalEvent = finalEvent || ev.event || '';
                  }
                } catch {}
              }
            }
          }

          // Determine an ISO date for the event if available so the frontend can
          // compute exact instants (timezone-aware). Prefer explicit ISO fields
          // from the API (startDate/date), otherwise fall back to today's ISO.
          const eventIsoRaw = (c.time || c.startDate || c.date || '').toString();
          const dateIsoMatch = eventIsoRaw.match(/(\d{4}-\d{2}-\d{2})/);
          const dateIso = dateIsoMatch ? dateIsoMatch[1] : (new Date()).toISOString().slice(0,10);

          const athleteObj = {
            time: timeStr || '',
            sport: finalSport || '',
            athlete: name,
            event: finalEvent || '',
            dateIso,
            eventIso: eventIsoRaw || ''
          };

          // Skip noisy/placeholder captures that have no useful scheduling data.
          // Do not include entries that lack time, sport and an ISO event timestamp.
          const isEmptyCapture = (!athleteObj.time || athleteObj.time.trim() === '')
            && (!athleteObj.sport || athleteObj.sport.trim() === '')
            && (!athleteObj.eventIso || athleteObj.eventIso.trim() === '');
          if (isEmptyCapture) {
            // skip adding this placeholder entry
          } else {
            if (!grouped.has(dateStr)) grouped.set(dateStr, []);
            const arr = grouped.get(dateStr)!;
            // dedupe by athlete+event
            const exists = arr.some((a: any) => a.athlete === athleteObj.athlete && a.event === athleteObj.event && a.time === athleteObj.time);
            if (!exists) arr.push(athleteObj);
          }
        } catch {}
      }

      // convert map to array of Day entries
      const days = Array.from(grouped.entries()).map(([date, athletes]) => ({ date, athletes }));
      // sort by date (attempt to parse back to Date)
      days.sort((a: any, b: any) => (new Date(a.date)).getTime() - (new Date(b.date)).getTime());
      return days;
    } catch (e) {
      // fallback to previous simple format if anything goes wrong
      for (const c of captured) {
        if ((c.noc || '').toUpperCase().includes('FIN') || (c.name || '').toLowerCase().includes('finnish')) {
          out.push({ athlete: c.name, noc: c.noc, url: c.url });
        }
      }
      const uniq = Array.from(new Map(out.map(o => [o.athlete, o])).values());
      return uniq;
    }
  } catch (e) {
    return out;
  }
}

async function scrapeOlympicsScheduleFinnish(): Promise<DaySchedule[]> {
  // simple cache support: respect CACHE_TTL_SECONDS to avoid re-scraping
  const ttlEnv = process.env.CACHE_TTL_SECONDS;
  const ttl = ttlEnv ? Math.max(0, parseInt(ttlEnv, 10) || 0) : 0;
  const publicPath = fileURLToPath(new URL('../../public/finnish-schedule.json', import.meta.url));
  const dataPath = fileURLToPath(new URL('../data/finnish-schedule.json', import.meta.url));

  if (ttl > 0) {
    try {
      let cachedPath = '';
      if (existsSync(publicPath)) cachedPath = publicPath;
      else if (existsSync(dataPath)) cachedPath = dataPath;

      if (cachedPath) {
        const st = await stat(cachedPath);
        const ageSeconds = (Date.now() - st.mtime.getTime()) / 1000;
        if (ageSeconds < ttl) {
          console.log(`Using cached ${cachedPath} (age ${Math.round(ageSeconds)}s < TTL ${ttl}s), skipping Finnish scrape`);
          try {
            const raw = await readFile(cachedPath, 'utf8');
            const parsed = JSON.parse(raw) as DaySchedule[];
            // ensure development data exists
            try { await writeFile(dataPath, JSON.stringify(parsed, null, 2), 'utf8'); } catch {}
            return parsed;
          } catch (err) {
            console.warn('Failed to read/parse cached finnish schedule, continuing to scrape:', err instanceof Error ? err.message : err);
          }
        }
      }
    } catch (err) {
      console.warn('Cache check failed for finnish scrape, continuing to scrape:', err instanceof Error ? err.message : err);
    }
  }

  // launching browser (Finnish filter)
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });

    // navigating to schedule page
    await page.goto('https://www.olympics.com/en/milano-cortina-2026/schedule', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // initial page loaded

    // proceed without creating DOM debug dumps

    // Try to apply Finland filter before extracting raw HTML
    try {
      await applyFinlandFilter(page);
    } catch (err) {
      console.warn('Failed to apply Finland filter:', err instanceof Error ? err.message : err);
    }

    // continue without saving post-filter screenshots

    console.log('Extracting event data from page...');
    // hide verbose debug logs from page.evaluate by disabling console logs in the page context
    await page.evaluate(() => { (window as any).console && (window as any).console.log && ((window as any).console.log = () => {}); });
    const rawEvents = await page.evaluate(() => {
      interface RawEvent {
        sport: string;
        event: string;
        venue: string;
        date: string;
        location: string;
        teams: string;
        status: string;
        athletes?: string;
      }
      const events: RawEvent[] = [];
      const text = document.body.innerHTML;

      const regex = /"disciplineName":"([^"]+)"/g;
      let match;

      const teamSports = ['Curling', 'Ice Hockey'];
      const relaySports = ['Short Track', 'Speed Skating', 'Biathlon', 'Cross-Country', 'Ski Jumping', 'Nordic Combined'];

      while ((match = regex.exec(text)) !== null) {
        const startIdx = match.index;
        const disciplineName = match[1];

        const chunk = text.substring(startIdx, startIdx + 1500);

        const eventMatch = chunk.match(/"eventUnitName":"([^"]+)"/);
        const venueMatch = chunk.match(/"venue":"([^"]+)"/);
        const dateMatch = chunk.match(/"startDate":"([^"]+)"/);
        const locMatch = chunk.match(/"locationDescription":"([^"]*)"/);

        let statusMatch = chunk.match(/"eventStatus":"([^"]+)"/);
        if (!statusMatch) statusMatch = chunk.match(/"status":"([^"]+)"/);
        if (!statusMatch) statusMatch = chunk.match(/"eventUnitStatus":"([^"]+)"/);
        if (!statusMatch) statusMatch = chunk.match(/"scheduleStatus":"([^"]+)"/);
        if (!statusMatch) statusMatch = chunk.match(/"eventUnitScheduleStatus":"([^"]+)"/);
        if (!statusMatch) statusMatch = chunk.match(/"competitionStatus":"([^"]+)"/);

        const statusValue = statusMatch ? statusMatch[1] : 'SCHEDULED';

        if (eventMatch && venueMatch && dateMatch) {
          const statusValue = statusMatch ? statusMatch[1] : 'SCHEDULED';

          // suppress per-event debug output

          const nocMatches = chunk.match(/"noc":"([^"]+)"/g);
          let teams = '';

          // try to extract athlete names from nearby JSON fragments inside the chunk
          const athleteNames: string[] = [];
          const nameRegexes = [/"athleteName":"([^\"]+)"/g, /"athlete":"([^\"]+)"/g, /"competitorName":"([^\"]+)"/g, /"name":"([^\"]+)"/g];
          for (const r of nameRegexes) {
            try {
              for (const m of Array.from(chunk.matchAll(r))) {
                if (m && m[1]) {
                  const nm = m[1].trim();
                  if (nm) athleteNames.push(nm);
                }
              }
            } catch {}
          }
          const uniqueAthletes = [...new Set(athleteNames)];

          const isTeamSport = teamSports.includes(disciplineName);
          const isRelaySport = relaySports.some((s) => disciplineName.includes(s));
          const isRelayEvent = /Relay|relay|Final|final/.test(eventMatch[1]);

          if (nocMatches && nocMatches.length > 0) {
            const uniqueNocs = [...new Set(nocMatches.map((m) => m.match(/"noc":"([^"]+)"/)?.[1] || ''))];

            if (isTeamSport && uniqueNocs.length <= 8) {
              teams = uniqueNocs.join(' vs ');
            } else if ((isRelaySport || isRelayEvent) && uniqueNocs.length <= 8) {
              teams = uniqueNocs.join(' vs ');
            }
          }

          events.push({
            sport: disciplineName,
            event: eventMatch[1],
            venue: venueMatch[1],
            date: dateMatch[1],
            location: locMatch ? locMatch[1] : '',
            teams,
            status: statusValue
            ,
            athletes: uniqueAthletes.length ? uniqueAthletes.join(', ') : undefined
          });
        }
      }

      return events;
    });

    // only log summary counts, not full schedule
    // (quiet)

    if (rawEvents.length === 0) {
      // no events found, using fallback
      return FALLBACK_SCHEDULE;
    }

    const eventMap = new Map<string, DaySchedule>();

    for (const raw of rawEvents) {
      const time = parseTime(raw.date);
      const dateStr = formatDate(raw.date);
      const venue = venueCodeMap[raw.venue] || raw.venue;

      if (!time || !dateStr) continue;

      let eventName = raw.event;
      if (raw.location && raw.sport === 'Curling') {
        const sheetMatch = raw.location.match(/Sheet\s+([A-D])/);
        if (sheetMatch) {
          eventName = `${raw.event} - Sheet ${sheetMatch[1]}`;
        }
      }

      let teams = '';
      if (raw.teams) {
        const nocCodes = raw.teams.split(' vs ').map((n: string) => n.trim());
        const countries = nocCodes.map((c: string) => countryCodeMap[c] || c).join(' vs ');
        teams = countries;
      }

      if (!eventMap.has(dateStr)) {
        eventMap.set(dateStr, { date: dateStr, events: [] });
      }

      const daySchedule = eventMap.get(dateStr)!;

      daySchedule.events.push({
        time,
        event: eventName,
        sport: raw.sport,
        venue,
        teams,
        status: raw.status
      });
    }

    const schedules = Array.from(eventMap.values()).map((day) => {
      const seen = new Set<string>();
      const uniqueEvents = day.events.filter((e) => {
        const key = `${e.time}|${e.event}|${e.sport}|${e.venue}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        ...day,
        events: uniqueEvents.sort((a, b) => a.time.localeCompare(b.time))
      };
    });

    // extracted schedule

    if (schedules.length === 0) {
      return FALLBACK_SCHEDULE;
    }

    // Attempt to capture Finnish athletes for today by interacting with the page
    try {
      // attempt to capture Finnish athletes for today
      const athletes = await getFinnishAthletesForToday(page, schedules);
    try {
      const outFile = fileURLToPath(new URL('../data/finnish-athletes.json', import.meta.url));
      await writeFile(outFile, JSON.stringify(athletes, null, 2), 'utf8');
      console.log('Saved finnish athletes to', outFile);
      try {
        const publicAthletesOut = fileURLToPath(new URL('../../public/finnish-athletes.json', import.meta.url));
        await writeFile(publicAthletesOut, JSON.stringify(athletes, null, 2), 'utf8');
        console.log('Saved public finnish athletes to', publicAthletesOut);
      } catch (err) {
        console.warn('Failed to save public finnish athletes file:', err instanceof Error ? err.message : err);
      }
    } catch (err) {
      console.warn('Failed to save finnish athletes file:', err instanceof Error ? err.message : err);
    }
    } catch (err) {
      console.warn('Failed to capture Finnish athletes:', err instanceof Error ? err.message : err);
    }

    return schedules;

  } catch (error) {
    console.error('Error scraping:', error instanceof Error ? error.message : error);
    return FALLBACK_SCHEDULE;
  } finally {
    await browser.close();
  }
}

export async function scrapeScheduleFinnish(): Promise<DaySchedule[]> {
  console.log('Starting Olympics Milano Cortina 2026 schedule scrape (Finland filter)...');
  const schedule = await scrapeOlympicsScheduleFinnish();

  if (schedule.length === 0) {
    console.log('Using fallback schedule');
    return FALLBACK_SCHEDULE;
  }

  // Save schedule to src/data/finnish-schedule.json
  try {
    const outFile = fileURLToPath(new URL('../data/finnish-schedule.json', import.meta.url));
    await writeFile(outFile, JSON.stringify(schedule, null, 2), 'utf8');
    console.log('Saved finnish schedule to', outFile);
    try {
      const publicOut = fileURLToPath(new URL('../../public/finnish-schedule.json', import.meta.url));
      await writeFile(publicOut, JSON.stringify(schedule, null, 2), 'utf8');
      console.log('Saved public finnish schedule to', publicOut);
    } catch (err) {
      console.warn('Failed to save public finnish schedule file:', err instanceof Error ? err.message : err);
    }
  } catch (err) {
    console.warn('Failed to save finnish schedule file:', err instanceof Error ? err.message : err);
  }

  // Write a last-updated timestamp so the frontend can show a real value
  try {
    const lastOut = fileURLToPath(new URL('../data/last-updated.json', import.meta.url));
    // produce an ISO-like timestamp for Europe/Rome including offset (e.g. 2026-02-05T15:30:00+01:00)
    function nowZoneIso(zone: string): string {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const parts = fmt.formatToParts(now).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
      const y = parts.year; const mo = parts.month; const d = parts.day; const hh = parts.hour; const mm = parts.minute; const ss = parts.second;
      const asUtc = Date.UTC(parseInt(y,10), parseInt(mo,10)-1, parseInt(d,10), parseInt(hh,10), parseInt(mm,10), parseInt(ss,10));
      const offsetMinutes = Math.round((asUtc - now.getTime()) / 60000);
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutes);
      const offH = String(Math.floor(abs / 60)).padStart(2,'0');
      const offM = String(abs % 60).padStart(2,'0');
      return `${y}-${mo}-${d}T${hh}:${mm}:${ss}${sign}${offH}:${offM}`;
    }

    const nowIso = nowZoneIso('Europe/Rome');
    await writeFile(lastOut, JSON.stringify({ iso: nowIso }, null, 2), 'utf8');
    console.log('Saved last-updated to', lastOut);
  } catch (err) {
    console.warn('Failed to save last-updated file:', err instanceof Error ? err.message : err);
  }

  // Check whether any event contains Finland (simple heuristic)
  try {
    const hasFinland = schedule.some(day => day.events.some(e => (e.teams || '').toLowerCase().includes('finland') || (e.teams || '').includes('FIN')));
    if (!hasFinland) console.warn('No Finland appearances found in scraped schedule — filter may not have applied.');
  } catch {
    // ignore
  }

  console.log(`Successfully extracted ${schedule.length} days of events (Finland filter)`);
  return schedule;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeScheduleFinnish()
    .then((schedule) => {
      // Avoid printing the full schedule JSON to stdout; print a concise summary instead
      const days = schedule.length;
      const events = schedule.reduce((sum, d) => sum + (d.events ? d.events.length : 0), 0);
      console.log(`Scrape completed: ${days} days, ${events} events`);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
