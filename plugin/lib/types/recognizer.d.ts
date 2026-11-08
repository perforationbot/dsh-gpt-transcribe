/** OpenAI GPT Transcribe cloud recognizer: one bounded multipart request per complete recording. */
import type { Context } from '@deepseek-ai/cordis';
import type { SpeechInput, Transcript } from '@deepseek-ai/dsh-experimental-speech-to-text/types';
import type { Config } from './config.ts';
/** One stateless provider implementation; each recording resolves its own credential and request. */
export declare class GptTranscribeRecognizer {
    private readonly ctx;
    private readonly config;
    /**
     * @param ctx - Host context that supplies credentials and the launch environment.
     * @param config - validated endpoint, credential reference, and request bounds.
     */
    constructor(ctx: Context, config: Config);
    /**
     * Transcribe one complete recording through the OpenAI transcription endpoint.
     * @param input - canonical WAV bytes and an accepted language hint.
     * @param signal - caller cancellation or provider withdrawal.
     * @returns final text and measured audio and request durations.
     */
    transcribe(input: SpeechInput, signal: AbortSignal): Promise<Transcript>;
    /**
     * Validate language, size, and the canonical WAV header before any network I/O.
     * @param input - recording and requested language hint.
     * @returns recording duration in seconds.
     */
    private validate;
    /**
     * Resolve the configured credential reference through the credentials service, or the launch environment without it.
     * @returns the API key used only in the authorization header for this request.
     */
    private apiKey;
    /**
     * Encode one multipart request; `languages[]` carries the single selected hint and is omitted for automatic detection.
     * @param input - validated recording and language hint.
     * @returns the request body sent to the configured endpoint.
     */
    private requestBody;
    /**
     * Map an unsuccessful response to an actionable failure without exposing its body.
     * @param status - HTTP status from the transcription endpoint.
     * @returns the categorized public failure.
     */
    private httpError;
}
//# sourceMappingURL=recognizer.d.ts.map