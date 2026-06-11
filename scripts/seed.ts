/**
 * Seed Palate with a realistic Australian F&B brand: "Marlow & Sage".
 * Three locations, 14 days of social chatter with deliberate narrative threads
 * the listening agent can discover, plus knowledge files (agent memory).
 *
 * Run: pnpm tsx scripts/seed.ts
 */
import { Client } from "pg";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(__dirname, "..", ".env.local") });

const db = new Client({ connectionString: process.env.DATABASE_URL });

function ago(days: number, hours = 0): Date {
  return new Date(Date.now() - (days * 24 + hours) * 3600 * 1000);
}

type Item = {
  loc: 0 | 1 | 2;
  source: "google_reviews" | "facebook" | "instagram";
  kind: "review" | "comment" | "mention";
  author: string;
  handle?: string;
  rating?: number;
  text: string;
  at: Date;
  sentiment?: "positive" | "neutral" | "negative";
  score?: number;
  topics?: string[];
  dishes?: string[];
  flagged?: boolean;
};

const ITEMS: Item[] = [
  // ---- Narrative thread 1: miso caramel pavlova trending on IG (last 3 days)
  { loc: 0, source: "instagram", kind: "mention", author: "Sydney Food Files", handle: "@sydneyfoodfiles", text: "The miso caramel pavlova at Marlow & Sage Surry Hills is the most photogenic dessert in Sydney right now. That torched meringue 😮‍💨 10/10", at: ago(2, 3), sentiment: "positive", score: 0.95, topics: ["dessert", "viral"], dishes: ["miso caramel pavlova"] },
  { loc: 0, source: "instagram", kind: "comment", author: "Jess Nguyen", handle: "@jesseats_syd", text: "Came for the pav after seeing it everywhere. It's even better in person, the miso makes it!! Already planning round two", at: ago(1, 6), sentiment: "positive", score: 0.9, topics: ["dessert", "viral"], dishes: ["miso caramel pavlova"] },
  { loc: 0, source: "instagram", kind: "mention", author: "Broadsheet Bites", handle: "@broadsheetbites", text: "PSA: that viral miso caramel pavlova everyone's posting is from @marlowandsage. Get in before the weekend rush.", at: ago(1, 1), sentiment: "positive", score: 0.92, topics: ["dessert", "viral", "press"], dishes: ["miso caramel pavlova"] },
  { loc: 1, source: "instagram", kind: "comment", author: "Tom A.", handle: "@tommy_eats_mel", text: "When is the miso caramel pavlova coming to the Fitzroy menu?? Sydney gets all the fun 😤", at: ago(0, 20), topics: ["dessert", "menu request"], dishes: ["miso caramel pavlova"] },
  { loc: 0, source: "instagram", kind: "comment", author: "Priya K", handle: "@priya.tastes", text: "Booked Friday specifically for the pavlova. Please don't sell out before 8pm I'm begging", at: ago(0, 9), topics: ["dessert", "booking"], dishes: ["miso caramel pavlova"] },

  // ---- Narrative thread 2: slow Friday/Saturday service at Surry Hills
  { loc: 0, source: "google_reviews", kind: "review", author: "Mark Davidson", rating: 3, text: "Food was genuinely great (the lamb shoulder is a must) but we waited 45 minutes between entree and mains on Friday night. Staff apologised and were lovely about it, kitchen just seemed slammed.", at: ago(9, 2), sentiment: "negative", score: -0.4, topics: ["service speed", "friday night"], dishes: ["lamb shoulder"] },
  { loc: 0, source: "google_reviews", kind: "review", author: "Alana Reid", rating: 2, text: "Second Friday in a row with really slow service. 30+ min for drinks. The room is buzzing and food is good but you need more floor staff on weekends.", at: ago(5, 4), sentiment: "negative", score: -0.65, topics: ["service speed", "friday night", "staffing"] },
  { loc: 0, source: "facebook", kind: "comment", author: "Steph Moore", text: "Was there Saturday — same thing, gorgeous food but service was crawling. Maybe stop taking walk-ins after 7?", at: ago(3, 8), sentiment: "negative", score: -0.5, topics: ["service speed", "weekend"] },
  { loc: 0, source: "google_reviews", kind: "review", author: "James Whitfield", rating: 4, text: "Tuesday visit was flawless, food in 15 mins, staff attentive. Knock a star off because our Friday visit last month was chaos. Go midweek.", at: ago(2, 10), sentiment: "positive", score: 0.4, topics: ["service speed", "midweek"] },

  // ---- Narrative thread 3: CRITICAL food safety claim at Fitzroy
  { loc: 1, source: "google_reviews", kind: "review", author: "D. Castellano", rating: 1, text: "Ordered the roast chicken on Sunday and the inside was pink and cold in the middle. Told the waiter, they replaced it quickly and comped dessert, but honestly this shouldn't happen. Worried I'll be sick.", at: ago(1, 14), sentiment: "negative", score: -0.95, topics: ["food safety", "undercooked"], dishes: ["roast chicken"], flagged: true },

  // ---- Narrative thread 4: Em at Burleigh Heads is a star
  { loc: 2, source: "google_reviews", kind: "review", author: "Carol Hutchins", rating: 5, text: "Em looked after our table of 8 like we were family. Remembered every allergy, recommended the snapper ceviche which was incredible. Best service on the Goldy.", at: ago(11, 5), sentiment: "positive", score: 0.95, topics: ["staff praise", "service"], dishes: ["snapper ceviche"] },
  { loc: 2, source: "google_reviews", kind: "review", author: "Ben T.", rating: 5, text: "Shout out to Em who turned a rainy Tuesday into the highlight of our trip. Also the wagyu burger is stupidly good.", at: ago(6, 7), sentiment: "positive", score: 0.9, topics: ["staff praise"], dishes: ["wagyu burger"] },
  { loc: 2, source: "facebook", kind: "comment", author: "Renee Walsh", text: "Em deserves a raise!! Third visit and she remembered our order from LAST MONTH.", at: ago(2, 22), sentiment: "positive", score: 0.92, topics: ["staff praise"] },

  // ---- Narrative thread 5: vegan / gluten-free demand
  { loc: 1, source: "instagram", kind: "comment", author: "Maya", handle: "@plantbased.mel", text: "Menu looks dreamy but there's literally one vegan main. Fitzroy of all places deserves better 🌱 please add more!", at: ago(8, 3), sentiment: "negative", score: -0.3, topics: ["vegan", "menu request"] },
  { loc: 1, source: "google_reviews", kind: "review", author: "Hannah Cole", rating: 4, text: "Lovely room and the mushroom parfait (the one vegan-ish starter) was great. Would be 5 stars with a proper vegan main and more GF marked options.", at: ago(7, 9), sentiment: "positive", score: 0.45, topics: ["vegan", "gluten free", "menu request"], dishes: ["mushroom parfait"] },
  { loc: 0, source: "facebook", kind: "comment", author: "Kirsty Allen", text: "Do you have a gluten free menu? Coeliac here, want to book for a birthday of 12 but need to be sure.", at: ago(4, 6), sentiment: "neutral", score: 0, topics: ["gluten free", "booking", "group booking"] },
  { loc: 2, source: "instagram", kind: "comment", author: "Leon", handle: "@leon.eats.gc", text: "More vegan options at Burleigh please!! The chargrilled broccolini shouldn't be the whole plan 😅", at: ago(3, 12), sentiment: "negative", score: -0.25, topics: ["vegan", "menu request"], dishes: ["chargrilled broccolini"] },

  // ---- Wagyu burger / truffle fries hype
  { loc: 2, source: "instagram", kind: "mention", author: "GC Burger Review", handle: "@gcburgerreview", text: "Marlow & Sage Burleigh's wagyu burger cracks our top 3 on the coast. Brioche holds up, patty pink, onion jam elite. $34 is steep but worth it once.", at: ago(10, 4), sentiment: "positive", score: 0.8, topics: ["burger", "price"], dishes: ["wagyu burger"] },
  { loc: 0, source: "google_reviews", kind: "review", author: "Olivia Chen", rating: 5, text: "Truffle fries are dangerous. Came for a quick lunch, left 2 hours later after dessert. Staff let us linger which we loved.", at: ago(8, 6), sentiment: "positive", score: 0.85, topics: ["lunch", "atmosphere"], dishes: ["truffle fries"] },
  { loc: 1, source: "facebook", kind: "comment", author: "Daniel Reyes", text: "That wagyu burger photo you posted should be illegal. Booking for Saturday.", at: ago(6, 2), sentiment: "positive", score: 0.7, topics: ["burger", "booking"], dishes: ["wagyu burger"] },
  { loc: 2, source: "google_reviews", kind: "review", author: "Pat Lawson", rating: 3, text: "Food is good but $34 for a burger and $14 for fries is getting silly. Great for a treat, not a regular.", at: ago(4, 11), sentiment: "negative", score: -0.2, topics: ["price"], dishes: ["wagyu burger", "truffle fries"] },

  // ---- Brunch at Burleigh
  { loc: 2, source: "google_reviews", kind: "review", author: "Sophie Martin", rating: 5, text: "Weekend brunch here is unbeatable. Miso scrambled eggs, ocean view, flat white that tastes like Melbourne. Get the corn ribs.", at: ago(12, 8), sentiment: "positive", score: 0.9, topics: ["brunch", "coffee", "view"], dishes: ["miso scrambled eggs", "corn ribs"] },
  { loc: 2, source: "instagram", kind: "mention", author: "Brunch Hunters AU", handle: "@brunchhunters.au", text: "Burleigh brunch done right at @marlowandsage — corn ribs, prawn toast, and the best flat white on the strip ☕", at: ago(7, 5), sentiment: "positive", score: 0.88, topics: ["brunch", "coffee", "press"], dishes: ["corn ribs", "prawn toast"] },

  // ---- Parking at Burleigh
  { loc: 2, source: "google_reviews", kind: "review", author: "Gary Mitchell", rating: 3, text: "Food great as always but parking around James St on a Saturday is a nightmare. 25 mins circling. Maybe partner with the lot behind the surf club?", at: ago(9, 7), sentiment: "negative", score: -0.3, topics: ["parking", "weekend"] },
  { loc: 2, source: "facebook", kind: "comment", author: "Nadia H", text: "Any parking tips for Saturday lunch? Last time we gave up and went elsewhere tbh", at: ago(1, 9), topics: ["parking", "weekend"] },

  // ---- Misc positive
  { loc: 0, source: "google_reviews", kind: "review", author: "Liam O'Connor", rating: 5, text: "Anniversary dinner sorted by the team — handwritten card, free glass of sparkling. The pork belly with burnt apple is the best dish in Surry Hills.", at: ago(13, 3), sentiment: "positive", score: 0.92, topics: ["occasion", "service"], dishes: ["pork belly"] },
  { loc: 1, source: "google_reviews", kind: "review", author: "Grace Lim", rating: 5, text: "Fitzroy's room feels like a warm hug. Negroni on tap is genius, kingfish crudo perfect, staff funny without trying too hard.", at: ago(12, 6), sentiment: "positive", score: 0.9, topics: ["atmosphere", "drinks"], dishes: ["kingfish crudo"] },
  { loc: 1, source: "instagram", kind: "mention", author: "Melbourne Iconic Eats", handle: "@meliconiceats", text: "Marlow & Sage Fitzroy interiors >> your favourite wine bar. And the food backs it up.", at: ago(10, 2), sentiment: "positive", score: 0.8, topics: ["atmosphere", "press"] },
  { loc: 0, source: "facebook", kind: "comment", author: "Vanessa Price", text: "Took my parents Sunday lunch, mum hasn't stopped talking about the lamb shoulder. Thank you for making it special.", at: ago(7, 1), sentiment: "positive", score: 0.85, topics: ["occasion", "family"], dishes: ["lamb shoulder"] },
  { loc: 1, source: "google_reviews", kind: "review", author: "Andre Silva", rating: 4, text: "Solid 4. Kingfish crudo and the gnocchi were standouts. Wine list slightly intimidating, could use more by-the-glass under $15.", at: ago(5, 8), sentiment: "positive", score: 0.5, topics: ["wine", "price"], dishes: ["kingfish crudo", "gnocchi"] },
  { loc: 2, source: "instagram", kind: "comment", author: "Tahlia", handle: "@tahlia.gc", text: "Sunset spritz on your terrace is my whole personality now 🍹", at: ago(5, 1), sentiment: "positive", score: 0.8, topics: ["drinks", "view"] },
  { loc: 0, source: "instagram", kind: "comment", author: "Marco", handle: "@marco_eats", text: "The burrata with charred peach... I think about it weekly", at: ago(4, 4), sentiment: "positive", score: 0.82, topics: ["entree"], dishes: ["burrata"] },

  // ---- Misc negative / neutral
  { loc: 1, source: "google_reviews", kind: "review", author: "Tony Marsh", rating: 2, text: "Music was so loud we couldn't talk. Asked to turn it down, was told 'that's the vibe'. Food fine but won't rush back.", at: ago(11, 9), sentiment: "negative", score: -0.6, topics: ["noise", "atmosphere"] },
  { loc: 0, source: "google_reviews", kind: "review", author: "Rachel Green", rating: 3, text: "Booked 7:30, seated 8:05. Apology drink helped. Food was great but tighten up the bookings.", at: ago(6, 5), sentiment: "negative", score: -0.35, topics: ["booking", "wait time"] },
  { loc: 2, source: "facebook", kind: "comment", author: "Ian Porter", text: "Are you open on the King's Birthday public holiday?", at: ago(2, 5), sentiment: "neutral", score: 0, topics: ["hours", "holiday"] },
  { loc: 1, source: "instagram", kind: "comment", author: "Sara", handle: "@sara.mlb", text: "Do you take bookings for groups of 10+? Birthday in July!", at: ago(3, 2), sentiment: "neutral", score: 0, topics: ["booking", "group booking"] },
  { loc: 0, source: "google_reviews", kind: "review", author: "Kevin Doyle", rating: 4, text: "Great spot. Only gripe: the candle situation makes reading the menu a torch-phone exercise. Otherwise faultless.", at: ago(3, 6), sentiment: "positive", score: 0.5, topics: ["atmosphere", "lighting"] },

  // ---- Fresh, UNANALYZED items (last 24h) — the listening agent's inbox
  { loc: 0, source: "google_reviews", kind: "review", author: "Mia Thompson", rating: 5, text: "Friday dinner — pavlova lived up to the hype and service was actually quick this time, big improvement on last month. New floor manager maybe? Whatever you changed, keep it.", at: ago(0, 16) },
  { loc: 0, source: "google_reviews", kind: "review", author: "Josh Carter", rating: 2, text: "45 min wait for mains AGAIN on a Friday. The pavlova at the end almost saved it. Almost. Hire more staff, this is every weekend now.", at: ago(0, 14) },
  { loc: 1, source: "google_reviews", kind: "review", author: "Elena Petrov", rating: 5, text: "Came in nervous after reading about the chicken thing — manager personally told us they've retrained the kitchen and added temp checks. Our meal was perfect. Class act response.", at: ago(0, 12) },
  { loc: 2, source: "instagram", kind: "mention", author: "Gold Coast Foodie", handle: "@gcfoodie", text: "Hot tip: @marlowandsage Burleigh just put a winter truffle menu on. The truffle gnocchi is unreal and nobody knows yet 🤫", at: ago(0, 10) },
  { loc: 2, source: "instagram", kind: "comment", author: "Amber", handle: "@amber.eats.gc", text: "TRUFFLE MENU?? Why was I not informed. Booking now", at: ago(0, 8) },
  { loc: 1, source: "facebook", kind: "comment", author: "Will Hartley", text: "Saw the truffle menu is Burleigh only... Fitzroy when? Don't make me fly north for gnocchi", at: ago(0, 7) },
  { loc: 0, source: "instagram", kind: "comment", author: "Chloe", handle: "@chloe_syd_eats", text: "Pavlova was sold out by 7:45 last night 😭😭 devastated. PLEASE make more", at: ago(0, 5) },
  { loc: 2, source: "google_reviews", kind: "review", author: "Stuart Bennett", rating: 4, text: "Truffle gnocchi from the new winter menu is a knockout. Em recommended the pairing glass of nebbiolo — perfect. Parking still a pain, hence 4 stars.", at: ago(0, 4) },
  { loc: 1, source: "instagram", kind: "mention", author: "Fitzroy Feed", handle: "@fitzroyfeed", text: "Marlow & Sage's negroni on tap + bar snacks after work is criminally underrated. The corn ribs travel south too 🙌", at: ago(0, 3) },
];

const KNOWLEDGE: { path: string; title: string; content: string }[] = [
  {
    path: "brand/voice.md",
    title: "Brand voice",
    content: `# Marlow & Sage — Brand Voice

**One line:** Warm, confident, quietly witty. We sound like a great host, not a marketing department.

## Personality
- Modern Australian: relaxed, generous, never stuffy or formal.
- Witty but understated — one light touch of humour per post max, never forced slang.
- Proud of the food without bragging; let specifics do the talking ("48-hour lamb shoulder", not "amazing food").

## Writing rules
- Australian English spelling (flavour, colour, favourite).
- Sentence case for everything, including headlines. No ALL CAPS.
- Maximum one emoji per caption, two on stories. Never use 🔥 or 😍.
- No exclamation mark pile-ups. One "!" maximum per caption.
- Never use: "foodie", "nom", "drool", "cheat day", "guilt-free", "to die for".
- Hashtags: 3–6, specific over generic (#surryhillseats over #food). Always include #marlowandsage.
- Refer to staff by first name when celebrating them (with their permission noted).
- Acknowledge problems plainly and warmly; never defensive, never corporate ("We hear you, weekends have been slower than we'd like — here's what we're doing").

## Examples
- ✅ "The miso caramel pavlova is back. Torched to order, gone by 8pm most nights — book early if it's the reason you're coming (no judgement)."
- ❌ "OMG our AMAZING pavlova is BACK!!! 😍🔥 Come thru foodies!"
`,
  },
  {
    path: "brand/visual-style.md",
    title: "Visual style",
    content: `# Marlow & Sage — Visual Style

## Photography
- Natural light only look; golden-hour warmth. Never harsh flash or clinical white.
- Camera angles: 45° hero shots for plated dishes, top-down for spreads/tables, eye-level for drinks and interiors.
- Shallow depth of field; the dish is the hero, background softly blurred.
- Real textures: steam, glossy sauces, torched edges, imperfect crumbs. Avoid plastic-perfect AI sheen.
- Include human elements sparingly: hands pouring, a table mid-conversation (no posed faces).

## Palette
- Core: deep eucalyptus green (#1F3A2D), warm terracotta (#C4633A), cream (#F4EDE3), charcoal (#232323).
- Food shots should pull warm tones; interiors lean into green + timber + brass.

## Composition for social
- Stories (9:16): single hero subject, negative space top OR bottom third for text.
- Feed (4:5 preferred, 1:1 ok): can be denser, but one clear focal point.
- Text overlay: minimal. Max 8 words, cream or charcoal, never neon. Lower third preferred.
- Logo: small wordmark bottom-right corner on promotional graphics only; never on reposted customer photos.

## Hard rules
- No stock-photo people. No watermarked content. No competitor venues visible.
- Menu prices only on official menu graphics, never casually in captions.
- Alcohol: always pictured with food, never alone or mid-drink. Include "drink responsibly" nuance for promos.
`,
  },
  {
    path: "brand/guidelines.md",
    title: "Brand guardrails",
    content: `# Brand guardrails (non-negotiables)

1. **Food safety incidents are never content.** If a complaint involves health/safety, escalate to the team privately; never reference publicly.
2. **No discounting culture.** We do "moments" (a free glass for anniversaries), not percentage-off promos, unless ownership signs off.
3. **Staff privacy.** Celebrate staff only with prior consent (current consent list: Em (Burleigh), Marco (Surry Hills floor manager)).
4. **Dietary claims.** Never claim "gluten free" — say "gluten friendly options available, please tell our team about allergies". Vegan dishes must be confirmed against the current menu before posting.
5. **Booking pressure honesty.** If we say "selling out", it must be true. Scarcity claims only with manager confirmation.
6. **Tone under fire.** Respond to criticism with: acknowledge → specific fix → invite back. Never argue, never delete (except abuse/spam).
7. **Local first.** Tag the suburb, name local suppliers when relevant (Tathra oysters, Bellarine olive oil).
8. **Price mentions** only on menu launches, framed as value (provenance, portion, technique).
`,
  },
  {
    path: "audience/personas.md",
    title: "Audience personas",
    content: `# Audience personas

## 1. "Date-night Dana" (28–40, ~45% of weekend bookings)
Plans Thursday–Saturday dinners. Scrolls IG saved folders for "next spot". Responds to: dish hero shots, occasion-worthy interiors, "book now" prompts. Posts stories from the table.

## 2. "Brunch crew Bri" (22–32, dominant at Burleigh weekends)
Group bookings, photographs everything, coffee snob. Responds to: new menu items, staff personality, sunny terrace shots. High share rate on Reels.

## 3. "Local loyal Len" (35–60, midweek regulars, all suburbs)
Knows staff by name, books direct, reads Google reviews. Responds to: behind-the-scenes, supplier stories, midweek specials, honest service updates.

## 4. "Visiting Vic" (interstate/international, Burleigh + Surry Hills)
Found us via "best restaurants in X" lists. Responds to: signature dish content, press mentions, location/view shots.

**Posting windows that perform:** IG 11:30–13:00 and 17:30–19:30 AEST; FB mornings. Reels outperform statics ~3x for reach; statics still convert bookings better.
`,
  },
  {
    path: "operations/locations.md",
    title: "Locations",
    content: `# Locations

## Surry Hills — Sydney NSW (flagship)
402 Crown St. Dinner Tue–Sun, lunch Fri–Sun. 84 seats + 12 bar. Known for: lamb shoulder, pork belly, miso caramel pavlova (Sydney exclusive). Pain point: Friday/Saturday service speed at peak.

## Fitzroy — Melbourne VIC
188 Gertrude St. Dinner Wed–Sun. 62 seats. Known for: kingfish crudo, gnocchi, negroni on tap, moody interiors. Note: recovering from an isolated undercooked-chicken complaint (kitchen retrained, temp checks added — handled, do not reference publicly).

## Burleigh Heads — Gold Coast QLD
43 James St. Brunch + dinner daily. 70 seats + terrace. Known for: brunch (corn ribs, miso scrambled eggs), wagyu burger, sunset terrace, Em's service. New: winter truffle menu (truffle gnocchi). Pain point: weekend parking.
`,
  },
  {
    path: "learnings/content-performance.md",
    title: "Content performance learnings",
    content: `# What works (living document — agent updates with evidence)

- Dish hero + scarcity honesty ("gone by 8pm") = highest booking clicks (pavlova post, +212% saves).
- Staff-name posts (Em) outperform generic service posts ~2.4x on engagement.
- Reels of plating/torching outperform static by ~3x reach; statics convert better to bookings.
- Price-forward posts underperform unless framed around provenance.
- Posting about a fix to a known complaint (e.g. service speed) earns goodwill comments — but only when the fix is real and specific.
- Burleigh content travels: terrace/sunset shots get tagged-shares from tourists.
`,
  },
  {
    path: "learnings/feedback-log.md",
    title: "Human feedback log",
    content: `# Human feedback log (agent: append, never delete)

- 2026-05-28 — Manager: "Less wordy captions. Two sentences max unless it's a menu launch."
- 2026-05-31 — Manager: rejected a post for using 🔥 emoji — reminded of banned list.
- 2026-06-03 — Owner: happy with pavlova scarcity angle; wants same approach for truffle menu launch.
`,
  },
];

async function main() {
  await db.connect();
  console.log("Connected. Clearing existing demo data…");
  await db.query(`
    truncate table chat_messages, chat_threads, outbox_emails, canvas_blocks, agent_events, agent_runs,
      knowledge_revisions, knowledge_files, approvals, posts, reviews, assets, briefs,
      proposed_actions, insights, social_items, connections, locations, brands cascade;
  `);

  const { rows: [brand] } = await db.query(
    `insert into brands (name, tagline, cuisine, country, instagram_handle, facebook_page, website, brand_colors)
     values ('Marlow & Sage', 'Modern Australian, made warm', 'Modern Australian', 'AU', '@marlowandsage', 'MarlowAndSage', 'https://marlowandsage.com.au',
       '["#1F3A2D","#C4633A","#F4EDE3","#232323"]')
     returning id`
  );
  const brandId = brand.id as string;

  const locs = [
    ["Surry Hills", "Surry Hills", "Sydney", "NSW"],
    ["Fitzroy", "Fitzroy", "Melbourne", "VIC"],
    ["Burleigh Heads", "Burleigh Heads", "Gold Coast", "QLD"],
  ];
  const locIds: string[] = [];
  for (const [name, suburb, city, state] of locs) {
    const { rows: [l] } = await db.query(
      `insert into locations (brand_id, name, suburb, city, state) values ($1,$2,$3,$4,$5) returning id`,
      [brandId, name, suburb, city, state]
    );
    locIds.push(l.id);
  }

  for (const provider of ["google_reviews", "facebook", "instagram", "gmail"]) {
    await db.query(
      `insert into connections (brand_id, provider, status, last_synced_at) values ($1,$2,'demo', now())`,
      [brandId, provider]
    );
  }

  let n = 0;
  for (const it of ITEMS) {
    n++;
    await db.query(
      `insert into social_items
        (brand_id, location_id, source, kind, external_id, author_name, author_handle, rating, text, posted_at,
         sentiment, sentiment_score, topics, dish_mentions, is_flagged, analyzed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, case when $11::text is null then null else $10::timestamptz end)`,
      [
        brandId, locIds[it.loc], it.source, it.kind, `seed-${n}`, it.author, it.handle ?? null,
        it.rating ?? null, it.text, it.at.toISOString(),
        it.sentiment ?? null, it.score ?? null, it.topics ?? [], it.dishes ?? [], it.flagged ?? false,
      ]
    );
  }

  // Yesterday's insights (so the dashboard has history before the first live run)
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  await db.query(
    `insert into insights (brand_id, for_date, kind, severity, title, summary, metrics, status) values
     ($1,$2,'trend','info','Miso caramel pavlova is going viral in Sydney',
      'Two food media accounts and multiple customers posted about the pavlova in 48h. Mentions up 5x week-on-week; customers now report it selling out by 8pm. Demand is outpacing supply and Melbourne followers are asking for it.',
      '{"mentions_48h": 5, "wow_change": "+400%"}', 'acknowledged'),
     ($1,$2,'risk','warning','Friday-night service speed at Surry Hills keeps surfacing',
      'Fourth slow-service complaint in two weeks, all Friday/Saturday peak at Surry Hills. Average rating on weekend reviews is 2.7 vs 4.6 midweek. Reviewers praise food and staff attitude but cite 30–45 min waits.',
      '{"weekend_avg_rating": 2.7, "midweek_avg_rating": 4.6, "complaints_14d": 4}', 'acknowledged')`,
    [brandId, yesterday]
  );

  await db.query(
    `insert into proposed_actions (brand_id, kind, title, rationale, status) values
     ($1,'create_brief','Launch content: winter truffle menu at Burleigh',
      'A local food account just leaked the truffle menu organically. Riding the moment with an official launch post (scarcity angle, like the pavlova) should convert the existing buzz into bookings.','proposed')`,
    [brandId]
  );

  for (const f of KNOWLEDGE) {
    const { rows: [kf] } = await db.query(
      `insert into knowledge_files (brand_id, path, title, content, updated_by, change_note)
       values ($1,$2,$3,$4,'human','Initial brand onboarding') returning id, version, content, change_note`,
      [brandId, f.path, f.title, f.content]
    );
    await db.query(
      `insert into knowledge_revisions (file_id, version, content, updated_by, change_note)
       values ($1,$2,$3,'human','Initial brand onboarding')`,
      [kf.id, kf.version, kf.content]
    );
  }

  const counts = await db.query(`
    select (select count(*) from social_items) as social,
           (select count(*) from knowledge_files) as knowledge,
           (select count(*) from insights) as insights`);
  console.log("Seeded:", counts.rows[0]);
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
