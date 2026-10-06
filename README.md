# Blufin Poke Co

Website for Blufin Poke Co, a poke and Baja craft beer spot in La Paz, BCS. It's built with
Next.js (App Router) and TypeScript, and is exported as a fully static site.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing: hero with "Arma tu poke" and "Ver menú", the build-your-bowl section, "¿Qué se te antoja?" tiles, "Nuestra esencia es Baja", and location and hours |
| `/arma-tu-poke` | Bowl builder: intro, 6 steps (base, protein and size, mix-ins, salsa, toppings, crunchies), summary with extras, optional drinks step, then a QR code for the waiter |
| `/menu` | Full menu with filter tabs. Deep-link with `?tab=poke\|beer\|aguas\|nac\|extras` |
| `/orden` | Waiter ticket opened by scanning the customer's QR. With no order in the link, it shows a sample |
| `/menu-tv` | Restaurant TV screen at 1920×1080, scaled to any display. Poke menu on one half, rotating drink lists on the other. Options: `?s=10` (seconds per drink screen, 4–30) and `?lado=der` (poke half on the right) |

## How ordering works

There is no checkout and no backend. "Generar mi código" packs the order into the QR link itself
(`/orden#<base64url JSON>`, see `src/lib/order.ts`). The waiter scans it with their phone camera,
and the ticket page decodes it. The order is also printed under the QR, so it can be read off the
customer's screen if scanning fails. A customer could edit the link, so the ticket reminds the
waiter to confirm the order.

## Editing the menu

All menu items, prices, photos, address, hours and social links live in **`src/data/menu.ts`**.
The website, the builder, the TV screen and the waiter ticket all read from it.

Values marked `PLACEHOLDER` there were guessed during design and still need to be confirmed:

- Bowl prices (Small $165 / Regular $235)
- 12 oz tap prices (set to $20 below the 16 oz price)
- Bottle vs. can for national beers, waters and sodas
- Instagram / Facebook / TikTok profile links
- Photos (Unsplash stock). Name-only options without a photo show a striped "foto" placeholder

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export to out/
npm start        # serve out/ locally
npm run lint     # type-check
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`. `out/` can also
go on any static host (Vercel, Netlify, Cloudflare Pages, S3…). When the site lives under a sub-path,
build with `NEXT_PUBLIC_BASE_PATH=/sub-path`; the Pages workflow sets this automatically. The QR links
use the site's own address, so they work once the site is on its public URL.

## Design reference

`design/` holds the Claude Design handoff: the HTML prototypes, the design chat transcript
(`design/chats/chat1.md`) and the reference images. It is for reference only and not part of the
build.
