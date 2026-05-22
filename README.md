# Otago Roster Allocation

Static web app for Port Otago pilot roster planning, Fiordland vessel allocation, POL cruise ship counts, and print items.

## Deploy on Render

This app is plain HTML, CSS, and JavaScript. Render can deploy it as a Static Site.

- Build command: `echo "Static site - no build step"`
- Publish directory: `.`

The included `render.yaml` contains the same static-site settings for Render Blueprint deploys.

## Data storage

Roster edits and allocations are saved in the browser using localStorage. Code updates deployed through GitHub/Render should not erase saved browser data unless storage keys are intentionally changed.
