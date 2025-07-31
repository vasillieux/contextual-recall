import { SrsCard } from "./database";

export type ReviewRating = "Hard" | "Good" | "Easy";

export function calculateNextReview(card: SrsCard, rating: ReviewRating): Partial<SrsCard> {
    let newInterval: number;
    let newEase: number = card.ease ?? 2.5;

    if (rating === "Hard") {
        newInterval = 1;
        newEase = Math.max(1.3, newEase - 0.2);
    } else {  
        const currentInterval = card.interval ?? 1;
        newInterval = currentInterval <= 1 
            ? (rating === "Good" ? 3 : 5)   // first correct review gets a longer interval
            : currentInterval * newEase;
        
        if (rating === "Easy") {
            newEase += 0.15;
        }
    }
    newInterval = Math.round(newInterval * (0.95 + Math.random() * 0.1));
    // ensure interval is at least 1 day
    if (newInterval < 1) newInterval = 1;

    const newDueDate = Date.now() + newInterval * 24 * 60 * 60 * 1000;

    return { interval: newInterval, ease: newEase, due_date: newDueDate };
}