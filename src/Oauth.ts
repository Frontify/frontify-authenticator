import { encodeUrlToBase64, getRandomString, toUrlParameter, httpCall, normalizeDomain } from './Utils';
import { logMessage } from './Logger';

const CODE_VERIFIER_LENGTH: number = 64;
const AUTH_URL_RESPONSE_TYPE: string = 'code';
const AUTH_URL_CODE_CHALLENGE_METHOD: string = 'S256';
const AUTH_DEFAULT_REDIRECT_URL: string = '/connection/authenticator';
const AUTH_CODE_GRANT_TYPE: string = 'authorization_code';
const REFRESH_TOKEN_GRANT_TYPE: string = 'refresh_token';
const HASH_ALGORITHM: string = 'SHA-256';
const BEARER_TOKEN_TYPE: string = 'Bearer';

export type AuthenticationConfig = {
    domain: string;
    clientId: string;
    scopes: Array<string>;
    redirectUri?: string;
};

export type AuthorizationUrl = {
    authorizationUrl: string;
    codeVerifier: string;
    sessionId: string;
};

export type BearerToken = {
    tokenType: string;
    expiresIn: number;
    accessToken: string;
    refreshToken: string;
    domain: string;
};

async function computeChallengeCode(codeVerifier: string): Promise<string> {
    let array = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest(HASH_ALGORITHM, array);
    const hash = String.fromCharCode.apply(null, Array.from(new Uint8Array(digest)));
    return encodeUrlToBase64(hash);
}

export async function computeAuthorizationUrl(config: AuthenticationConfig): Promise<AuthorizationUrl> {
    const codeVerifier = getRandomString(CODE_VERIFIER_LENGTH);
    const codeChallenge = await computeChallengeCode(codeVerifier);
    const sessionId = await initializeOauthSession(config);

    return {
        authorizationUrl: `https://${normalizeDomain(config.domain)}/api/oauth/authorize?${toUrlParameter(
            {
                response_type: AUTH_URL_RESPONSE_TYPE,
                client_id: config.clientId,
                scope: config.scopes.join('+'),
                code_challenge: codeChallenge,
                code_challenge_method: AUTH_URL_CODE_CHALLENGE_METHOD,
                redirect_uri: config.redirectUri ?? AUTH_DEFAULT_REDIRECT_URL,
                session_id: sessionId,
            },
        )}`,
        codeVerifier,
        sessionId,
    };
}

export async function initializeOauthSession(config: AuthenticationConfig): Promise<string> {
    try {
        const session = await httpCall<{ data: { key: string } }>(
            `https://${normalizeDomain(config.domain)}/api/oauth/create/session`,
            { method: 'POST' },
        );
        return session.data.key;
    } catch (error) {
        logMessage('error', {
            code: 'ERR_SESSION',
            message: 'Error generating session.',
        });
        throw new Error('Error generating session.');
    }
}

export async function pollOauthSession(config: AuthenticationConfig, sessionId: string): Promise<string> {
    const response = await httpCall<{ data: { payload: { code: string } } }>(
        `https://${normalizeDomain(config.domain)}/api/oauth/poll`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
            }),
        },
    );

    // @TODO handle response.data, response.data.payload and response.data.payload.code

    return response.data.payload.code;
}

export async function retrieveAccessToken(
    config: AuthenticationConfig,
    code: string,
    codeVerifier: string,
): Promise<BearerToken> {
    const normalizedDomain = normalizeDomain(config.domain);
    const response = await httpCall<{ access_token: string; expires_in: number; refresh_token: string }>(
        `https://${normalizedDomain}/api/oauth/accesstoken`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: AUTH_CODE_GRANT_TYPE,
                code,
                code_verifier: codeVerifier,
                client_id: config.clientId,
                redirect_uri: config.redirectUri ?? AUTH_DEFAULT_REDIRECT_URL,
            }),
        },
    );

    return {
        tokenType: BEARER_TOKEN_TYPE,
        expiresIn: response.expires_in,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        domain: normalizedDomain,
    };
}

export async function refreshToken(
    config: AuthenticationConfig,
    refreshToken: string,
): Promise<BearerToken> {
    const normalizedDomain = normalizeDomain(config.domain);
    const response = await httpCall<{ access_token: string; expires_in: number; refresh_token: string }>(
        `https://${normalizedDomain}/api/oauth/refresh`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: REFRESH_TOKEN_GRANT_TYPE,
                refresh_token: refreshToken,
                client_id: config.clientId,
                scope: config.scopes.join('+'),
            }),
        },
    );

    return {
        tokenType: BEARER_TOKEN_TYPE,
        expiresIn: response.expires_in,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        domain: normalizedDomain,
    };
}

export async function revokeToken(
    domain: string,
    accessToken: string,
): Promise<void> {
    try {
        await httpCall(`https://${normalizeDomain(domain)}/api/oauth/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: accessToken }),
        });
    } catch (error) {
        logMessage('error', {
            code: 'ERR_TOKEN_REVOKE',
            message: 'Access token could not be revoked!',
        });
    }
}