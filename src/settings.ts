import { App, PluginSettingTab, Setting } from 'obsidian';
import ContextualRecallPlugin from './main';

export interface RecallSettings {
    trackedFiles: string[];
    reviewStyle: 'classic' | 'granular';
}
export const DEFAULT_SETTINGS: RecallSettings = {
    trackedFiles: [],
    reviewStyle: 'classic',
};

export class RecallSettingTab extends PluginSettingTab {
    plugin: ContextualRecallPlugin;
    constructor(app: App, plugin: ContextualRecallPlugin) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Contextual Recall Settings' });

        new Setting(containerEl)
            .setName('Review Style')
            .setDesc('Choose how answers and context are separated during review.')
            .addDropdown(dropdown => dropdown
                .addOption('classic', 'Classic Mode (Entire block is the answer)')
                .addOption('granular', 'Granular Mode (Top-level lists are the answer, nested lists are context)')
                .setValue(this.plugin.settings.reviewStyle)
                .onChange(async (value: 'classic' | 'granular') => {
                    this.plugin.settings.reviewStyle = value;
                    await this.plugin.saveSettings();
                }));
        
        containerEl.createEl("h3", { text: "Tracked Files" });
        const desc = document.createDocumentFragment();
        desc.append(
            "These are the notes actively tracked for SRS. Use the commands 'Track this note' and 'Untrack this note' to manage this list.",
            desc.createEl("br"),
            "You can manually remove a file by deleting the line and saving."
        );

        new Setting(containerEl)
            .setName("Tracked file paths")
            .setDesc(desc)
            .addTextArea(text => {
                text.setValue(this.plugin.settings.trackedFiles.join("\n"));
                text.inputEl.setAttr("rows", 10);
                text.onChange(async (value) => {
                    this.plugin.settings.trackedFiles = value.split("\n").map(v => v.trim()).filter(v => v.length > 0);
                    await this.plugin.saveSettings();
                });
            });
    }
}