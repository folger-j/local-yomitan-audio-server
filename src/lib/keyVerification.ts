import { IRequest, StatusError } from 'itty-router';

export async function verifyApiKey(request: IRequest, env: any) {
    if (!env.AUTHENTICATION_ENABLED) {
        return;
    }

    const apiKey = request.query?.apiKey;
    if (!apiKey) {
        throw new StatusError(400, 'Missing API key');
    }

    if (Array.isArray(apiKey)) {
        throw new StatusError(400, 'API key provided in unexpected format.');
    }

    const validApi_keys = env.API_KEYS.split(',');

    if (!validApi_keys.includes(apiKey)) {
        throw new StatusError(403, 'Invalid API key');
    }
}
