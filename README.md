# The Substandard

**All the news that's fit to mangle.**

[thesubstandard.uk](https://thesubstandard.uk)

The Substandard is a comedy news site inspired by [XKCD #1288](https://xkcd.com/1288/) ("Substitutions"). It fetches real news headlines via RSS and applies word substitutions to make them considerably more entertaining and considerably less informative.

Substituted words are highlighted so you can see what's been mangled, and you can toggle between the original and mangled versions. The substitution rules are fully customisable in-browser.

Built as a demo project for [Spec-Driven Development](https://specmcp.ai) workshops.

---

## How It Works

The site is a single HTML file with zero build dependencies. It fetches RSS feeds from BBC, Guardian, Sky News, and Ars Technica via a lightweight Cloudflare Worker proxy, then applies 90+ word substitutions client-side.

```
[RSS Feeds] → [Cloudflare Worker proxy] → [index.html substitution engine] → [comedy]
     BBC          api.thesubstandard.uk         thesubstandard.uk
     Guardian
     Sky News
     Ars Technica
```

### Features

- **Four news desks**: UK, World, Tech, Sport — each with its own RSS sources
- **90+ substitution rules** covering XKCD classics, UK politics, tech jargon, and custom entries
- **Case preservation**: "PRESIDENT" → "BOSS MONKEY", "President" → "Boss Monkey"
- **Grammar correction**: automatically fixes a/an after substitutions ("a election" → "an eating contest")
- **Show originals toggle**: compare mangled vs real headlines
- **Live editing**: add/remove substitution rules from the Substitutions tab
- **Feed caching**: fetched feeds are cached per-session so you can flip between tabs

---

## Repository Structure

```
thesubstandard/
├── index.html          # The site — loads substitutions.js
├── substitutions.js    # All word swap rules (edit this to add/remove subs)
├── worker.js           # Cloudflare Worker RSS proxy (deployed separately)
├── CNAME               # GitHub Pages custom domain config
└── README.md
```

---

## Deployment Guide

### Prerequisites

- A Cloudflare account (free tier is fine)
- The domain `thesubstandard.uk` registered and active on Cloudflare
- A GitHub account

### Step 1: Create the GitHub Repository

1. Create a new repository on GitHub (e.g. `thesubstandard`)
2. Push `index.html`, `worker.js`, `README.md` to the `main` branch
3. Create a file called `CNAME` in the repo root containing just:
   ```
   thesubstandard.uk
   ```

### Step 2: Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Select the `main` branch, root (`/`) folder
4. Click **Save**
5. GitHub will deploy the site at `https://yourusername.github.io/thesubstandard/`

### Step 3: Configure Cloudflare DNS for the Main Site

In the Cloudflare dashboard, go to your `thesubstandard.uk` domain → **DNS** → **Records**.

Add these records to point the domain at GitHub Pages:

| Type  | Name | Content                      | Proxy |
|-------|------|------------------------------|-------|
| CNAME | @    | `yourusername.github.io`     | DNS only (grey cloud) |

> **Note**: Replace `yourusername` with your actual GitHub username. GitHub Pages requires the DNS-only (unproxied) setting to issue the SSL certificate. Once the cert is issued and working, you can optionally switch to proxied (orange cloud).

After adding the DNS record:

1. Go back to GitHub → repo **Settings** → **Pages**
2. Under **Custom domain**, enter `thesubstandard.uk`
3. Click **Save** — GitHub will verify the DNS and issue an SSL certificate
4. Tick **Enforce HTTPS** once the certificate is ready (may take a few minutes)

### Step 4: Deploy the Cloudflare Worker (RSS Proxy)

The worker acts as a CORS proxy that fetches RSS feeds and returns parsed JSON. It's needed because browsers can't fetch RSS from other domains directly.

1. In the Cloudflare dashboard, go to **Workers & Pages** (in the sidebar)
2. Click **Create**
3. Select the **"Hello World"** template
4. Name it `substandard-rss-proxy`
5. Click **Deploy** — this creates the worker with placeholder code
6. Click **Edit Code** — this opens the in-browser code editor
7. **Select all** the placeholder code and **delete it**
8. **Paste** the entire contents of `worker.js` from this repository
9. Click **Deploy** (top right)

#### Test the Worker

Visit this URL in your browser (replacing the domain with your worker URL):

```
https://substandard-rss-proxy.youraccount.workers.dev/?feed=https://feeds.bbci.co.uk/news/uk/rss.xml
```

You should see a JSON array of BBC news articles. If you see `{"error":"Missing ?feed= parameter"...}` when visiting the root URL, that's correct — it needs the `?feed=` parameter.

#### Add a Custom Domain to the Worker

1. Go to your worker in the Cloudflare dashboard
2. Go to **Settings** → **Domains & Routes**
3. Click **Add** → **Custom Domain**
4. Enter `api.thesubstandard.uk`
5. Cloudflare handles the DNS automatically since the domain is on your account

### Step 5: Update the Worker URL in index.html

At the top of `index.html`, find this line:

```javascript
const WORKER_URL = 'https://api.thesubstandard.uk';
```

Make sure it matches your worker URL — either the custom domain above or the default `*.workers.dev` URL.

> **Fallback**: The site also has a fallback to `rss2json.com` as a free CORS proxy. This means the site will work even before the worker is deployed, but it's rate-limited and less reliable. Once your worker is live, it takes priority.

---

## Local Development

No build step required. Just open the file:

```bash
# Option 1: Just open it
open index.html

# Option 2: Local server with live reload
python3 -m http.server 8000
# Then visit http://localhost:8000
```

The worker's CORS config already allows `localhost:8000` and `localhost:3000`.

---

## Substitution Highlights

A few favourites from the current ruleset:

| Original | Substitution |
|----------|-------------|
| AI | Slop Generator |
| Meta | Gas Light Inc |
| startup | mad punt |
| Trump | Commander in Cheese |
| president | boss monkey |
| Keir Starmer | Keith from HR |
| parliament | the shouting room |
| NHS | the queue |
| officials say | some bloke reckons |
| sanctions | strongly worded Post-it notes |
| cryptocurrency | Monopoly money |
| supreme court | vibes tribunal |
| launched an investigation | had a bit of a look around |

Plus all the XKCD classics: senator → elf-lord, car → cat, space → Spaaace, etc.

The full list of 90+ rules is editable in-browser on the Substitutions tab.

---

## Technical Notes

### Substitution Engine

- Substitutions are sorted by length (longest first) to prevent partial matches — "prime minister" is matched before "minister"
- Matched words are wrapped in marker tokens (`⟦SUB:replacement⟧`) during processing, which prevents double-substitution
- Case is preserved by detecting the pattern of the original (ALL CAPS, Title Case, lowercase) and applying it to the replacement
- A post-processing pass fixes `a`/`an` articles before substituted words, with exception lists for vowel-sound consonants ("an NHS") and consonant-sound vowels ("a unicorn")

### RSS Proxy Worker

- Allowlisted feed domains only (BBC, Guardian, Sky, Reuters, Ars Technica, etc.)
- CORS headers for thesubstandard.uk and localhost
- 5-minute cache on responses
- Simple regex-based XML parsing (no dependencies)
- Returns max 10 articles per feed

---

## Credits

- Inspired by [XKCD #1288: Substitutions](https://xkcd.com/1288/) by Randall Munroe
- Also draws from [XKCD #1625](https://xkcd.com/1625/) and [#1679](https://xkcd.com/1679/)
- Built by [Kevin Ryan](https://kevinryan.io)
- Part of the [Spec-Driven Development](https://specmcp.ai) workshop material

---

*No journalists were harmed in the making of this website. Their words, however, were absolutely brutalised.*
