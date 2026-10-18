# postbeep/bb

A personal fork of [get-bb/bb](https://github.com/get-bb/bb). It builds **Postbeep** (`com.postbeep.bb`), an iPhone app that runs beside the App Store bb app against a stock bb server and keeps a page's audio playing while the phone is locked or another app is in front, so that Talkback can be listened to that way.

Nothing here is sent upstream. Do not open pull requests against get-bb/bb from this repository. GitHub Actions are turned off in this fork.

The plans live in the central specs store; each fork change names its plan.

| Fork change | What it does |
| --- | --- |
| `bb-fork-ios-background-audio` | The Postbeep app identity, background audio, and a page marker for Talkback |

## Branches and commits

- `fork/v<version>` is the upstream release tag `desktop-v<version>` plus the fork's commits. The newest one is the default branch.
- `main` follows upstream and is not used.
- The fork has no tags of its own; release tags come from the `upstream` remote.
- Every fork commit ends with a trailer naming its plan, for example `Fork-Change: bb-fork-ios-background-audio`. History stays linear: no merge commits.

## Upstream files edited

| File | Fork change | Edit and reason |
| --- | --- | --- |

`bb-fork-ios-background-audio` keeps its commits cheap to move: at most 3 edited upstream files with at most 40 changed lines among them, new files only under `apps/mobile/` and `fork/`, and no changes to any `package.json`, `pnpm-lock.yaml`, or `packages/`.

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
- `--only <change>` moves just one fork change's commits.
- `--no-checks` skips the install and checks.

Push the new branch, make it the default, and rebuild the app when the bb server is upgraded to that release.

## Building and installing Postbeep

Builds run on EAS under the user's Expo account. From `apps/mobile`:

```sh
BB_MOBILE_VARIANT=fork pnpm exec eas build -p ios --profile fork
pnpm exec eas submit -p ios --profile fork --latest
```

The build goes to TestFlight internal testing. TestFlight builds expire after 90 days, so rebuild at least that often, and whenever the bb server moves to a new release.

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
- Links that use the `postbeep://` scheme skip the app's own link handling in `src/lib/links/incoming-link.ts`, which recognizes only `bb://`, so thread links of that form do not reach the web view. Push notifications are not affected, since they carry the thread ID.
