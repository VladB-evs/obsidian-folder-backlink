import { App, PluginSettingTab, Setting } from "obsidian";
import type FolderBacklinksPlugin from "./main";

export type FolderLinkClickAction = "reveal" | "backlinks" | "both";

export interface FolderBacklinksSettings {
	clickAction: FolderLinkClickAction;
	useFolderNameAsAlias: boolean;
	showFolderNodesInGraph: boolean;
}

export const DEFAULT_SETTINGS: FolderBacklinksSettings = {
	clickAction: "both",
	useFolderNameAsAlias: true,
	showFolderNodesInGraph: true,
};

export class FolderBacklinksSettingTab extends PluginSettingTab {
	plugin: FolderBacklinksPlugin;

	constructor(app: App, plugin: FolderBacklinksPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Folder link click action")
			.setDesc("What happens when you click a link that points to a folder.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("reveal", "Reveal folder in file explorer")
					.addOption("backlinks", "Open folder backlinks panel")
					.addOption("both", "Reveal folder and open backlinks panel")
					.setValue(this.plugin.settings.clickAction)
					.onChange(async (value) => {
						this.plugin.settings.clickAction = value as FolderLinkClickAction;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show folder nodes in graph view")
			.setDesc(
				"Display folder links in the graph as labeled \u{1F4C1} nodes instead of blank unresolved dots. Reload Obsidian after turning this off."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFolderNodesInGraph)
					.onChange(async (value) => {
						this.plugin.settings.showFolderNodesInGraph = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Use folder name as link text")
			.setDesc(
				"Inserted links display only the folder name (e.g. [[Projects/Work/|Work]]) instead of the full path."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useFolderNameAsAlias)
					.onChange(async (value) => {
						this.plugin.settings.useFolderNameAsAlias = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
