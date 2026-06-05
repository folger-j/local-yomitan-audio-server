// @ts-ignore
type D1Result = any;
// @ts-ignore
type Env = any;

import { IRequest, StatusError } from 'itty-router';
import { YomitanAudioSource } from './yomitanResponse';
import { AudioSource } from './queryUtils';
import { log } from './logger';
import { generatePronunciationVariants } from './utils';

export interface PitchDBEntry {
    id: string;
    expression: string;
    reading: string;
    pitch: string;
    count: string;
}

export async function queryPitchDB(term: string, reading: string, env: any): Promise<PitchDBEntry[]> {
    let baseCondition = 'WHERE expression = ?';
    const params: any[] = [term];

    if (reading && reading.trim() !== '') {
        baseCondition = `WHERE (expression = ? AND reading = ?)`;
        params.push(reading);
    }

    const query = `SELECT id, expression, reading, pitch, count FROM pitch_accents ${baseCondition}`;

    let d1results: D1Result = await env.yomitan_audio_d1_db
        .prepare(query)
        .bind(...params)
        .all();

    if (d1results.success) {
        let pitch_entries = d1results.results as PitchDBEntry[];
        pitch_entries.sort((a, b) => parseInt(b.count) - parseInt(a.count));

        return pitch_entries;
    } else {
        log('error', 'query_pitch_db_failed', `Failed to query pitch database for term: ${term}${reading ? ', reading: ' + reading : ''}`, {
            term: term,
            reading: reading,
            d1_result: d1results.error || 'Unknown Error',
        });
        throw new StatusError(500, 'Database query failed.');
    }
}

export function createPitchEntryNoDB(term: string, reading: string): PitchDBEntry {
    const pitchEntry: PitchDBEntry = {
        id: 'Default - No DB',
        expression: term,
        reading: reading,
        pitch: '',
        count: '0',
    };
    return pitchEntry;
}

export async function createAllPossiblePronunciations(term: string, reading: string): Promise<PitchDBEntry[]> {
    const possiblePitches = await generatePronunciationVariants(reading);
    return possiblePitches.map((pitch) => {
        return {
            id: 'Forced',
            expression: term,
            reading: reading,
            pitch: pitch,
            count: '0',
        };
    });
}
export async function createTTSEntries(
    term: string,
    reading: string,
    sources: AudioSource[],
    env: any,
    request: IRequest
): Promise<YomitanAudioSource[]> {
    if (!env.AWS_POLLY_ENABLED) {
        return [];
    }

    if (sources.includes('all') || sources.includes('tts')) {
        const pitchDBEntries = await queryPitchDB(term, reading, env);
        const existingPitches = new Set(pitchDBEntries.map((entry) => entry.pitch));

        if (pitchDBEntries.length === 0) {
            pitchDBEntries.push(createPitchEntryNoDB(term, reading));
        }

        const allTtsPronunciations = await createAllPossiblePronunciations(term, reading);
        const uniqueTtsPronunciations = allTtsPronunciations.filter((entry) => !existingPitches.has(entry.pitch));
        const finalTtsCollection = [...pitchDBEntries, ...uniqueTtsPronunciations];

        const ttsEntries: YomitanAudioSource[] = finalTtsCollection.map((entry) => {
            const url = new URL(request.url);
            const audioUrl = new URL('/audio/tts', url.origin);

            audioUrl.searchParams.set('term', entry.expression);
            audioUrl.searchParams.set('reading', entry.reading);
            audioUrl.searchParams.set('pitch', entry.pitch);

            if (env.AUTHENTICATION_ENABLED) {
                audioUrl.searchParams.set('apiKey', request.apiKey);
            }

            let name = 'TTS';
            if (!isNaN(parseInt(entry.id))) {
                name += ` (${entry.pitch} Pitch DB)`;
            } else if (entry.pitch) {
                name += ` (${entry.pitch} ${entry.id})`;
            } else {
                name += ` (${entry.id})`;
            }

            return {
                name: name,
                url: audioUrl.toString(),
            };
        });
        return ttsEntries;
    } else {
        return [];
    }
}
