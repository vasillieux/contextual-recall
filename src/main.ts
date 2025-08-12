import { Plugin, TFile, addIcon, WorkspaceLeaf, Editor, FileSystemAdapter, Notice, Menu } from 'obsidian';
import { SrsDatabase, SrsCard, generateCardId } from './database';
import { ReviewView, REVIEW_VIEW_TYPE } from './ui/ReviewView';
import { RecallSettings, DEFAULT_SETTINGS, RecallSettingTab } from './settings';
import { NoteSuggestModal } from './ui/NoteSuggestModal';

export default class ContextualRecallPlugin extends Plugin {
    database!: SrsDatabase;
    settings!: RecallSettings;
    public api: any;

    async onload() {
        console.log('Loading Contextual Recall plugin V2.1 (Diagnostic)');
        await this.loadSettings();

        if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
            new Notice("Contextual Recall requires a file system adapter and is not compatible with this vault.", 0);
            return;
        }
        
        this.database = new SrsDatabase(this.app.vault.adapter, this.manifest.dir || '.');
        await this.database.init();

        this.addSettingTab(new RecallSettingTab(this.app, this));
        this.registerView(REVIEW_VIEW_TYPE, (leaf) => new ReviewView(leaf, this));

        addIcon('brain-circuit', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-brain-circuit"><path d="M12 5a3 3 0 1 0-5.997.142"/><path d="M12 5a3 3 0 1 1 5.997.142"/><path d="M15 13a3 3 0 1 0-5.997.142"/><path d="M15 13a3 3 0 1 1 5.997.142"/><path d="M9 13a3 3 0 1 0-5.997.142"/><path d="M9 13a3 3 0 1 1 5.997.142"/><path d="M6 5a3 3 0 1 0-5.997.142"/><path d="M6 5a3 3 0 1 1 5.997.142"/><path d="m12 16.5 1-1"/><path d="m6.5 8.5-1-1"/><path d="m21.5 8.5-1-1"/><path d="M12 5.5V4"/><path d="M12 19v1.5"/><path d="m18.5 12.5 1.5 1"/><path d="m3.5 12.5 1.5 1"/><path d="M12 13h-1.5"/><path d="M17 13h1.5"/><path d="M9 13H7.5"/><path d="M9 5H7.5"/><path d="M17 5h-1.5"/></svg>`);
        this.addRibbonIcon('brain-circuit', 'Recall', () => this.openJourneyMenu());

        this.addCommands();
        this.registerEvents();

        this.api = {
            getDueCards: () => this.database.getDueCards(),
            getAllCards: () => [], // this.database.getAllCards(),
            getTrackedNotes: () => this.settings.trackedFiles,
        };
    }

    async onunload() {
        await this.database?.close();
    }

    openJourneyMenu() {
        const menu = new Menu();
        menu.addItem((item) => item
            .setTitle("Review all due cards")
            .setIcon("brain-circuit")
            .onClick(() => this.activateReviewView())
        );
        menu.addItem((item) => item
            .setTitle("Review from a specific note...")
            .setIcon("file-search")
            .onClick(async () => {
                const notes = await this.database.getNotesWithCards();
                if (notes.length === 0) { new Notice("No notes are being tracked."); return; }
                new NoteSuggestModal(this.app, this, notes).open();
            })
        );
        menu.showAtMouseEvent(new MouseEvent("click"));
    }

    addCommands() {
        this.addCommand({ id: 'review-all-due', name: 'Recall: Review all due cards', callback: () => this.activateReviewView() });
        this.addCommand({
            id: 'review-from-note', name: 'Recall: Start from a specific tracked note...',
            callback: async () => {
                const notes = await this.database.getNotesWithCards();
                if (notes.length === 0) { new Notice("No notes are being tracked."); return; }
                new NoteSuggestModal(this.app, this, notes).open();
            }
        });
        this.addCommand({ id: 'track-note', name: 'Track this note for SRS', checkCallback: (checking) => this.trackFile(checking, this.app.workspace.getActiveFile()) });
        this.addCommand({ id: 'untrack-note', name: 'Untrack this note for SRS', checkCallback: (checking) => this.untrackFile(checking, this.app.workspace.getActiveFile()) });
        this.addCommand({ id: 'reindex-all', name: 'Re-index all tracked notes', callback: () => this.indexAllTrackedFiles() });
    }

    registerEvents() {
        this.app.workspace.onLayoutReady(() => this.indexAllTrackedFiles());
        this.registerEvent(this.app.vault.on('modify', (file) => {
            if (file instanceof TFile && this.settings.trackedFiles.includes(file.path)) {
                console.log(`Tracked file modified: ${file.path}. Re-indexing.`);
                this.indexFile(file);
            }
        }));
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (file instanceof TFile && this.settings.trackedFiles.includes(oldPath)) {
                this.settings.trackedFiles = this.settings.trackedFiles.filter(p => p !== oldPath);
                this.settings.trackedFiles.push(file.path);
                this.saveSettings();
                this.database.renameFile(oldPath, file.path);
            }
        }));
    }

    async activateReviewView(cards?: SrsCard[]) {
        console.log(`[activateReviewView] called. Provided cards count: ${cards?.length ?? '"undefined" (will fetch due cards)'}`);
        this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
        
        // const leaf = this.app.workspace.getLeaf(true);

        let leaf: WorkspaceLeaf | undefined = this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE)[0];
        if (!leaf) {
            leaf = this.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: 'empty' }); // Clear the leaf before setting the view
        }

        // Create the ReviewView instance directly and pass the cards to its constructor
        const reviewView = new ReviewView(leaf, this, cards);
        leaf.open(reviewView);

        this.app.workspace.revealLeaf(leaf);
        
        // console.log(`Setting view state with ${cards?.length} total cards.`)
        // await leaf.setViewState({
        //     type: REVIEW_VIEW_TYPE,
        //     active: true,
        //     state: { cards: cards }
        // });
        // this.app.workspace.revealLeaf(leaf);
    }

    trackFile(checking: boolean, file: TFile | null): boolean {
        if (file) {
            if (checking) return !this.settings.trackedFiles.includes(file.path);
            if (!this.settings.trackedFiles.includes(file.path)) {
                this.settings.trackedFiles.push(file.path);
                this.saveSettings();
                this.indexFile(file);
                new Notice(`Started tracking "${file.name}" for SRS.`);
            }
        }
        return false;
    }

    untrackFile(checking: boolean, file: TFile | null): boolean {
        if (file) {
            if (checking) return this.settings.trackedFiles.includes(file.path);
            if (this.settings.trackedFiles.includes(file.path)) {
                this.settings.trackedFiles = this.settings.trackedFiles.filter(p => p !== file.path);
                this.saveSettings();
                this.database.deleteAllCardsInFile(file.path);
                new Notice(`Stopped tracking "${file.name}" for SRS.`);
            }
        }
        return false;
    }

    async indexAllTrackedFiles() {
        console.log(`[indexAllTrackedFiles] Re-indexing all ${this.settings.trackedFiles.length} tracked notes...`);
        for (const path of this.settings.trackedFiles) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                await this.indexFile(file);
            }
        }
        console.log("[indexAllTrackedFiles] Re-indexing complete.");
    }

    async indexFile(file: TFile) {
        const fileCache = this.app.metadataCache.getFileCache(file);
        if (!fileCache) return;
        
        const existingCardIds = new Set((await this.database.getCardsInFile(file.path)).map(c => c.id));
        const currentHeadingIds = new Set<string>();

        for (const heading of fileCache.headings || []) {
            const cardId = generateCardId(file.path, heading.heading);
            currentHeadingIds.add(cardId);
            const card = {
                id: cardId,
                notePath: file.path,
                question: heading.heading,
            };
            await this.database.addCard(card);
        }
        
        for (const oldId of existingCardIds) {
            if (!currentHeadingIds.has(oldId)) {
                // await this.database.deleteCard(oldId);
            }
        }
    }

    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() { await this.saveData(this.settings); }
}