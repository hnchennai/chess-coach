# Play Store files

Everything Suresh needs for the Play listing, ready to paste or upload. The decisions and the listing text are in `docs/specs/play-listing.product.md`.

| What | Where | Play Console place |
|---|---|---|
| App name, short and full description | `docs/specs/play-listing.product.md`, "Store listing text" | Grow, Store presence, Main store listing |
| App icon, 512 x 512 | `icon-512.png` | Main store listing, Graphics |
| Feature graphic, 1024 x 500 | `feature-graphic.png` | Main store listing, Graphics |
| Phone screenshots, 1080 x 1920 | `screenshots/01.png` to `08.png`, in order | Main store listing, Phone screenshots |
| Policy and data safety answers | `docs/specs/play-listing.product.md`, "Policy and app content answers" and "Data safety answers" | Policy, App content |
| Tester invite and tracking | `tester-invite.md` | Testing, Internal testing |

## Making the images again
After a visible change to the app, rebuild and retake them:

```
sh scripts/build.sh
NODE_PATH=<folder with Playwright>/node_modules node tools/store-shots.js
```

The script takes the 8 screens from the built `www/` at 360 x 640 (x2.5), adds the captions, and writes the feature graphic and icon here. Check every image by eye before uploading.
