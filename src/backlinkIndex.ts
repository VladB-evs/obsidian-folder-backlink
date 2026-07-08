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
 * Prefix used for folder nodes in the graph view. Folder links are renamed
 * to "<prefix><folder name>" in the unresolved-links table so the graph
 * shows a readable label (a raw "Folder/" id renders with an empty label,
 * because the graph labels unresolved nodes by the text after the last "/").
 */
export const FOLDER_NODE_PREFIX = "\u{1F4C1} ";

export function folderNodeId(folder: TFolder): string {
	return FOLDER_NODE_PREFIX + folder.name;
}

/**
 * Resolves a link path to a folder in the vault, or null if it does not
 * reference a folder. Only links with an explicit trailing slash
 * ([[Templates/]]) are treated as folder links; bare links like
 * [[templates]] keep Obsidian's default behavior (open the note, or
 * create it if it doesn't exist).
 */
export function resolveFolderFromLink(
	app: App,
	rawLink: string,
	sourcePath: string
): TFolder | null {
	// Graph nodes for folder links carry the folder-node prefix instead of
	// the trailing slash; translate them back so clicks on them resolve.
	if (rawLink.startsWith(FOLDER_NODE_PREFIX)) {
		rawLink = rawLink.slice(FOLDER_NODE_PREFIX.length) + "/";
	}

	const { path } = parseLinktext(rawLink);
	if (!path.endsWith("/")) return null;

	const cleaned = normalizePath(path.replace(/\/+$/, "").trim());
	if (!cleaned || cleaned === "/") return null;

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
