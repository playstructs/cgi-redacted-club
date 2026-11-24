# The Redacted Club overlay

Everything in this directory is applied to the `structs-webapp` submodule as it
is built. Nothing in the submodule is edited. The client stays in English;
there is no translation layer.

| Path | What it is |
|---|---|
| `patches.cjs` | `[exact upstream text, replacement]` pairs per upstream file: the guild connection, recovery, the telemetry name, players' own pictures, the bunny picker, and Redacted Club in place of SN Corp in sign-up and the tutorial |
| `runtime/` | Loaded before webapp's entry as `__rc`: `guild` (`guild.js`, the services of the guild the page plays through, Redacted Club `0-10`), `recovery` (`recovery.js`, moving a recovered player of another guild into it), `pfp` (`pfp.js`, every portrait showing the player's `pfp` URL over the generated one, and setting a sign-up bunny as `pfp` on chain), `bunnies` (`bunnies.js`, the bunny gallery, at sign-up and on a member's own profile) and `account` (`account.js`, creating the account at sign-up without a recovery key section, and Download Player in place of Log Out) |
| `public/` | Static files served over webapp's: `guild.json` (guild `0-10`'s on-chain endpoint), `favicon.ico`, and `rc/` with `rc.css`, the sign-up badge, the guild logo and icons |
| `page.cjs` | Renders webapp's Twig pages (`templates/`) to `index.html` and `sector-blitz/` (the public leaderboard), adding the icons and `rc.css` |
| `overlay.cjs`, `loader.cjs` | Apply `patches.cjs` to each source file webpack reads |
| `check.cjs` | `npm run check` / `npm test`: stale or orphaned patches, SN Corp left on screen, guild.json against `GUILD_ID` |

## Writing a patch

```js
'js/view_models/signup/Orientation7ViewModel.js': [
  ['on behalf of SN.CORPORATION.`', 'on behalf of REDACTED CLUB.`'],
],
```

- The first string is copied exactly from the upstream file; every occurrence
  is replaced, in one pass, longest first.
- Include enough around it (quotes, tags) that it only matches what you mean,
  never an id, class, storage key or anything sent to the guild or the chain.
  CSS classes such as `snc-logo` keep webapp's names.
- One key per upstream file: a second entry for the same file replaces the
  first.

## The art

`public/rc/img/redacted-club-badge.png` is Redacted Club's bunny logo in white
(the logo's black ink as alpha, so its light areas show the page through) in
the top of a 384px square, the shape of webapp's 192px sign-up logo slot, with
the motto "DWTLK" set under it by `rc.css`. `redacted-club-logo.png` is the logo
as published, 512px square, for `guild.json`. The icons are the logo cropped to
its ink, on its own grey.
