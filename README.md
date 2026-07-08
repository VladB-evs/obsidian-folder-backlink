# Folder Backlinks

An [Obsidian](https://obsidian.md) plugin that lets you **link to folders** and see **which notes reference each folder** — the folder backlinks that core Obsidian doesn't have.

## Features

- **Link to folders** from any note using regular wiki links: `[[Projects/Work/]]`. The trailing slash marks the link as a folder link so it never clashes with a note of the same name.
- **Folder backlinks panel** — a sidebar view listing every note that links to a folder. Click an entry to jump straight to the line containing the link.
- **Insert link to folder** command with a fuzzy folder picker.
- **Right-click a folder** in the file explorer to copy a link to it or open its backlinks.
- **Smart click handling** — clicking a folder link reveals the folder in the file explorer, opens its backlinks panel, or both (configurable). Without this plugin, Obsidian would treat the link as unresolved and create a new note.
- Folder links are styled as resolved links in reading mode instead of looking broken.

## Usage

1. Run **Insert link to folder** (command palette) inside a note, or right-click a folder and choose **Copy folder link**.
2. Click any folder link, use the ribbon icon, or run **Open backlinks for a folder** to open the backlinks panel.
3. Configure click behavior and link format under **Settings → Folder Backlinks**.

Folder links use standard wiki-link syntax, so your notes stay plain Markdown and remain readable without the plugin.

## Installation

### From the community plugin browser (pending review)

Search for "Folder Backlinks" in **Settings → Community plugins → Browse**.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest).
2. Copy them into `<your vault>/.obsidian/plugins/folder-backlinks/`.
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Building from source

```bash
npm install
npm run build   # produces main.js
npm run dev     # watch mode for development
```

## Release provenance

Every release is built **from this repository's source by GitHub Actions** — no binaries are committed to the repo or uploaded by hand. Each release asset carries a [build provenance attestation](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds), which cryptographically ties it to the exact commit and workflow that produced it. You can verify any asset yourself:

```bash
gh attestation verify main.js --repo <owner>/<repo>
```

## License

[MIT](LICENSE)
