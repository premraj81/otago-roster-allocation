# Otago Roster Allocation

Static web app for Port Otago pilot roster planning, Fiordland vessel allocation, POL cruise ship counts, and print items.

## Deploy on Render

This app is plain HTML, CSS, and JavaScript. Render can deploy it as a Static Site.

- Build command: `echo "Static site - no build step"`
- Publish directory: `.`

The included `render.yaml` contains the same static-site settings for Render Blueprint deploys.

## Data storage

Roster edits and allocations are saved locally as a fallback, and shared live data is stored in Supabase in the `app_state` table. Code updates deployed through GitHub/Render should not erase saved roster data unless storage keys or Supabase rows are intentionally changed.

Shared Supabase keys used by the app:

- `otago-roster-edits-v2`
- `otago-vessel-pilot-allocations-v1`
- `fiordland-calendar-rows-v1`
- `fiordland-calendar-upload-meta-v1`
- `pol-cruise-counts-v1`
- `pol-cruise-records-v1`
- `otago-event-log-v1`
