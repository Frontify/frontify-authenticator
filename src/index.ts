import { Popup, PopupConfiguration } from "./Popup";
import {
    AuthenticationConfig,
    BearerToken,
    computeAuthorizationUrl,
    pollOauthSession,
    retrieveAccessToken
} from "./Oauth";

export function createPopUp(configuration?: PopupConfiguration): Popup {
    return new Popup(configuration ?? {});
}

export async function authorize(popUp: Popup, configuration: AuthenticationConfig): Promise<BearerToken> {
    const { authorizationUrl, codeVerifier, sessionId } = await computeAuthorizationUrl(configuration);
    await awaitUserAuthorization(authorizationUrl, popUp);
    const authorizationCode = await pollOauthSession(configuration, sessionId);
    return retrieveAccessToken(configuration, authorizationCode, codeVerifier);
}

async function awaitUserAuthorization(authorizationUrl: string, popUp: Popup) {
    popUp.navigateToUrl(authorizationUrl);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            popUp.close();
            reject(new Error('Login timeout!'));
        }, 5 * 60 * 1000);

        popUp.onSuccess(() => {
            clearTimeout(timeout);
            popUp.close();
            resolve(null);
        });

        popUp.onCancelled(() => {
            clearTimeout(timeout);
            popUp.close();
            reject(new Error('Login canceled!'));
        });
    });
}
