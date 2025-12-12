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

## Known Issues

### Yarn 3.0.x Compatibility

Yarn 3.0.x has a [known bug](https://github.com/yarnpkg/berry/pull/3610) that causes `ERR_STREAM_PREMATURE_CLOSE` errors with Node 20+. This was fixed in yarn 3.1.0.

**Solution:** Upgrade yarn by running:

```bash
yarn set version 3.8.7
```

This updates both `.yarnrc.yml` and the bundled yarn binary in `.yarn/releases/`.

> **Note:** `volta pin yarn@3` only affects local development - CI uses the bundled binary from `yarnPath`. You must use `yarn set version` to fix this.
