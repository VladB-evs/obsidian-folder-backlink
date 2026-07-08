import {
	ItemView,
	TFile,
	TFolder,
	WorkspaceLeaf,
	setIcon,
} from "obsidian";
import { FolderLinkMatch, findFolderBacklinks } from "./backlinkIndex";
import { FolderSuggestModal } from "./folderSuggest";

export const VIEW_TYPE_FOLDER_BACKLINKS = "folder-backlinks-view";

export class FolderBacklinksView extends ItemView {
	private folderPath: string | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_FOLDER_BACKLINKS;
	}

	getDisplayText(): string {
		return this.folderPath
			? `Backlinks: ${this.folderPath}`
			: "Folder backlinks";
	}

	getIcon(): string {
		return "folder-symlink";
	}

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.app.metadataCache.on("resolved", () => this.render())
		);
		this.render();
	}

	setFolder(folder: TFolder): void {
		this.folderPath = folder.path;
		this.render();
	}

	getState(): Record<string, unknown> {
		return { folderPath: this.folderPath };
	}

	async setState(
		state: { folderPath?: string | null },
		result: never
	): Promise<void> {
		if (state && typeof state.folderPath === "string") {
			this.folderPath = state.folderPath;
			this.render();
		}
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("folder-backlinks-view");

		const header = container.createDiv({ cls: "folder-backlinks-header" });
		const title = header.createDiv({ cls: "folder-backlinks-title" });
		const iconEl = title.createSpan({ cls: "folder-backlinks-title-icon" });
		setIcon(iconEl, "folder");
		title.createSpan({
			text: this.folderPath ?? "No folder selected",
		});

		const pickBtn = header.createEl("button", {
			text: "Choose folder",
			cls: "folder-backlinks-pick",
		});
		pickBtn.addEventListener("click", () => {
			new FolderSuggestModal(this.app, (folder) => this.setFolder(folder)).open();
		});

		if (!this.folderPath) {
			container.createDiv({
				cls: "folder-backlinks-empty",
				text: "Pick a folder to see the notes that link to it.",
			});
			return;
		}

		const folder = this.app.vault.getFolderByPath(this.folderPath);
		if (!folder) {
			container.createDiv({
				cls: "folder-backlinks-empty",
				text: `Folder "${this.folderPath}" no longer exists.`,
			});
			return;
		}

		const matches = findFolderBacklinks(this.app, folder);
		const countEl = container.createDiv({ cls: "folder-backlinks-count" });
		countEl.setText(
			matches.length === 1 ? "1 linked note" : `${matches.length} linked notes`
		);

		if (matches.length === 0) {
			container.createDiv({
				cls: "folder-backlinks-empty",
				text: "No notes link to this folder yet. Add a link like [[" +
					folder.path +
					"/]] to any note.",
			});
			return;
		}

		const grouped = new Map<string, FolderLinkMatch[]>();
		for (const match of matches) {
			const list = grouped.get(match.sourceFile.path) ?? [];
			list.push(match);
			grouped.set(match.sourceFile.path, list);
		}

		const listEl = container.createDiv({ cls: "folder-backlinks-list" });
		for (const [path, fileMatches] of grouped) {
			const file = fileMatches[0].sourceFile;
			const itemEl = listEl.createDiv({ cls: "folder-backlinks-item" });

			const fileEl = itemEl.createDiv({ cls: "folder-backlinks-file" });
			const fileIcon = fileEl.createSpan();
			setIcon(fileIcon, "file-text");
			fileEl.createSpan({ text: file.basename });
			fileEl.createSpan({
				cls: "folder-backlinks-file-path",
				text: file.parent && !file.parent.isRoot() ? file.parent.path : "",
			});

			fileEl.addEventListener("click", () => {
				void this.openMatch(file, fileMatches[0]);
			});

			if (fileMatches.length > 1) {
				fileEl.createSpan({
					cls: "folder-backlinks-match-count",
					text: String(fileMatches.length),
				});
			}
		}
	}

	private async openMatch(file: TFile, match: FolderLinkMatch): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, {
			eState: { line: match.line },
		});
	}
}
