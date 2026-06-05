import { AwsClient } from 'aws4fetch';
import { StatusError } from 'itty-router';
import { log } from './logger';

enum TextTypes {
    SSML = 'ssml',
    TEXT = 'text',
}

export async function generateTTSAudio(term: string, reading: string, pitch: string, env: any): Promise<Blob> {
    const accessKeyId = env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
    const region = 'eu-central-1';

    let text_type: TextTypes = TextTypes.TEXT;
    let text = term;

    if (term && pitch) {
        text_type = TextTypes.SSML;
        text = `<speak><phoneme alphabet="x-amazon-pron-kana" ph="${pitch}">${term}</phoneme></speak>`;
    } else if (term == reading) {
        text_type = TextTypes.TEXT;
        text = term;
    } else if (term && reading) {
        text_type = TextTypes.SSML;
        text = `<speak><phoneme type="ruby" ph="${reading}">${term}</phoneme></speak>`;
    }

    const aws = new AwsClient({
        accessKeyId,
        secretAccessKey,
        region,
    });

    const requestBody = JSON.stringify({
        Engine: 'neural',
        LanguageCode: 'ja-JP',
        OutputFormat: 'mp3',
        Text: text,
        TextType: text_type,
        VoiceId: 'Tomoko',
    });

    const response = await aws.fetch(`https://polly.${region}.amazonaws.com/v1/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
    });

    log('info', 'generated_new_tts', `Generated new TTS audio for term: ${term}, reading: ${reading}`, {
        term: term,
        reading: reading,
        pitch: pitch,
        text_type: text_type,
        text: text,
    });

    if (!response.ok) {
        const response_text = await response.text();
        log('error', 'polly_failed', `AWS Polly request failed with status ${response.status} for term: ${term}, reading: ${reading}`, {
            status: response.status,
            response_text: response_text,
            term: term,
            reading: reading,
        });
        throw new StatusError(response.status, 'AWS Polly request failed.');
    }

    return await response.blob();
}
