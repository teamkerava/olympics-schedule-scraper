// Helper: resolve a puppeteer module to use. Caller may provide the
// Cloudflare module (imported in a Worker) or omit it to use regular
// Node puppeteer. This keeps the scraping logic reusable in both
// environments.
async function getPuppeteerModule(override?: any): Promise<any> {
  if (override) return (override && (override as any).default) || override;
  const mod = await import('puppeteer');
  return (mod && (mod as any).default) || mod;
}

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

async function scrapeOlympicsSchedule(opts?: { puppeteerModule?: any; browserBinding?: any; keepAlive?: number; location?: string }): Promise<DaySchedule[]> {
  console.log('Launching browser...');
  const pupp = await getPuppeteerModule(opts?.puppeteerModule);

  let browser: Browser;
  if (opts && opts.browserBinding) {
    // Cloudflare Workers binding: launch with the binding as first arg
    browser = await puppeteerLaunchWithBinding(pupp, opts.browserBinding, { keep_alive: opts.keepAlive, location: opts.location });
  } else {
    browser = await pupp.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  try {
    const page = await browser.newPage();
    await page.setUserAgent({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });

    console.log('Navigating to schedule page...');
    await page.goto('https://www.olympics.com/en/milano-cortina-2026/schedule', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Extracting event data from page...');
    
    const rawEvents = await page.evaluate(() => {
      interface RawEvent {
        sport: string;
        event: string;
        venue: string;
        date: string;
        endDate?: string;
        location: string;
        teams: string;
        status: string;
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
        const endMatch = chunk.match(/"endDate":"([^"]+)"/);
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
          
          if (eventMatch[1].toLowerCase().includes('downhill') || statusValue !== 'SCHEDULED') {
            console.log(`DEBUG: "${eventMatch[1]}" - status: "${statusValue}"`);
          }
          
          const nocMatches = chunk.match(/"noc":"([^"]+)"/g);
          let teams = '';
          
          const isTeamSport = teamSports.includes(disciplineName);
          const isRelaySport = relaySports.some(s => disciplineName.includes(s));
          const isRelayEvent = /Relay|relay|Final|final/.test(eventMatch[1]);
          
          if (nocMatches && nocMatches.length > 0) {
            const uniqueNocs = [...new Set(nocMatches.map(m => m.match(/"noc":"([^"]+)"/)?.[1] || ''))];
            
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
            endDate: endMatch ? endMatch[1] : '',
            location: locMatch ? locMatch[1] : '',
            teams,
            status: statusValue
          });
        }
      }
      
      return events;
    });

    console.log(`Found ${rawEvents.length} raw event entries`);

    if (rawEvents.length === 0) {
      console.log('No events found, using fallback');
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
      
      // Determine status: prefer scraped status when meaningful, but derive
      // "IN PROGRESS" or "FINISHED" based on start/end timestamps when
      // status is missing or still "SCHEDULED".
      let status = raw.status || 'SCHEDULED';
      const rawStatus = (raw.status || '').toString().toUpperCase();
      if (rawStatus.includes('PROGRESS') || rawStatus.includes('IN_PROGRESS') || rawStatus.includes('IN PROGRESS')) {
        status = 'IN PROGRESS';
      } else {
        try {
          const start = new Date(raw.date);
          const now = Date.now();
          let endTime = NaN;
          if (raw.endDate) {
            const end = new Date(raw.endDate);
            endTime = end.getTime();
          }

          if (!isNaN(start.getTime())) {
            if (!isNaN(endTime)) {
              // If we have both start and end, detect in-progress or finished
              if (start.getTime() <= now && now <= endTime) {
                status = 'IN PROGRESS';
              } else if (endTime < now && (status === 'SCHEDULED' || !status)) {
                status = 'FINISHED';
              }
            } else {
              // No end time: if start is in the past assume finished
              if (start.getTime() < now && (status === 'SCHEDULED' || !status)) {
                status = 'FINISHED';
              }
            }
          }
        } catch {
          // ignore parse errors and keep the original status
        }
      }

      daySchedule.events.push({
        time,
        event: eventName,
        sport: raw.sport,
        venue,
        teams,
        status
      });
    }

    const schedules = Array.from(eventMap.values()).map(day => {
      const seen = new Set<string>();
      const uniqueEvents = day.events.filter(e => {
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

    console.log(`Extracted ${schedules.length} days with ${schedules.reduce((sum, d) => sum + d.events.length, 0)} unique events`);
    
    if (schedules.length === 0) {
      return FALLBACK_SCHEDULE;
    }

    return schedules;

  } catch (error) {
    console.error('Error scraping:', error instanceof Error ? error.message : error);
    return FALLBACK_SCHEDULE;
  } finally {
    await browser.close();
  }
}

// Small helper to call launch correctly depending on the puppeteer
// implementation. The Cloudflare fork expects (binding, options).
async function puppeteerLaunchWithBinding(pupp: any, binding: any, options?: { keep_alive?: number; location?: string; }) {
  // prefer the fork's launch signature
  if (typeof pupp.launch === 'function') {
    try {
      // when using Cloudflare's fork, pass the binding first
      return await pupp.launch(binding, options || {});
    } catch (e) {
      // fall through to try alternative call
    }
  }
  // fallback: try calling with an options object (Node puppeteer)
  return await pupp.launch(options || {});
}

export async function scrapeSchedule(): Promise<DaySchedule[]> {
  console.log('Starting Olympics Milano Cortina 2026 schedule scrape...');
  
  const schedule = await scrapeOlympicsSchedule();
  
  if (schedule.length === 0) {
    console.log('Using fallback schedule');
    return FALLBACK_SCHEDULE;
  }
  
  console.log(`Successfully extracted ${schedule.length} days of events`);
  return schedule;
}

if (process.argv[1] === import.meta.url) {
  scrapeSchedule()
    .then(schedule => console.log(JSON.stringify(schedule, null, 2)))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
