import {
	App,
	LinkCache,
	Reference,
	TFile,
	TFolder,
	parseLinktext,
	normalizePath,
} from "obsidian";

export interface FolderLinkMatch {
	sourceFile: TFile;
	reference: Reference;
	line: number;
}

/**
 * Resolves a link path to a folder in the vault, or null if it does not
 * reference a folder. Links that resolve to an existing file are never
 * treated as folder links unless they carry an explicit trailing slash.
 */
export function resolveFolderFromLink(
	app: App,
	rawLink: string,
	sourcePath: string
): TFolder | null {
	const { path } = parseLinktext(rawLink);
	const explicitFolder = path.endsWith("/");
	const cleaned = normalizePath(path.replace(/\/+$/, "").trim());
	if (!cleaned || cleaned === "/") return null;

	if (!explicitFolder) {
		// A note with this exact link path wins over a folder of the same name.
		const dest = app.metadataCache.getFirstLinkpathDest(cleaned, sourcePath);
		if (dest) return null;
	}

	const byPath = app.vault.getFolderByPath(cleaned);
	if (byPath) return byPath;

	// Name-only links ([[Work/]]) match a folder anywhere in the vault,
	// preferring the shallowest path when several folders share the name.
	if (!cleaned.includes("/")) {
		const candidates: TFolder[] = [];
		const walk = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					if (child.name.toLowerCase() === cleaned.toLowerCase()) {
						candidates.push(child);
					}
					walk(child);
				}
			}
		};
		walk(app.vault.getRoot());
		if (candidates.length > 0) {
			candidates.sort(
				(a, b) => a.path.split("/").length - b.path.split("/").length
			);
			return candidates[0];
		}
	}

	return null;
}

/** Collects every reference in the vault that links to the given folder. */
export function findFolderBacklinks(app: App, folder: TFolder): FolderLinkMatch[] {
	const matches: FolderLinkMatch[] = [];

	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache) continue;

		const refs: Reference[] = [
			...(cache.links ?? []),
			...(cache.embeds ?? []),
			...(cache.frontmatterLinks ?? []),
		];

		for (const ref of refs) {
			const target = resolveFolderFromLink(app, ref.link, file.path);
			if (target && target.path === folder.path) {
				const line = (ref as LinkCache).position?.start?.line ?? 0;
				matches.push({ sourceFile: file, reference: ref, line });
			}
		}
	}

	matches.sort((a, b) => a.sourceFile.path.localeCompare(b.sourceFile.path));
	return matches;
}
