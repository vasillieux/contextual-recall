import { App, FuzzySuggestModal } from 'obsidian';
import ContextualRecallPlugin from '../main';
export class NoteSuggestModal extends FuzzySuggestModal<string> {
    plugin: ContextualRecallPlugin;
    notesWithCards: string[];
    constructor(app: App, plugin: ContextualRecallPlugin, notes: string[]) { super(app); this.plugin = plugin; this.notesWithCards = notes; }
    getItems(): string[] { return this.notesWithCards; }
    getItemText(item: string): string { return item; }
    async onChooseItem(item: string): Promise<void> {
        const cards = await this.plugin.database.getCardsInFile(item);
        this.plugin.activateReviewView(cards);
    }
}