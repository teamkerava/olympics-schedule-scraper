import { scrapeSchedule } from './scrape';
import { writeFile, copyFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Simple caching support: set CACHE_TTL_SECONDS to a positive integer to
// avoid re-scraping when the existing public schedule is fresh enough.
// Example: CACHE_TTL_SECONDS=60 (use cache for 60 seconds)

async function main() {
  const publicPath = join(process.cwd(), 'public', 'schedule.json');
  const dataPath = join(process.cwd(), 'src', 'data', 'schedule.json');

  const ttlEnv = process.env.CACHE_TTL_SECONDS;
  const ttl = ttlEnv ? Math.max(0, parseInt(ttlEnv, 10) || 0) : 0;

  // If TTL is set and the public schedule exists and is fresh enough, skip scraping
  if (ttl > 0 && existsSync(publicPath)) {
    try {
      const st = await stat(publicPath);
      const ageSeconds = (Date.now() - st.mtime.getTime()) / 1000;
      if (ageSeconds < ttl) {
        console.log(`Using cached ${publicPath} (age ${Math.round(ageSeconds)}s < TTL ${ttl}s), skipping scrape`);
        // Ensure dev data is present
        if (existsSync(dataPath)) {
          await copyFile(publicPath, dataPath);
          console.log(`Copied cached schedule to ${dataPath} for development`);
        } else {
          await copyFile(publicPath, dataPath).catch(async () => {
            // fallback to writing file if copy fails for any reason
            const raw = await (await import('fs/promises')).readFile(publicPath, 'utf8');
            await writeFile(dataPath, raw);
            console.log(`Created ${dataPath} for development from cached schedule`);
          });
        }
        return;
      }
    } catch (err) {
      console.warn('Cache check failed, continuing to scrape:', err instanceof Error ? err.message : err);
    }
  }

  console.log('Scraping Olympics schedule...');
  const schedule = await scrapeSchedule();

  await writeFile(publicPath, JSON.stringify(schedule, null, 2));
  console.log(`Saved ${schedule.length} days of schedule to ${publicPath}`);
  // write last-updated timestamp for static site consumers (use Europe/Rome)
  const lastUpdatedPath = join(process.cwd(), 'public', 'last-updated.json');
  const lastDataPath = join(process.cwd(), 'src', 'data', 'last-updated.json');
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

  const timestamp = { iso: nowZoneIso('Europe/Rome') };
  await writeFile(lastUpdatedPath, JSON.stringify(timestamp, null, 2));
  try {
    if (existsSync(lastDataPath)) {
      await copyFile(lastUpdatedPath, lastDataPath);
    } else {
      await writeFile(lastDataPath, JSON.stringify(timestamp, null, 2));
    }
  } catch (err) {
    console.warn('Could not update dev last-updated.json:', err instanceof Error ? err.message : err);
  }
  
  if (existsSync(dataPath)) {
    await copyFile(publicPath, dataPath);
    console.log(`Copied schedule to ${dataPath} for development`);
  } else {
    await writeFile(dataPath, JSON.stringify(schedule, null, 2));
    console.log(`Created ${dataPath} for development`);
  }
}

main().catch(console.error);
