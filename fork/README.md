# postbeep/bb

A personal fork of [get-bb/bb](https://github.com/get-bb/bb). It builds **Postbeep** (`com.postbeep.bb`), an iPhone app that runs beside the App Store bb app against a stock bb server and keeps a page's audio playing while the phone is locked or another app is in front, so that Talkback can be listened to that way.

Nothing here is sent upstream. Do not open pull requests against get-bb/bb from this repository. GitHub Actions are turned off in this fork.

The plans live in the central specs store; each fork change names its plan.

| Fork change | What it does |
| --- | --- |
| `bb-fork-ios-background-audio` | The Postbeep app identity, background audio, and a page marker for Talkback |
| `bb-fork-ios-scheme-links` | `postbeep://` links open the same thread or screen as the matching `bb://` link |
| `bb-fork-postbeep-branding` | The app's and the repository's own name where they still said bb |
| `bb-fork-postbeep-mark` | The pb mark, drawn in bb's construction in the fork's terracotta, on the icon, the launch splash, and desktop icon files |

## Branches and commits

- `fork/v<version>` is the upstream release tag `desktop-v<version>` plus the fork's commits. The newest one is the default branch.
- `main` follows upstream and is not used.
- The fork has no tags of its own; release tags come from the `upstream` remote.
- Every fork commit ends with a trailer naming its plan, for example `Fork-Change: bb-fork-ios-background-audio`. History stays linear: no merge commits.

## Upstream files edited

| File | Fork change | Edit and reason |
| --- | --- | --- |
| `apps/mobile/app.config.js` | `bb-fork-ios-background-audio` | One line: `BB_MOBILE_VARIANT=fork` hands the config to `apps/mobile/plugins/with-fork-variant.js`, which applies `fork/identity.json`. |
| `apps/mobile/eas.json` | `bb-fork-ios-background-audio` | `fork` build and submit profiles, for TestFlight builds under the user's Apple team. |
| `apps/mobile/src/screens/webview/ProfileWebViewScreen.tsx` | `bb-fork-ios-background-audio` | One import and one wrapped call: the injected bridge script is passed through `withForkMarker` (`fork-marker.ts`), which adds a frozen `window.bbFork = { backgroundAudio: true, version: 1 }` after the stock bridge. The handshake is unchanged. |
| `apps/mobile/src/app-shell/LaunchSplash.tsx` | `bb-fork-ios-background-audio`, `bb-fork-postbeep-mark` | The in-app splash overlay uses the Postbeep mark when the variant is `fork`, in its light or dark form for the phone's appearance. The stock light, dark, and dev marks stay as they are. |
| `apps/mobile/app/+native-intent.tsx` | `bb-fork-ios-scheme-links` | One import and one wrapped argument: every incoming link passes through `withAppScheme` (`src/lib/fork/app-scheme-link.ts`) before upstream resolves it. A link in the app's own scheme, `postbeep://`, becomes `bb://`, so upstream's link rules apply to it. With the stock scheme `bb`, nothing changes. |
| `apps/mobile/src/screens/settings/NotificationsSettingsScreen.tsx` | `bb-fork-postbeep-branding` | One line: the push permission prompt says "pb will ask this phone for permission, then register it with …" instead of "bb will ask…". There is no build setting for in-app text, so the source line itself changes. If a bb release changes this line or the lines around it, the move stops on this file; see below. |

The audio background mode itself is set in `apps/mobile/plugins/with-fork-variant.js`, so it applies only to Postbeep.

Each fork change keeps its commits cheap to move. None changes any `package.json`, `pnpm-lock.yaml`, or `packages/`, and new files go only under `apps/mobile/` and `fork/`. The one exception is `.github/README.md`, which GitHub shows on the repository page in place of upstream's `README.md`; it conflicts on a move only if upstream adds a file of that name. Their limits on edited upstream files:
- `bb-fork-ios-background-audio`: at most 4 files, with at most 40 changed lines among them;
- `bb-fork-ios-scheme-links`: only `+native-intent.tsx`, with at most 6 changed lines;
- `bb-fork-postbeep-branding`: only `NotificationsSettingsScreen.tsx`, with at most 2 changed lines. Its one new file outside `apps/mobile/` and `fork/` is `.github/README.md`.
- `bb-fork-postbeep-mark`: only `LaunchSplash.tsx`, with at most 6 changed lines, on top of `bb-fork-ios-background-audio`'s edit of that file.

## Setting up a checkout

```sh
git clone https://github.com/postbeep/bb.git && cd bb
git remote add upstream https://github.com/get-bb/bb.git
git remote set-url --push upstream no-push-to-upstream
gh repo set-default postbeep/bb
git switch fork/v0.46.0
corepack pnpm install --frozen-lockfile
```

Turbo needs `pnpm` on the `PATH`. Without a global pnpm, `corepack enable --install-directory <dir> pnpm` puts one in `<dir>`.

## Moving to a new bb release

```sh
fork/rebase.sh desktop-v0.46.1
```

The script fetches both release tags from `upstream`, creates `fork/v0.46.1` from the new tag, and cherry-picks the current branch's fork commits onto it. Then it prints each fork change's footprint and runs `pnpm install --frozen-lockfile` and `turbo run typecheck lint test --filter=@bb/mobile`.

- On a conflict it removes the new branch, names the conflicting files, and exits 1. The current branch is never changed.
- `--branch <name>` picks another name for the new branch, for trial runs.
- `--only <change>` moves just one fork change's commits. This works only for a change that applies to the bare release tag. A change that builds on another, as `bb-fork-ios-scheme-links` builds on `bb-fork-ios-background-audio` through this README, stops with a conflict; a full move prints its footprint instead.
- `--no-checks` skips the install and checks.

If the move stops on `NotificationsSettingsScreen.tsx`, a bb release has changed the push permission prompt. Resolve it by hand in favor of the fork's wording, for example for `desktop-v0.46.1`:
1. `git switch -c fork/v0.46.1 desktop-v0.46.1`, then `git cherry-pick desktop-v0.46.0..fork/v0.46.0`.
2. In the conflicting file, keep "pb will ask this phone for permission, then register it with …", and take upstream's other changes.
3. `git add apps/mobile/src/screens/settings/NotificationsSettingsScreen.tsx`, then `git cherry-pick --continue`.
4. Run `corepack pnpm install --frozen-lockfile` and `pnpm exec turbo run typecheck lint test --filter=@bb/mobile`.

Push the new branch, make it the default, and rebuild the app when the bb server is upgraded to that release.

## Building and installing Postbeep

The fork variant takes its name, bundle ID, URL scheme, Apple team, and Expo owner and project from `fork/identity.json`, and drops bb's universal links. Check what it resolves to with `BB_MOBILE_VARIANT=fork pnpm exec expo config --type public` in `apps/mobile`.

The icon and the launch splash show the pb mark, described in its own section below.

Builds run on EAS under the user's Expo account. From `apps/mobile`:

```sh
BB_MOBILE_VARIANT=fork pnpm exec eas build -p ios --profile fork
pnpm exec eas submit -p ios --profile fork --latest
```

The build goes to TestFlight internal testing. TestFlight builds expire after 90 days, so rebuild at least that often, and whenever the bb server moves to a new release.

## The pb mark

Postbeep's mark is the letters pb, built the way bb's mark is: the same letter shapes, two surfaces that pass over and under each other, one gradient from the upper left to the lower right, a bevel, and a shadow where one surface crosses the other. Where bb's mark is black, Postbeep's is terracotta. `fork/mark.mjs` holds the drawing and renders every file from it:

```sh
node fork/mark.mjs
```

| File | What it is |
| --- | --- |
| `fork/mark.svg`, `fork/mark-dark.svg` | The mark as vectors, for a light and a dark field |
| `apps/mobile/assets/fork/icon.png` | The iOS icon, 1024×1024, on an opaque white field |
| `apps/mobile/assets/fork/icon-dark.png` | The iOS icon for the dark appearance: the lighter ramp on a transparent field, which iOS puts on its own dark tile |
| `apps/mobile/assets/fork/splash-logo.png`, `splash-logo-dark.png` | The launch-splash marks, transparent, at the pixel scale of bb's own splash logo |
| `fork/desktop/icon.png`, `fork/desktop/icon.icns` | The desktop icon, on a white rounded square like bb's, ready for the desktop build when the fork gets one. No build uses them yet. |

The script uses the repository's `sharp`, from `apps/app`, and `iconutil` for the `.icns`, which is therefore only written on macOS.

The colors are one hue, 40° in OKLCH, in five steps along the gradient:

| Field | Steps, upper left to lower right |
| --- | --- |
| Light, on white | `#ed835e` `#dd5a27` `#b63e03` `#842b02` `#5e1d01` |
| Dark, on black | `#feb79e` `#ff8d65` `#ed6531` `#cd4805` `#a43701` |

The splash fields are bb's: white in the light appearance, black in the dark, and `#151515` on Android in the dark. The mark shows 97 points wide, which is bb's 88-point mark at the same scale, plus the descender. `with-fork-variant.js` sets the native splash, and the in-app overlay in `LaunchSplash.tsx` follows it.

## Credentials

None of these belong in the repository:

| Credential | Where it lives |
| --- | --- |
| Distribution certificate, provisioning profile, push key | EAS, created by EAS on the first build |
| App Store Connect API key, if used | EAS, uploaded with `eas credentials` |
| Expo sign-in | The Expo CLI's local session |

`apps/mobile/.gitignore` already ignores `*.p8`, `*.p12`, `*.key`, and `*.mobileprovision`. GitHub secret scanning and push protection are on for this fork. A pushed secret stays reachable through the fork network even after deletion, so revoke and replace it rather than rewriting history.

## Known limitations

- iOS only. The fork variant does not change the Android app.
- Links that bb's server, web app, or desktop app produce use `bb://`, and still open the App Store app. Postbeep does not claim `bb://`, because iOS picks arbitrarily between two apps with the same scheme.
