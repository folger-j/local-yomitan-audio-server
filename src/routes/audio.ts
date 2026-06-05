import { AutoRouter, IRequest, json, error, createResponse } from 'itty-router';
import { unpack_term_reading, unpack_pitch, unpack_sources } from '../lib/queryUtils';
import { queryAudioDB, generateDisplayNames, sortResults } from '../lib/queryAudioDB';
import { generateYomitanResponseObject } from '../lib/yomitanResponse';
import { log } from '../lib/logger';
import { createTTSEntries } from '../lib/ttsUtils';
import { verifyApiKey } from '../lib/keyVerification';
import { fetchAudioTTS, fetchAudioDB as returnAudio, saveAudioTTS } from '../lib/fetchAudioDB';
import { generateTTSAudio } from '../lib/awsPolly';
import { withApiKey } from '../lib/middleware';
import fs from 'node:fs';
import path from 'node:path';

export const router = AutoRouter({ base: '/audio', catch: undefined });

router.get('/list', withApiKey, async (request: IRequest, env: any) => {
    await verifyApiKey(request, env);

    log('info', 'audio_list', `Searching for audio with: ${request.url}`, request.query);

    const [term, reading] = await unpack_term_reading(request);

    const sources = await unpack_sources(request);

    const results = await queryAudioDB(term, reading, sources, env);

    log('info', 'db_result_count', `Searched for ${term} + ${reading} in ${sources} and got ${results.length} results`, {
        resultCount: results.length,
        term: term,
        reading: reading,
        sources: sources,
    });

    const displayNames = await generateDisplayNames(results, term, reading);

    const sortedResults = await sortResults(results, displayNames);

    const ttsEntries = await createTTSEntries(term, reading, sources, env, request);

    const yomitanResponses = await generateYomitanResponseObject(sortedResults, ttsEntries, request, env);

    return json(yomitanResponses, { 
    status: 200,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
    }
});
});


export const mp3 = (body: any, options: any = {}) => {
    // Falls der Body null oder leer ist, direkt 404 werfen
    if (!body) {
        return new Response("Not Found", { status: 404 });
    }

    // Wir konvertieren den Body in ein Uint8Array, um die exakte Byte-Länge zu ermitteln
    const data = body instanceof Uint8Array ? body : new Uint8Array(body);

    return new Response(data, {
        status: options.status || 200,
        headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': data.length.toString(),
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    });
};


// 1. ROUTE: Für Dateien, die direkt in der Source liegen (z.B. /get/source/datei.mp3)
router.get('/get/:source/:file', withApiKey, async (request: IRequest, env: any) => {
    await verifyApiKey(request, env);
    const source = request.params.source;
    let file = decodeURIComponent(request.params.file);

    // API-Key Suffix abschneiden, falls vorhanden
    if (file.includes('?')) file = file.split('?')[0];
    if (file.includes('&')) file = file.split('&')[0];

    log('info', 'audio_get', `Local File Fetch (Route 1): data/${source}/${file}`);

    try {
        const filePath = path.resolve('/app/data', source, file);
        if (!fs.existsSync(filePath)) {
            return error(404, `File not existing on disk: ${filePath}`);
        }
        const fileBuffer = fs.readFileSync(filePath);
        return mp3(fileBuffer, { status: 200 });
    } catch (e: any) {
        return error(404, `Read Error Route 1: ${e.message}`);
    }
});

// 2. ROUTE: Für verschachtelte Dateien (z.B. /get/nhk16/audio/20170928151250.mp3)
router.get('/get/:source/:folder/:file', withApiKey, async (request: IRequest, env: any) => {
    await verifyApiKey(request, env);
    const source = request.params.source;
    const folder = decodeURIComponent(request.params.folder);
    let file = decodeURIComponent(request.params.file);

    // 🔥 API-Key Suffix radikal abschneiden, damit der reine Dateiname übrig bleibt!
    if (file.includes('?')) file = file.split('?')[0];
    if (file.includes('&')) file = file.split('&')[0];

    const relativePath = `${folder}/${file}`;
    log('info', 'audio_get', `Local File Fetch (Route 2): data/${source}/${relativePath}`);

    try {
        // path.resolve garantiert den sauberen, absoluten Root-Pfad im Docker-Container
        const filePath = path.resolve('/app/data', source, folder, file);
        
        if (!fs.existsSync(filePath)) {
            return error(404, `File physisch nicht gefunden unter: ${filePath}`);
        }

        const fileBuffer = fs.readFileSync(filePath);
        return mp3(fileBuffer, { status: 200 });
    } catch (e: any) {
        return error(404, `Read Error Route 2: ${e.message}`);
    }
});

router.get('/tts', withApiKey, async (request: IRequest, env: any) => {
    await verifyApiKey(request, env);

    const [term, reading] = await unpack_term_reading(request);
    const pitch = await unpack_pitch(request);

    const tts_identifier = encodeURIComponent(term + reading + pitch);

    const audio = await fetchAudioTTS(tts_identifier, env);

    if (audio !== null) {
        log('info', 'using_cached_tts', `Using cached TTS data: ${term}, ${reading}, ${pitch} `, {
            term: term,
            reading: reading,
            pitch: pitch,
        });
        return mp3(audio, { status: 200 });
    }

    const generatedAudio = await generateTTSAudio(term, reading, pitch, env);

    // background save
    saveAudioTTS(tts_identifier, generatedAudio, env)
        .catch(console.error);

    return mp3(generatedAudio, { status: 200 });
});

router.all('*', () => {
    return error(400);
});
