/** Stable failures from the OpenAI GPT Transcribe provider, safe to show in the voice input UI. */
export type GptTranscribeErrorCode = 'GPT_TRANSCRIBE_MISSING_CREDENTIAL' | 'GPT_TRANSCRIBE_INVALID_AUDIO' | 'GPT_TRANSCRIBE_UNSUPPORTED_LANGUAGE' | 'GPT_TRANSCRIBE_AUDIO_TOO_LARGE' | 'GPT_TRANSCRIBE_AUTH' | 'GPT_TRANSCRIBE_RATE_LIMIT' | 'GPT_TRANSCRIBE_HTTP' | 'GPT_TRANSCRIBE_TIMEOUT' | 'GPT_TRANSCRIBE_REQUEST_FAILED' | 'GPT_TRANSCRIBE_RESPONSE_LIMIT' | 'GPT_TRANSCRIBE_INVALID_RESPONSE';
/** A provider-owned failure that names a stable recovery category without exposing credentials or audio. */
export declare class GptTranscribeError extends Error {
    readonly code: GptTranscribeErrorCode;
    /**
     * @param code - stable failure category.
     * @param message - actionable text safe to display.
     * @param options - retained local cause, excluded from the public message.
     */
    constructor(code: GptTranscribeErrorCode, message: string, options?: ErrorOptions);
}
//# sourceMappingURL=error.d.ts.map