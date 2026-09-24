// Set by the auth middleware (phase 6); undefined for anonymous requests.
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            sessionId?: string;
        }
    }
}

export {};
