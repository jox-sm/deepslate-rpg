<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Deepslate Dungeons Next.js App Router project.

## Changes made

- **`instrumentation-client.ts`** (new) — Initializes PostHog client-side using the Next.js 15.3+ instrumentation pattern, with reverse proxy support, error tracking, and debug mode in development.
- **`next.config.ts`** — Added reverse proxy rewrites for `/ingest/static/*`, `/ingest/array/*`, and `/ingest/*` to route PostHog requests through the app, plus `skipTrailingSlashRedirect: true`.
- **`.env.local`** — Added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` environment variables.
- **`components/background/slidebar.tsx`** — Added `sidebar_toggled` and `navigation_item_clicked` event captures.
- **`components/adventures/cards/cards.tsx`** — Added `adventure_card_viewed` event capture on card mount.

## Events instrumented

| Event | Description | File |
|-------|-------------|------|
| `sidebar_toggled` | User expands or collapses the sidebar navigation | `components/background/slidebar.tsx` |
| `navigation_item_clicked` | User clicks a nav item in the sidebar (Home, Inventory, Settings, Profile) | `components/background/slidebar.tsx` |
| `adventure_card_viewed` | User views an adventure/project card on the home page — top of engagement funnel | `components/adventures/cards/cards.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/416502/dashboard/1563680)
- [Adventure Card Views Over Time](https://us.posthog.com/project/416502/insights/6oX3jNtE)
- [Navigation Clicks by Section](https://us.posthog.com/project/416502/insights/fllhgRBw)
- [Sidebar Toggle Usage](https://us.posthog.com/project/416502/insights/LWt8p8bF)
- [Overall Engagement — All Events](https://us.posthog.com/project/416502/insights/5Lqqa5t5)
- [Unique Active Users Per Day](https://us.posthog.com/project/416502/insights/b27lwoso)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
