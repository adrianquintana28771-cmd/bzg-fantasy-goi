<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
Player photo surfaces share decorative layers and resolve existing Storage objects by club_player_id and rarity, preferring WebP then PNG, falling back to common then placeholder on absence or load failure; uploads preserve original bytes and matching extension/MIME.
- Player photo containers render shared decorative layers independently of photo availability, with cover-fit images above them; why: one consistent fallback and no layout gaps without altering uploaded bytes.
- Equipo inventory and picker share a route-local crop of the existing rarity template and its photo aperture; use the player page's base-point average and existing usage/position/score logic to prevent display drift.
- Match sync: federation calendars are configured in `match_sources` and synced hourly by pg_cron → `/api/public/hooks/sync-matches` (token checked via `check_cron_token`), updating `club_matches` by team + jornada + competicion; why: idempotent, no hardcoded URLs, no secrets in the browser.
- Coach scoring uses the existing recorded-action branch of recalc_player_stats without a match-result fallback; why: synchronized fixtures must not create unrecorded coach performance points.
- Score audit and profile breakdown reuse the editable goalkeeper criteria per match, rounded before jornada aggregation; criterion saves invalidate cached reads so closed-jornada totals and rankings reflect recalculation without changing frozen selections.
- Performance previews reuse the audit calculator, and successful saves invalidate dependent cached reads including closed-jornada history; why: show current scores without rewriting frozen lineup selections.
- Scheduled match codes reuse misiones with an activation timestamp; redemption checks the stored interval directly and scheduling interprets wall time in Europe/Madrid, avoiding cron delays and browser timezone drift.
- Score surfaces use the role-aware formatter without modifying values or ranking order; ranking lineup details use a narrow read-only RPC with frozen selections taking precedence and the same account exclusions as the public ranking, preserving table RLS.
- Pack-opening video stays route-local, loaded only during opening with a synchronous click guard; reveal existing RPC results on playback end or failure and release the media on exit, without changing pack selection or persistence.
