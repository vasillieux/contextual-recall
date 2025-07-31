import { FileSystemAdapter, debounce } from 'obsidian';
import * as path from 'path';
import initSqlJs, { Database, SqlValue } from 'sql.js';

export interface SrsCard {
    id: string; notePath: string; question: string;
    due_date?: number; interval?: number; ease?: number;
}

export function generateCardId(notePath: string, heading: string): string {
    const str = `${notePath}|${heading}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash.toString(16);
}

function rowToCard(row: SqlValue[]): SrsCard {
    return {
        id: row[0] as string, notePath: row[1] as string, question: row[2] as string,
        due_date: row[3] as number, interval: row[4] as number, ease: row[5] as number,
    };
}

export class SrsDatabase {
    private db: Database | null = null;
    private adapter: FileSystemAdapter;
    private pluginDir: string;
    private debouncedSave: () => void;
    public isReady: boolean = false;

    constructor(adapter: FileSystemAdapter, pluginDir: string) {
        this.adapter = adapter;
        this.pluginDir = pluginDir;
        this.debouncedSave = debounce(() => this.save(), 2000, true);
    }

    async init() {
        try {
            const wasmPath = path.join(this.pluginDir, 'sql-wasm.wasm');
            const wasmBinary = await this.adapter.readBinary(wasmPath);
            const SQL = await initSqlJs({ wasmBinary });

            const dbPath = path.join(this.pluginDir, 'srs.db');
            const dbData = await this.adapter.readBinary(dbPath).catch(() => null);
            
            this.db = dbData && dbData.byteLength > 0 ? new SQL.Database(dbData) : new SQL.Database();
            
            const tableCheck = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='cards';");
            if (tableCheck.length === 0 || tableCheck[0].values.length === 0) {
                console.log("Contextual Recall: 'cards' table not found. Creating schema.");
                this.createSchema();
            }
            this.isReady = true;
            console.log("Contextual Recall: Database is ready.");

        } catch (e) { 
            console.error("Contextual Recall: Fatal error during database initialization.", e);
            this.isReady = false;
        }
    }

    private createSchema() {
        this.db?.exec(`CREATE TABLE cards (
            id TEXT PRIMARY KEY, note_path TEXT NOT NULL, question TEXT NOT NULL,
            due_date INTEGER, interval REAL, ease REAL
        );`);
        this.save();
    }

    async save() {
        if (!this.isReady || !this.db) return;
        console.log("Contextual Recall: Persisting database to disk...");
        const data = this.db.export();
        const dbPath = path.join(this.pluginDir, 'srs.db');
        await this.adapter.writeBinary(dbPath, data);
        console.log("Contextual Recall: Database persisted.");
    }
    
    async close() { await this.save(); this.db?.close(); }

    async addCard(card: { id: string, notePath: string, question: string }) {
        if (!this.isReady) return;
        const existing = await this.getCard(card.id);
        if (existing) {
            this.db?.run('UPDATE cards SET question = ? WHERE id = ?', [card.question, card.id]);
        } else {
            this.db?.run('INSERT INTO cards (id, note_path, question, due_date, interval, ease) VALUES (?, ?, ?, ?, ?, ?)', [
                card.id, card.notePath, card.question, Date.now(), 1, 2.5
            ]);
        }
        this.debouncedSave();
    }

    async getCard(id: string): Promise<SrsCard | null> {
        if (!this.isReady) return null;
        const res = this.db?.exec("SELECT * FROM cards WHERE id = ?", [id]);
        return res && res.length > 0 && res[0].values.length > 0 ? rowToCard(res[0].values[0]) : null;
    }

    async updateCard(id: string, data: Partial<SrsCard>) {
        if (!this.isReady) return;
        const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        if (fields.length > 0) {
            this.db?.run(`UPDATE cards SET ${fields} WHERE id = ?`, [...values, id]);
            this.debouncedSave();
        }
    }

    async deleteAllCardsInFile(filePath: string) {
        if (!this.isReady) return;
        this.db?.run('DELETE FROM cards WHERE note_path = ?', [filePath]);
        this.debouncedSave();
    }

    async renameFile(oldPath: string, newPath: string) {
        if (!this.isReady) return;
        this.db?.run('UPDATE cards SET note_path = ? WHERE note_path = ?', [newPath, oldPath]);
        this.debouncedSave();
    }

    async getDueCards(): Promise<SrsCard[]> {
        if (!this.isReady) return [];
        const res = this.db?.exec("SELECT * FROM cards WHERE due_date <= ? ORDER BY due_date ASC", [Date.now()]);
        return res && res.length > 0 ? res[0].values.map(rowToCard) : [];
    }

    async getCardsInFile(filePath: string): Promise<SrsCard[]> {
        if (!this.isReady) return [];
        const res = this.db?.exec("SELECT * FROM cards WHERE note_path = ? ORDER BY id", [filePath]);
        return res && res.length > 0 ? res[0].values.map(rowToCard) : [];
    }

    async getNotesWithCards(): Promise<string[]> {
        if (!this.isReady) return [];
        const res = this.db?.exec("SELECT DISTINCT note_path FROM cards ORDER BY note_path ASC");
        return res && res.length > 0 ? res[0].values.flat() as string[] : [];
    }
}