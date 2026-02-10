import { logMessage } from './Logger';

export class AuthenticatorError extends Error {
    constructor(
        public code: string,
        message: string,
    ) {
        super(`${code}: ${message}`);
        this.name = 'AuthenticatorError';
        logMessage('error', {
            code,
            message,
        });
    }
}
