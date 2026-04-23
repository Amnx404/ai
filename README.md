# RoboRacer Chat Widget

RoboRacer is a **customer-facing AI chat widget** that you embed on a website to answer questions using *your* content—docs, help center, and product pages—so customers get fast, consistent answers and your team handles fewer repetitive tickets.

### What it does

- **On-site AI assistant**: a branded chat widget that lives on your site and answers visitor questions.
- **Grounded in your pages**: RoboRacer builds a knowledge base by crawling your approved URLs, cleaning the content, and indexing it so answers stay aligned with what you publish.
- **Safe-by-scope behavior**: you can define **where** the widget is allowed to run (domains) and **what** it should focus on (topics / scope).
- **Multi-site ready**: manage multiple customer sites (or multiple properties) from a single admin.

### Who it’s for

- **Support & CX teams** that want faster, more consistent answers for customers.
- **Product & Docs teams** that want docs to “answer themselves” directly on the website.
- **Agencies** managing multiple client sites and brands.

### The customer workflow (how you use RoboRacer)

1. **Create a site** in the admin and set your brand basics (name, colors, title, greeting, logo).
2. **Define guardrails**
  - **Allowed domains**: where the widget can be embedded/served.
  - **Allowed topics (scope)**: what the assistant should focus on answering.
3. **Build your knowledge base**
  - Paste your **seed URLs** (starting points like docs home, help center, key pages).
  - Set **allowed prefixes** so crawling stays within the sections you approve.
  - Start a refresh: RoboRacer runs a simple pipeline of **Scraping → Cleaning → Indexing**.
4. **Embed the widget** on your site and ship it.
5. **Refresh anytime** when docs change (new releases, new pages, updated policies).

### What you can customize

- **Branding**: colors, title, greeting, logo.
- **Behavior**: allowed domains, allowed topics/scope, and model settings (e.g. response “creativity”).
- **Knowledge**: what gets crawled and how broad the crawl should be.

### Trust, privacy, and control (high level)

- **You choose the sources**: RoboRacer only indexes what you point it at (seed URLs + allowed prefixes).
- **You control where it runs**: allowed domains reduce accidental embedding on untrusted sites.
- **Designed for website support**: the system is optimized for answering questions from public-facing content (docs/help pages) rather than acting as an unrestricted general chatbot.

### Plans & billing

RoboRacer is built to support **usage-based plans** and multiple tiers:

- **Free**: basic scraping + standard widget
- **Pro**: higher coverage + faster indexing
- **Scale**: multi-site operations + priority pipeline

Billing and plan enforcement are marked as **coming soon** in the product UI today.

### What’s coming next

- Higher scrape limits and additional crawl presets
- Faster indexing and stronger monitoring/observability
- More controls for multi-site teams

---

If you’re evaluating RoboRacer, the best test is simple: pick a docs section customers already ask about, run a knowledge base refresh, embed the widget on that section, and compare how many questions get resolved without human intervention.