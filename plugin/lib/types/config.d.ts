/** Deployment configuration for the OpenAI GPT Transcribe cloud recognizer. */
import z from '@deepseek-ai/schemastery';
/** Largest recording accepted by the OpenAI transcription endpoint. */
export declare const MAX_AUDIO_BYTES: number;
/** Cloud request, credential, and response bounds. */
export interface Config {
    /** Unique registration id; consumers select this exact id. */
    providerId: string;
    /** Credential reference resolved per recording; the value never enters configuration. */
    apiKeyEnv: string;
    /** OpenAI-compatible transcription endpoint. */
    endpoint: string;
    /** Maximum WAV bytes uploaded in one request. */
    maxAudioBytes: number;
    /** Deadline covering the request and complete response body. */
    timeoutMs: number;
    /** Maximum accepted transcript response bytes. */
    maxResponseBytes: number;
}
/** Validate deployment-varying cloud request choices at plugin activation. */
export declare const Config: z<Partial<Config>, Config>;
//# sourceMappingURL=config.d.ts.map