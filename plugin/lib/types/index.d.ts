/** OpenAI GPT Transcribe speech provider: cloud recognition selected by its registered id. */
import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.ts';
export { Config } from './config.ts';
export { GptTranscribeError } from './error.ts';
export type { GptTranscribeErrorCode } from './error.ts';
export declare const name = "speech-to-text-openai";
export declare const inject: string[];
/**
 * Register the cloud recognizer under its configured id; registration owns no download or model state.
 * @param ctx - Host speech registry.
 * @param config - validated credential reference, endpoint, and request bounds.
 */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map