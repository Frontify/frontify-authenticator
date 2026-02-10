import { AuthenticatorError } from './Exception';

export function getRandomString(length: number): string {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    array = array.map((x): number => validChars.charCodeAt(x % validChars.length));
    return String.fromCharCode.apply(null, Array.from(array));
}

export function encodeUrlToBase64(url: string): string {
    return btoa(url).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function toUrlParameter(dict: { [name: string]: string }): string {
    const keys = Object.keys(dict);
    const uriEncodedParts: string[] = keys
        .filter((key) => dict[key])
        .map((key): string => `${key}=${encodeURIComponent(dict[key])}`);

    return uriEncodedParts.join('&');
}

export function normalizeDomain(domain: string): string {
    const normalizedDomain = domain.replace(/^(https?:\/\/)/, '');
    return normalizedDomain.endsWith('/') ? normalizedDomain.replace(/\/+$/, '') : normalizedDomain;
}

export async function httpCall<JsonResponse>(url: string, init?: RequestInit): Promise<JsonResponse> {
    try {
        const response = await fetch(url, init);
        if (response.status >= 200 && response.status <= 299) {
            return (await response.json()) as JsonResponse;
        }

        throw new AuthenticatorError('ERR_AUTH_HTTP_REQUEST', response.statusText);
    } catch (error: unknown) {
        if (error instanceof AuthenticatorError) {
            throw error;
        }

        throw new AuthenticatorError('ERR_AUTH_HTTP_REQUEST', error as string);
    }
}

export function addWindowEventListener(eventType: string, listener: EventListenerOrEventListenerObject): () => void {
    window.addEventListener(eventType, listener);
    return () => {
        window.removeEventListener(eventType, listener);
    };
}
