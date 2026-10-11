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
- Equipo inventory and picker share a route-local crop of the existing rarity template and its photo aperture; use the player page's base-point average and existing usage/position/score logic to prevent display drift.
- Match sync: federation calendars are configured in `match_sources` and synced hourly by pg_cron → `/api/public/hooks/sync-matches` (token checked via `check_cron_token`), updating `club_matches` by team + jornada + competicion; why: idempotent, no hardcoded URLs, no secrets in the browser.
