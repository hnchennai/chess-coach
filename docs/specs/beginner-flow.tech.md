# Beginner flow, level check and cloud save (tech spec)

Pairs with `beginner-flow.product.md`. Draft v2, after independent spec review. Grounded in the code as of build 1.0.7.

## Current state (read from code)
- Web source of truth: scratchpad `t/` (`app4.js` is published as `js/app.js`; `head.html` + `body.html` build `index.html` via `build.sh`, which has a hard-coded script list). `www/` here is a synced copy with offline vendor paths (`sync_www.sh`).
- `app4.js` (about 1,700 lines, one IIFE): `prof` (`v: 4`, games, puz, rating 800, rn, course, days, t, theme, reviewed) in localStorage `suresh-chess-coach.profile.v1`; `saveProfile()` sets `t = now`; `migrate()` at load; `mergeProfile(c)` decides rating/theme by whole-profile `t`; Claude-account sync in `initCloud` / `pullCloud` / `push`.
- `nextUnit()` (app4.js:1218) returns the first unfinished unit in course order (`rules`, `special`, `board`, `values`, ...). No start-point concept today.
- Hints: unlimited, 3 steps per position (app4.js:776 to 790).
- Opponents: `OPP` (Beginner 400, Casual 700, Improver 1000, Club 1320, ...); `recLevel()` picks from rating.
- Puzzle bank `PUZZLE_BANK`: `{f, s, t, r}`; themes include `mateIn1` (39), `mate`, `mateIn2`, hanging, fork, pin, skewer.
- Android: Capacitor 6 project generated in CI, so native code comes from a local plugin package.

## Proposed changes

### New pure module `js/profile.js` (testable in Node)
- Exports (as `window.Profile` in the browser, `module.exports` in Node): `LEVELS` table (bands, start units, starting ratings, opponent index), `migrate(p)`, `merge(local, cloud)`, `levelFromRating(r)`, `scoreLevel(path, answers)`, `startUnit(level, knowsMoves)`, `unlockDone(prof, units)`.
- `app4.js` calls these instead of its inline `migrate` / `mergeProfile`.
- `build.sh` and `sync_www.sh` add `profile.js` and `placement.js` to the script list before `app.js`.

### Data (profile v5)
- `level`: `'beginner' | 'improver' | 'club'`; `levelT`: time of the last level choice (0 when derived); `placed`: `'check' | 'chosen' | 'derived'`.
- `start`: unit id the course begins at. `nextUnit()` skips units before `start`; nothing is ever marked done to achieve this.
- `showAll`: boolean (reveal everything, no other effect). `unlockAll`: boolean (set for upgraded v4 players and on level-up). `provisional`: boolean, true for a level set before the first successful cloud load.
- `pgsDeclined`: boolean (never auto-prompt again). `levelOfferT`: time of the last "Not yet".
- `migrate()`: keeps all v5 fields if present. For a v4 profile with any games, puzzles or course progress: `level = levelFromRating(rating)` using the product band table, `levelT = 0`, `placed = 'derived'`, `start = 'rules'`, and all tabs unlocked (`unlockAll: true`). A v4 profile with no progress is treated as new (sees the check).
- `merge()`: course, games, reviewed = unions (never remove); `unlockAll` = OR; `level`, `start` follow the higher `levelT`, except a `provisional` local level always loses to a non-derived cloud level; `rating`, `rn` follow the higher `rn` (tie: newer `t`); `showAll` and theme follow `t`; `pgsDeclined` stays local only. `provisional` clears after the first successful cloud load.

### Level check (`js/placement.js`)
- Uses `Profile.scoreLevel` for all rules in product AC3 and AC4.
- Puzzle pick: Know-the-moves = 5 from ratings about 500 to 1100 (hanging, `mateIn1`, fork); Play-often = 6 from about 700 to 1700 (adds pin, skewer, `mateIn2`); "Try Club?" = 2 from about 1500 to 1800. Seeded by install id + attempt number, so retakes differ.
- UI: full-screen sheet, one puzzle per screen, Skip on every step, reuses the board in `st.mode = 'placement'`. One attempt per puzzle; first move correct = correct.
- On finish: set `level`, `levelT = now`, `placed`, `start`; if `rn === 0` set `rating` to the level's starting rating.

### Interface by level
- `document.documentElement.dataset.level` = `prof.level`; `dataset.showall` = `'1'` when on. CSS hides by attribute (eval strip, `.engine-pill`, move list, ratings, notation chips) unless `showall`.
- JS: tabs (Beginner: 3 until `unlockDone(prof)`: count of units at or after `start` in course order with `unitDone(u)` true is 3 or more, or `unlockAll`, or `showAll`), opponent name and default opponent per level table, plain-language move strip (reuses `describe()`), review without notation for Beginner.
- Phones (<= 600px): `.tabs` fixed to the bottom with `env(safe-area-inset-bottom)` padding; body gets matching bottom padding.
- Beginner Home: prototype A (Rani, one Continue card from `nextUnit()`, "Just play a game" starting the level's opponent).
- Level-up offer: when every unit of the current level is done, Rani's offer card; `levelOfferT` stores a "Not yet" time (re-offer after 7 days).
- Hints: unchanged (unlimited) for every level.

### Cloud save (Android, slice 3)
- Local Capacitor plugin `plugins/play-games/` (Java), `file:` dependency in `package.json`.
  - `com.google.android.gms:play-services-games-v2` pinned to the exact latest version on Google Maven when slice 3 starts.
  - Methods: `isAuthenticated()`, `signIn()`, `load({name})` -> `{data, conflict?: {local, server}}`, `save({name, data})`, `resolve({conflictId, data})`.
  - `PlayGamesSdk.initialize`, `PlayGames.getGamesSignInClient`, `PlayGames.getSnapshotsClient` with `RESOLUTION_POLICY_MANUAL`; on conflict both versions go to JS, `Profile.merge` combines them, `resolve` writes the merged copy.
  - Requests no scopes beyond Games sign-in. Stores no player name or id in `prof`. Never logs snapshot contents or player ids.
  - Two CI repo variables: `PGS_APP_ID` (id, not secret) and `PGS_PUBLIC` (`true` only after Suresh's publish checkpoint). With `PGS_PUBLIC` off, the Play Games button is hidden and the first-launch wait is skipped unless this device signed in before; a tester unlocks the button by tapping the version number in Settings 5 times.
  - Manifest meta-data `com.google.android.gms.games.APP_ID` = `@string/game_services_project_id`; CI writes `res/values/games-ids.xml` from repo variable `PGS_APP_ID` (an id, not a secret). If `PGS_APP_ID` is empty the plugin is left out and the app runs phone-only.
- JS adapter beside the Claude adapter: first-launch restore (10s timeout, skipped when `navigator.onLine` is false or per `PGS_PUBLIC`) before the check; saves on lesson complete, puzzle set end, game end, and `visibilitychange` hidden. Snapshot name `progress`, JSON `{prof, game}`.
- Play Console setup (Suresh, checkpoint): app `com.suresh.chesscoach`; Play Games Services project; Android credential with package name and release key SHA-1 `85:7E:A4:32:E3:29:C4:57:92:83:B4:31:B1:AA:C9:14:B7:6F:1A:ED`; Saved Games on; Suresh as tester. Publishing the Games Services setup is a separate checkpoint. If Play App Signing is used later, add a credential with Google's app-signing SHA-1.

## Slices
| # | Slice | Complexity | Risk tags | Depends on |
|---|---|---|---|---|
| S1 | `profile.js` (v5, migrate, merge, scoring), `placement.js`, first-launch flow, Settings "Your level" + "Show everything" | 3 | ui, data | spec gate |
| S2a | Level-based interface switches, plain move strip, fixed bottom nav, tab unlock | 3 | ui | S1 |
| S2b | Beginner Home (picked layout) | 3 | ui | S1, D10 |
| S3 | Play Games plugin + cloud adapter + first-launch restore | 4 (design-only pass first) | integration, data | S1, Play Console (D11) |

## Tests
- `node --test` on `profile.js`: scoring table (every row of AC3 and AC4), v4 to v5 migrate fixtures (new, 820 rating, 1350 rating, empty), merge cases (union never loses; level by `levelT`; rating by `rn`; fresh check vs older cloud level).
- Playwright e2e at 412 x 915 and 1280 x 900: each first-launch path, skip at each step, "Try Club?", unlock after 3 lessons, Settings level change and "Show everything", v4 profile not asked, no console errors.
- S3: CI compiles the plugin; on-device checks by Suresh on a tester account (sign in, reinstall restores, decline never re-prompts).

## Risks
- Play Games sign-in only works for testers until the setup is published. Mitigated by the empty-`PGS_APP_ID` switch and the publish checkpoint.
- Play Console identity verification can take days; S3 waits on it.
- Level-based hiding must not break the 3D board, puzzles or review. Covered by e2e at each level.

## Sync safety rules (added after S1 review)
- No profile or game push to any cloud until this session's first pull has finished (data merged, or the cloud confirmed empty). A failed pull retries with backoff; pushes wait.
- `provisional` is set only by the first-launch check on a device that has never completed a cloud load (`suresh-chess-coach.cloudSeen` flag). Settings changes and retakes are never provisional.
- `unlockAll` from a derived (v4) copy does not override a local non-derived level.
- `merge()` skips corrupted entries instead of throwing, keeps unknown keys from either copy and the higher `v`.
