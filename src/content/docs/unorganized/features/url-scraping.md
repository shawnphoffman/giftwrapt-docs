---
title: URL scraping
description: Paste a product link, get an item with title, photo, and price.
---

Adding items by hand is tedious. GiftWrapt lets you paste a product URL and pulls back the title, photo, and price automatically.

## How it feels

1. Click **Add item** on a list.
2. Paste a URL (Amazon, Etsy, an indie shop, anywhere).
3. The form fills itself in. Edit anything you want; save.

If a site is JavaScript-heavy and the basic scrape comes back empty, the **AI extractor** kicks in as a fallback and reads the rendered page.

## Limits

Some retailers actively block bots, gate content behind login, or change their markup faster than scrapers can keep up. When that happens you'll see partial or empty results — fall back to filling in the fields manually.

For self-hosters who want to tune the scraping pipeline (browserless, AI extractor providers, queue concurrency, retries), see the operational reference: [URL scraping pipeline](/scraping/).
