import {
	Editor,
	Menu,
	Notice,
	Plugin,
	TAbstractFile,
	TFolder,
	WorkspaceLeaf,
} from "obsidian";
import {
	FOLDER_NODE_PREFIX,
	folderNodeId,
	resolveFolderFromLink,
} from "./backlinkIndex";
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
			id: "show-backlinks-for-folder",
			name: "Open backlinks for a folder",
			callback: () => this.chooseFolderAndShowBacklinks(),
		});

		this.addCommand({
			id: "show-backlinks-for-current-folder",
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

		// Intercept every internal link open. Obsidian routes all of them
		// (reading mode, live preview, Cmd+click) through
		// workspace.openLinkText, and for a link pointing at a folder it
		// would otherwise create a new note named after the folder.
		this.patchOpenLinkText();

		// Rename folder links in the unresolved-links table so the graph view
		// shows them as labeled folder nodes instead of blank dots.
		this.registerEvent(
			this.app.metadataCache.on("resolve", (file) => {
				if (!this.settings.showFolderNodesInGraph) return;
				this.decorateUnresolvedFolderLinks(file.path);
			})
		);
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.showFolderNodesInGraph) {
				this.decorateUnresolvedFolderLinks();
			}
		});

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
		// The trailing slash is what marks the link as a folder link.
		const path = `${folder.path}/`;
		if (this.settings.useFolderNameAsAlias && folder.path !== folder.name) {
			return `[[${path}|${folder.name}]]`;
		}
		return `[[${path}]]`;
	}

	/**
	 * Rewrites folder links in metadataCache.unresolvedLinks (public API)
	 * from "Folder/" to "📁 Folder". The graph view builds its nodes from
	 * this table, so folder links get a readable, folder-marked label.
	 */
	private decorateUnresolvedFolderLinks(sourcePath?: string): void {
		const all = this.app.metadataCache.unresolvedLinks;
		const paths = sourcePath ? [sourcePath] : Object.keys(all);

		for (const path of paths) {
			const links = all[path];
			if (!links) continue;
			for (const linktext of Object.keys(links)) {
				if (
					linktext.startsWith(FOLDER_NODE_PREFIX) ||
					!linktext.endsWith("/")
				) {
					continue;
				}
				const folder = resolveFolderFromLink(this.app, linktext, path);
				if (!folder) continue;
				const id = folderNodeId(folder);
				links[id] = (links[id] ?? 0) + links[linktext];
				delete links[linktext];
			}
		}
	}

	private patchOpenLinkText(): void {
		const workspace = this.app.workspace;
		const original = workspace.openLinkText;

		const patched: typeof workspace.openLinkText = (
			linktext,
			sourcePath,
			newLeaf,
			openViewState
		) => {
			const folder = resolveFolderFromLink(this.app, linktext, sourcePath);
			if (folder) {
				return this.handleFolderLinkClick(folder);
			}
			return original.call(
				workspace,
				linktext,
				sourcePath,
				newLeaf,
				openViewState
			);
		};
		workspace.openLinkText = patched;

		this.register(() => {
			workspace.openLinkText = original;
		});
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
		const data = (await this.loadData()) as
			| Partial<FolderBacklinksSettings>
			| null;
		this.settings = { ...DEFAULT_SETTINGS, ...data };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
