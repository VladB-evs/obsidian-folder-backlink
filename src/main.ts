import {
	Editor,
	MarkdownView,
	Menu,
	Notice,
	Plugin,
	TAbstractFile,
	TFolder,
	WorkspaceLeaf,
} from "obsidian";
import { resolveFolderFromLink } from "./backlinkIndex";
import { FolderBacklinksView, VIEW_TYPE_FOLDER_BACKLINKS } from "./backlinksView";
import { FolderSuggestModal } from "./folderSuggest";
import {
	DEFAULT_SETTINGS,
	FolderBacklinksSettingTab,
	FolderBacklinksSettings,
} from "./settings";

export default class FolderBacklinksPlugin extends Plugin {
	settings: FolderBacklinksSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new FolderBacklinksSettingTab(this.app, this));

		this.registerView(
			VIEW_TYPE_FOLDER_BACKLINKS,
			(leaf) => new FolderBacklinksView(leaf)
		);

		this.addRibbonIcon("folder-symlink", "Open folder backlinks", () => {
			this.chooseFolderAndShowBacklinks();
		});

		this.addCommand({
			id: "insert-folder-link",
			name: "Insert link to folder",
			editorCallback: (editor: Editor) => {
				new FolderSuggestModal(this.app, (folder) => {
					editor.replaceSelection(this.buildFolderLink(folder));
				}).open();
			},
		});

		this.addCommand({
			id: "open-folder-backlinks",
			name: "Open backlinks for a folder",
			callback: () => this.chooseFolderAndShowBacklinks(),
		});

		this.addCommand({
			id: "open-current-folder-backlinks",
			name: "Open backlinks for current note's folder",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const parent = file?.parent;
				if (!parent || parent.isRoot()) return false;
				if (!checking) void this.showBacklinksFor(parent);
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				if (!(file instanceof TFolder)) return;
				menu.addItem((item) =>
					item
						.setTitle("Show folder backlinks")
						.setIcon("folder-symlink")
						.onClick(() => void this.showBacklinksFor(file))
				);
				menu.addItem((item) =>
					item
						.setTitle("Copy folder link")
						.setIcon("link")
						.onClick(async () => {
							await navigator.clipboard.writeText(this.buildFolderLink(file));
							new Notice("Folder link copied to clipboard");
						})
				);
			})
		);

		// Intercept clicks on internal links that point to folders. Obsidian
		// treats these as unresolved links, so without this they would create
		// a new note named after the folder.
		this.registerDomEvent(
			document,
			"click",
			(evt: MouseEvent) => {
				const target = evt.target as HTMLElement;
				const linkEl = target.closest("a.internal-link, .cm-underline");
				if (!linkEl) return;

				const href =
					linkEl.getAttribute("data-href") ??
					this.linkTextFromLivePreview(linkEl as HTMLElement);
				if (!href) return;

				const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
				const folder = resolveFolderFromLink(this.app, href, sourcePath);
				if (!folder) return;

				evt.preventDefault();
				evt.stopPropagation();
				void this.handleFolderLinkClick(folder);
			},
			{ capture: true }
		);

		// In reading mode, mark folder links as resolved so they are not
		// styled like broken links.
		this.registerMarkdownPostProcessor((el, ctx) => {
			const links = el.querySelectorAll<HTMLAnchorElement>("a.internal-link");
			links.forEach((link) => {
				const href = link.getAttribute("data-href");
				if (!href) return;
				const folder = resolveFolderFromLink(this.app, href, ctx.sourcePath);
				if (folder) {
					link.removeClass("is-unresolved");
					link.addClass("folder-backlinks-link");
					link.setAttribute("aria-label", `Folder: ${folder.path}`);
				}
			});
		});
	}

	onunload(): void {
		// Obsidian detaches registered views and DOM events automatically.
	}

	buildFolderLink(folder: TFolder): string {
		const path = this.settings.trailingSlash ? `${folder.path}/` : folder.path;
		if (this.settings.useFolderNameAsAlias && folder.path !== folder.name) {
			return `[[${path}|${folder.name}]]`;
		}
		return `[[${path}]]`;
	}

	private linkTextFromLivePreview(el: HTMLElement): string | null {
		// In live preview the clicked span holds the rendered link text; for
		// [[path|alias]] links the underlying href is not in the DOM, so we
		// fall back to the visible text, which works for plain folder links.
		const text = el.textContent?.trim();
		return text && text.length > 0 ? text : null;
	}

	private chooseFolderAndShowBacklinks(): void {
		new FolderSuggestModal(this.app, (folder) => {
			void this.showBacklinksFor(folder);
		}).open();
	}

	private async handleFolderLinkClick(folder: TFolder): Promise<void> {
		const action = this.settings.clickAction;
		if (action === "reveal" || action === "both") {
			this.revealInFileExplorer(folder);
		}
		if (action === "backlinks" || action === "both") {
			await this.showBacklinksFor(folder);
		}
	}

	private revealInFileExplorer(folder: TFolder): void {
		const leaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
		if (!leaf) return;
		const view = leaf.view as unknown as {
			revealInFolder?: (file: TAbstractFile) => void;
		};
		view.revealInFolder?.(folder);
	}

	async showBacklinksFor(folder: TFolder): Promise<void> {
		const leaf = await this.getBacklinksLeaf();
		if (!leaf) return;
		const view = leaf.view;
		if (view instanceof FolderBacklinksView) {
			view.setFolder(folder);
		}
		await this.app.workspace.revealLeaf(leaf);
	}

	private async getBacklinksLeaf(): Promise<WorkspaceLeaf | null> {
		const existing = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_FOLDER_BACKLINKS
		);
		if (existing.length > 0) return existing[0];

		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return null;
		await leaf.setViewState({ type: VIEW_TYPE_FOLDER_BACKLINKS, active: true });
		return leaf;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
