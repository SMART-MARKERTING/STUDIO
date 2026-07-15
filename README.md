# SmartR8 CRM and Social Planner

A mobile-first CRM workspace for Smart Marketing and Adaxa Home. It combines conversations, dashboard follow-up, calendar, apps, file storage, campaigns, reputation, settings, and the existing compliance-conscious Social Planner in one responsive interface.

## CRM workspace

- responsive desktop sidebar and mobile bottom navigation for Home, Conversations, Search, Calendar, and Apps
- Team Inbox, My Inbox, and Internal Chat with search, recency, unread, starred, channel, assignee, and direction filters
- contact details, message history, assignment, read/star state, and browser-local replies
- dashboard metrics, tasks, quick actions, pinned apps, global contact search, and monthly appointments
- browser-local File Storage with folders, search, sorting, grid/list views, previews, rename, move, download, and delete
- campaign status filtering, reputation provider states, appearance modes, and server-verified social connection status

CRM records currently persist in the browser because this repository does not contain a CRM database or messaging adapter. The UI labels local-only actions and unavailable integrations instead of claiming that a provider action succeeded. Connect a server-side CRM API before treating contacts, replies, files, payments, calls, campaigns, or reviews as shared production records.

## Social Planner

The Social Planner supports persistent drafting, platform-specific copy, compliance review, approvals, scheduling, publishing, creative management, attribution, exports, and an audit trail.

### What works without credentials

- browser-persistent posts, platform copy, approvals, assets, filters, and audit history
- monthly and list calendar views, workspace hashtag presets, final-caption preview, and manual post locations
- a seven-post compliance-conscious weekly fallback batch
- Green/Yellow/Red review gates and source/disclosure validation
- creative upload, approval state, download, and deletion
- local analytics, CSV export, workspace backup, pause/resume, and reset

Browser uploads are intentionally local-only. Bundled public assets can be sent to the publishing provider; use a shared HTTPS media host before publishing a newly uploaded creative.

## Live integrations

Configure secrets in the Cloudflare Worker project. Never put them in browser code or commit them to Git.

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Live structured weekly-batch generation |
| `OPENAI_MODEL` | Optional model override; defaults to `gpt-5.6-luna` |
| `AYRSHARE_API_KEY` | Social account verification, publishing, and analytics |
| `AYRSHARE_PAID_PLAN` | Set to `true` only after upgrading Ayrshare; publishing stays blocked while free-plan caption branding is active |
| `AYRSHARE_PROFILE_KEY` | Optional Ayrshare user-profile key |
| `AYRSHARE_TWITTER_API_KEY` | X API consumer key required for X operations after March 31, 2026 |
| `AYRSHARE_TWITTER_API_SECRET` | X API consumer secret required for X operations |
| `STUDIO_ADMIN_EMAIL` | Optional exact-email allowlist for all non-health API routes |

After secrets are added, open **Settings -> Refresh status**. A channel is shown as connected only when Ayrshare reports an active account.

### Remaining provider setup

1. Add the listed secrets to the Cloudflare Worker project; never use `VITE_` variables for provider tokens.
2. Connect Facebook, Instagram, LinkedIn, X, Google Business Profile, and TikTok in Ayrshare Social Accounts.
3. Set `AYRSHARE_PAID_PLAN=true` only after the paid provider plan is active. Publishing remains blocked otherwise.
4. Google Business Profile must be verified with Google before Ayrshare can report it as connected.
5. TikTok publishing requires an approved, publicly reachable video asset. Browser-local uploads cannot be published.
6. The current provider adapter does not expose a native place-search/place-ID contract. Locations can be saved and explicitly appended to captions; the UI states this limitation before scheduling.
7. Calling, payments, review requests, shared CRM conversations, and shared file storage still require dedicated server-side adapters and data stores. Their controls report setup requirements and do not simulate completion.

## Development

Requires Node.js `>=22.13.0`.

```bash
npm ci
npm run dev
```

Verification in the Linux/Cloudflare build image:

```bash
npx tsc --noEmit
npm run lint
npm test
```

The deployable Cloudflare Worker is produced by `npm run build`. API routes are implemented in `worker/index.ts`. The packaged hosting manifest is generated at `dist/.openai/hosting.json` during the Vinext build; there is no source `.openai/hosting.json` in this repository.

## API routes

- `GET /api/health` - non-sensitive health check
- `GET /api/integrations` - verified provider and AI configuration status
- `POST /api/generate-batch` - OpenAI Responses API with strict structured output
- `POST /api/publish` - one platform-adapted Ayrshare request per channel, with UTM tracking
- `GET /api/analytics` - provider history used to reconcile published post IDs
