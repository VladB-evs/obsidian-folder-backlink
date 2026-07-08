import { App, FuzzySuggestModal, TFolder } from "obsidian";

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Choose a folder…");
	}

	getItems(): TFolder[] {
		const folders: TFolder[] = [];
		const collect = (folder: TFolder) => {
			if (!folder.isRoot()) folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) collect(child);
			}
		};
		collect(this.app.vault.getRoot());
		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	getItemText(folder: TFolder): string {
		return folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}
