import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, App, setIcon } from 'obsidian';
import ContextualRecallPlugin from '../main';
import { SrsCard } from '../database';
import { calculateNextReview, ReviewRating } from '../srs';
import { parseCardContent } from '../parser';

export const REVIEW_VIEW_TYPE = 'recall-review-view';

export class ReviewView extends ItemView {
    plugin: ContextualRecallPlugin;
    app: App;
    cardsToReview: SrsCard[] = [];
    currentCardIndex: number = -1;
    private isAnswerVisible: boolean = false;
    private boundHandleKeyPress: (event: KeyboardEvent) => void;

    constructor(leaf: WorkspaceLeaf, plugin: ContextualRecallPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.app = plugin.app;
        this.boundHandleKeyPress = this.handleKeyPress.bind(this);
    }

    getViewType() { return REVIEW_VIEW_TYPE; }
    getDisplayText() { return 'Recall'; }
    getIcon() { return 'brain-circuit'; }

    async onOpen() {
        const cardsFromState = this.leaf.getViewState().state?.cards;
        if (cardsFromState) {
            this.cardsToReview = cardsFromState as SrsCard[];
        }
        else this.cardsToReview = await this.plugin.database.getDueCards();
        this.currentCardIndex = 0;
        this.render();
        document.addEventListener('keydown', this.boundHandleKeyPress);
    }

    onClose() {
        document.removeEventListener('keydown', this.boundHandleKeyPress);
    }

    private handleKeyPress(event: KeyboardEvent) {
        if (this.app.workspace.activeLeaf !== this.leaf) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!this.isAnswerVisible) {
                const showAnswerBtn = this.containerEl.querySelector('.recall-initial-controls button') as HTMLElement;
                showAnswerBtn?.click();
            } else {
                const goodBtn = this.containerEl.querySelector('.recall-rating-controls button.rating-good') as HTMLElement;
                goodBtn?.click();
            }
        }
    }

    render() {
        this.isAnswerVisible = false;
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('recall-review-view');

        if (this.cardsToReview.length === 0 || this.currentCardIndex >= this.cardsToReview.length) {
            const header = container.createDiv({ cls: 'recall-review-view-header' });
            header.createDiv({ cls: 'recall-review-view-title', text: "Session Complete!" });
            container.createDiv({ cls: 'recall-review-view-content' }).createEl('p', { text: 'You have finished this review session.' });
            return;
        }

        const card = this.cardsToReview[this.currentCardIndex];
        
        const header = container.createDiv({ cls: 'recall-review-view-header' });
        header.createDiv({ cls: 'recall-review-view-title', text: "Recall" });
        header.createDiv({ cls: 'recall-review-view-progress', text: `Card ${this.currentCardIndex + 1} of ${this.cardsToReview.length}` });
        
        const content = container.createDiv({ cls: 'recall-review-view-content' });
        const cardArea = content.createDiv({ cls: 'recall-card-area' });
        cardArea.createEl('h3', { text: card.question });
        const answerArea = cardArea.createDiv({ cls: 'recall-answer-area' });

        const footer = container.createDiv({ cls: 'recall-review-view-footer' });
        const initialControls = footer.createDiv({ cls: 'recall-initial-controls' });
        const fileLinkArea = footer.createDiv({ cls: 'recall-file-link-area' });
        const fileLink = fileLinkArea.createEl('a', { text: card.notePath, cls: 'internal-link' });
        fileLink.onclick = () => this.app.workspace.openLinkText(card.notePath, card.notePath);

        const showAnswerBtn = initialControls.createEl('button', { text: 'Show Answer', cls: 'mod-cta' });
        showAnswerBtn.onclick = async () => {
            this.isAnswerVisible = true;
            initialControls.empty();
            const ratingControls = footer.createDiv({ cls: 'recall-rating-controls' });
            ratingControls.empty();  
            
            answerArea.addClass('is-visible');
            await this.renderAnswer(answerArea, card, ratingControls);
            this.renderRatingControls(ratingControls, card);
        };
    }

    async renderAnswer(container: HTMLElement, card: SrsCard, controls: HTMLElement) {
        const fullContent = await this.getCardContent(card);
        if (fullContent === null) { container.setText('Error: Card content not found.'); return; }
        
        if (this.plugin.settings.reviewStyle === 'granular') {
            const { answerMd, contextMd } = parseCardContent(fullContent);
            await MarkdownRenderer.render(this.app, answerMd, container, card.notePath, this);
            if (contextMd.trim()) {
                const contextBtnContainer = this.containerEl.querySelector('.recall-initial-controls');
                if (contextBtnContainer) {
                    const showContextBtn = contextBtnContainer.createEl('button', { text: 'Show Context' });
                    showContextBtn.onclick = async () => {
                        const contextContainer = container.createDiv({ cls: 'recall-context-display' });
                        await MarkdownRenderer.render(this.app, contextMd, contextContainer, card.notePath, this);
                        showContextBtn.style.display = 'none';
                    };
                }
            }
        } else {
            await MarkdownRenderer.render(this.app, fullContent, container, card.notePath, this);
        }
    }

    renderRatingControls(container: HTMLElement, card: SrsCard) {
        const rate = (rating: ReviewRating) => {
            this.plugin.database.updateCard(card.id, calculateNextReview(card, rating));
            this.currentCardIndex++;
            this.render();
        };

        const createRatingBtn = (text: "Hard" | "Good" | "Easy", icon: string) => {
            const btn = container.createEl('button');
            if (text === "Good") btn.addClass("rating-good");
            setIcon(btn, icon);
            btn.createDiv({ cls: 'rating-label', text });
            btn.onclick = () => rate(text);
        };
        
        createRatingBtn("Hard", "battery-low");
        createRatingBtn("Good", "battery-medium");
        createRatingBtn("Easy", "battery-full");
    }

    async getCardContent(card: SrsCard): Promise<string | null> {
        const file = this.app.vault.getAbstractFileByPath(card.notePath) as TFile;
        if (!file) return null;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.headings) return null;
        const content = await this.app.vault.cachedRead(file);
        const headingIndex = cache.headings.findIndex(h => h.heading === card.question);
        if (headingIndex === -1) return null;
        
        const heading = cache.headings[headingIndex];
        const nextHeading = cache.headings.slice(headingIndex + 1).find(h => h.level <= heading.level);
        return content.substring(heading.position.end.offset, nextHeading?.position.start.offset).trim();
    }
}