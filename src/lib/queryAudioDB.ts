import Database = require('better-sqlite3');
import * as path from 'node:path';
import { katakanaToHiragana } from './utils';
import type { AudioSource } from './queryUtils';
import { log } from './logger';

export interface AudioEntry {
    expression: string;
    reading: string;
    source: string;
    file: string;
    display: string;
}

// Verbindung zur lokalen SQLite-Datei herstellen
const dbPath = path.resolve('/app/data/audio.sqlite');
const db = new Database(dbPath, { fileMustExist: false });

export async function queryAudioDB(term: string, reading: string, sources: AudioSource[], env: any): Promise<AudioEntry[]> {
    let baseCondition = 'WHERE expression = ?';
    const params: any[] = [term];

    if (reading && reading.trim() !== '') {
        baseCondition = `WHERE (expression = ? OR reading = ?)`;
        const convertedReading = katakanaToHiragana(reading);
        params.push(convertedReading);
    }

    if (sources.length > 0 && !sources.includes('all')) {
        const placeholders = sources.map(() => '?').join(', ');
        baseCondition += ` AND source IN (${placeholders})`;
        params.push(...sources);
    }

    const query = `SELECT expression, reading, source, file, display FROM entries ${baseCondition}`;

    try {
        // better-sqlite3 führt Queries synchron und extrem schnell aus
        const stmt = db.prepare(query);
        const results = stmt.all(...params) as AudioEntry[];
        return results;
    } catch (e: any) {
        log('error', 'query_pitch_db_failed', `Database query failed for term: ${term}, reading: ${reading}`, { 
            term, 
            reading, 
            error: e.message 
        });
        throw new Error('Database query failed: ' + e.message);
    }
}

// Die Funktionen generateDisplayNames und sortResults bleiben exakt gleich wie vorher:
export async function generateDisplayNames(entries: AudioEntry[], term: string, reading: string): Promise<string[]> {
    let names: string[] = [];
    entries.forEach((entry) => {
        let name = `${entry.source}`;
        if (entry.display) {
            name += `: ${entry.display}`;
        }
        if (term == entry.expression && reading == entry.reading) {
            name += ` (Expression+Reading)`;
        } else if (term == entry.expression) {
            name += ` (Only Expression)`;
        } else if (reading == entry.reading) {
            name += ` (Only Reading)`;
        }
        names.push(name);
    });
    return names;
}

export async function sortResults(entries: AudioEntry[], names: string[]): Promise<AudioEntry[]> {
    const sourcePriority: { [key: string]: number } = {
        nhk16: 0, daijisen: 1, shinmeikai8: 2, jpod: 3, taas: 4, ozk5: 5, forvo: 6, forvo_ext: 7, forvo_ext2: 8, tts: 9
    };

    const getMatchTypePriority = (name?: string): number => {
        if (!name) return 3;
        if (name.includes('(Expression+Reading)')) return 0;
        if (name.includes('(Only Expression)')) return 1;
        if (name.includes('(Only Reading)')) return 2;
        return 3;
    };

    const result = entries.map((entry, index) => {
        const copy = { ...entry };
        if (index < names.length) {
            copy.display = names[index];
        } else {
            copy.display = undefined as unknown as string;
        }
        return copy;
    });

    result.sort((a, b) => {
        const aMatchPriority = getMatchTypePriority(a.display);
        const bMatchPriority = getMatchTypePriority(b.display);
        if (aMatchPriority !== bMatchPriority) return aMatchPriority - bMatchPriority;
        const aPriority = sourcePriority[a.source] ?? Number.MAX_SAFE_INTEGER;
        const bPriority = sourcePriority[b.source] ?? Number.MAX_SAFE_INTEGER;
        return aPriority - bPriority;
    });

    return result;
}