# dashboard-ui

Shared UI components for the Momentarium analytics dashboards — the Vercel
dashboard and the Spaces dashboard render the exact same UI from the files
here. One codebase, two platforms: a fix or a redesign lands in both at
once, with no duplicated implementation to drift apart.

This repo is **public by design**: both dashboards load the components at
runtime from jsDelivr, no auth needed. It contains UI code only — no data,
no credentials, no API keys, nothing account-specific.

## Components

### rank-movers

Grouped rank-movers card (new in top-200, dropped out, moved ≥30):

- groups by app, short name once in the header, with ▲/▼/NEW/OUT counters
- groups sorted by mover count, then biggest shift; rows by biggest shift
- filter buttons with counts: All / Gainers / Losers / New in top-200 / Dropped out
- default 5 groups × 5 rows; per-group "Show all N for …" and "Show all N apps"

Load it in a host page:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/momentarium/dashboard-ui@main/rank-movers/rank-movers.css">
<script src="https://cdn.jsdelivr.net/gh/momentarium/dashboard-ui@main/rank-movers/rank-movers.js"></script>
```

Render it (no dependencies, no network calls — the host passes the data):

```js
RankMovers.render(document.getElementById('movers'), movers, {
  appUrl: function (appId, shortName) { return '#/app/' + appId; } // optional
});
```

Canonical mover shape:

```js
{ appId, app, keyword, locale, kind, from, to }
// appId: numeric App Store id (optional; groups fall back to app name)
// app: full app name (shortened with the shared rule inside the component)
// keyword, locale: e.g. 'dmv', 'en-US'
// kind: 'up' | 'down' | 'new' | 'out' ('entered'/'dropped' also accepted)
// from: previous rank or null · to: current rank or null
// new: from=null, to=rank · out: from=rank, to=null
```

Both the Vercel `/api/movers` rows and the Spaces `rank_history_30d`
computation already produce this shape (up to field names: `app_id`/`app_name`/
`position`/`prev_position` are accepted as aliases).

jsDelivr caches the `main` branch for a while. For an urgent update, purge:
`https://purge.jsdelivr.net/gh/momentarium/dashboard-ui@main/rank-movers/rank-movers.js`
(and the same for the `.css`).
