# Publishing to the Obsidian community plugin list

A checklist for getting this plugin accepted, and how each requirement is already covered.

## How releases prove they come from this repo

The Obsidian review team requires that release binaries are traceable to the repository source. This repo handles that in three ways:

1. **`main.js` is gitignored** — no built or minified code is ever committed. The only code in the repo is readable TypeScript in `src/`.
2. **Releases are built by GitHub Actions** (`.github/workflows/release.yml`), never uploaded by hand. The workflow checks out the tagged commit, runs `npm ci && npm run build`, and attaches the freshly built `main.js`, `manifest.json`, and `styles.css` to the release.
3. **Build provenance attestations** — the workflow signs each release asset with GitHub's `attest-build-provenance` action. Anyone (including reviewers) can run `gh attestation verify main.js --repo <owner>/<repo>` to cryptographically confirm the file was built from this repo's source at that exact commit.

The generated `main.js` also starts with a banner comment pointing readers to this repository for the source.

## Cutting a release

1. Bump the version: `npm version patch` (or `minor`/`major`). This updates `package.json`, and the `version` script syncs `manifest.json` and `versions.json` automatically.
2. Push the commit and tag: `git push && git push --tags`.
   - The tag must be the bare version number (e.g. `1.0.1`, **no `v` prefix**) — the workflow enforces that the tag matches `manifest.json`.
3. GitHub Actions builds the plugin and publishes the release with `main.js`, `manifest.json`, and `styles.css` attached as individual assets (required by Obsidian — not just a zip).

## Submitting the plugin

1. Make the repo public on GitHub and publish at least one release (see above).
2. Fork [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases).
3. Add an entry to the **end** of `community-plugins.json`:

```json
{
	"id": "folder-backlinks",
	"name": "Folder Backlinks",
	"author": "Vlad Bacila",
	"description": "Link to folders from your notes and see which notes reference each folder, just like backlinks for files.",
	"repo": "<owner>/<repo>"
}
```

The `id`, `name`, `author`, and `description` must match `manifest.json` exactly.

4. Open a pull request using their "Add plugin" template and complete its checklist. An automated bot validates the submission; fix anything it flags and comment on the PR to re-trigger it.

## Reviewer requirements already satisfied

- `manifest.json` at the repository root, with `id` that doesn't contain "obsidian" and description ending in a period.
- `README.md` and `LICENSE` present.
- Release assets attached individually (`main.js`, `manifest.json`, `styles.css`).
- Release tag equals `manifest.json` version, no `v` prefix.
- `versions.json` maps plugin versions to minimum app versions.
- No `console.log` noise, no committed build output, TypeScript source included.
- Uses `this.registerEvent` / `registerDomEvent` / `registerView` so everything is cleaned up on unload.
