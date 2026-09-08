# NPM OIDC Release

GitHub Action for publishing to NPM using OIDC authentication with release-it.

## Requirements

### 1. Install release-it

```bash
npm install --save-dev release-it @release-it/conventional-changelog
```

### 2. Configure release-it

Create or update `.release-it.json` with `skipChecks` enabled (required for OIDC since there's no token to validate before publishing):

```json
{
  "npm": {
    "skipChecks": true
  },
  "git": {
    "commitMessage": "chore: release v${version}"
  },
  "github": {
    "release": true
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "infile": "CHANGELOG.md",
      "preset": "conventionalcommits"
    }
  }
}
```

### 3. Configure NPM Trusted Publishing

On npmjs.com:
1. Go to your package → Settings → "Configure Trusted Publishing"
2. Set:
   - **Repository**: `your-org/your-repo`
   - **Workflow**: `.github/workflows/release.yml` (or your workflow path)
   - **Environment**: leave blank

## Usage

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      release_type:
        description: 'Release type'
        required: true
        type: choice
        default: 'release'
        options:
          - release
          - prerelease
      increment:
        description: 'Version increment (optional)'
        required: false
        default: ''
      dist_tag:
        description: 'Pre-release dist tag'
        required: false
        default: 'alpha'

permissions:
  contents: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: nicksteffens/npm-oidc-release@v1
        with:
          release_type: ${{ inputs.release_type }}
          increment: ${{ inputs.increment }}
          dist_tag: ${{ inputs.dist_tag }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `release_type` | `release` or `prerelease` | `release` |
| `increment` | Version bump: `major`, `minor`, `patch`, or blank for auto | `''` |
| `dist_tag` | NPM dist tag for prereleases | `alpha` |
| `workspace` | NPM workspace name for monorepo releases | `''` |

### Monorepo / Workspace Usage

For releasing a package from an npm workspace:

```yaml
- uses: nicksteffens/npm-oidc-release@v1
  with:
    release_type: ${{ inputs.release_type }}
    workspace: eslint-plugin-ui
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The action uses `npx --workspace=<name>` to run release-it in the workspace context. This requires:

1. The workspace is defined in root `package.json`:
   ```json
   {
     "workspaces": ["eslint-plugin-ui", "mcp-server"]
   }
   ```

2. The workspace has its own `.release-it.json` configuration

3. NPM Trusted Publishing is configured for the workspace package on npmjs.com

## How it works

- Uses Node LTS with the latest npm version for OIDC support
- Configures git with the GitHub actor
- Detects package manager (yarn or npm) from lock file
- Installs dependencies at root (`yarn install --immutable` or `npm ci`)
- Runs release-it with appropriate flags
  - For workspaces: `npx --workspace=<name> release-it ...`
  - For root packages: `npx release-it ...`

## Releasing this action

Releases of *this* repo are handled by `.github/workflows/release.yml`, triggered on push to `main` when `action.yml` changes, or manually via `workflow_dispatch`.

1. `release-it` bumps the version (from conventional commits, or the `increment` input on manual runs), updates `CHANGELOG.md`, creates a `vX.Y.Z` tag, and publishes a GitHub release. If there are no releasable commits, it does nothing.
2. A follow-up step moves the floating major tag (`v1`) to point at the newest `vX.Y.Z` release, so consumers pinning `@v1` automatically pick up new minor/patch versions without repinning.

### If the major tag (`v1`) goes missing

If `nicksteffens/npm-oidc-release@v1` fails to resolve for a consumer, the major tag is missing from origin. Recreate it manually by pointing it at the latest release tag and pushing:

```bash
git fetch --tags
git tag -f v1 v1.3.0   # use the actual latest vX.Y.Z tag
git push origin v1
```

This has happened before: a `workflow_dispatch` run with no new commits to release could cause the tag-update step to treat the floating `v1` tag as its own "latest release" (`git describe --tags --abbrev=0` wasn't scoped to semver tags), delete it, then fail to recreate it — leaving `v1` missing on origin entirely. Fixed by scoping the match pattern to `v[0-9]*.[0-9]*.[0-9]*`, but the underlying delete-then-recreate mechanism still has a window where the tag doesn't exist on origin if any step fails, so keep an eye on the "Update major version tag" job in future changes to this workflow.

## Known Issues

### Yarn 3.0.x Compatibility

Yarn 3.0.x has a [known bug](https://github.com/yarnpkg/berry/pull/3610) that causes `ERR_STREAM_PREMATURE_CLOSE` errors with Node 20+. This was fixed in yarn 3.1.0.

**Solution:** Upgrade yarn by running:

```bash
yarn set version 3.8.7
```

This updates both `.yarnrc.yml` and the bundled yarn binary in `.yarn/releases/`.

> **Note:** `volta pin yarn@3` only affects local development - CI uses the bundled binary from `yarnPath`. You must use `yarn set version` to fix this.
