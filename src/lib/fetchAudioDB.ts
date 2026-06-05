import { StatusError } from 'itty-router';
import fs from 'node:fs';
import path from 'node:path';

export async function fetchAudioDB(source: string, file: string, env: any) {
    try {
        // Baut den absoluten Pfad: /app/data/nhk16/audio/20170928151250.mp3
        const filePath = path.join('/app/data', source, file);
        
        if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            // Konvertiert den Node-Buffer in ein ArrayBuffer, das das restliche Skript erwartet
            return fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
        }
    } catch (error) {
        console.error("Fehler beim lokalen Dateizugriff:", error);
    }
    return null;
}


export async function fetchAudioTTS(tts_identifier: string, env: any): Promise<Blob | null> {
    const key = `tts_files/${tts_identifier}.mp3`;
    const object = await env.yomitan_audio_r2_bucket.get(key);

    if (!object) {
        return null;
    }

    const mp3file = await object.blob();

    return mp3file;
}

export async function saveAudioTTS(tts_identifier: string, mp3: Blob, env: any): Promise<boolean> {
    const key = `tts_files/${tts_identifier}.mp3`;
    await env.yomitan_audio_r2_bucket.put(key, mp3);
    return true;
}
