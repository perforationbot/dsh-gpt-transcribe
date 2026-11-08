import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { MAX_TIMER_DELAY_MS, deadline, timeoutOf } from "@deepseek-ai/dsh-timeout";
import { validateWave } from "@deepseek-ai/dsh-experimental-speech-to-text/wave";
import z from "@deepseek-ai/schemastery";
//#region lib/types/error.js
/** A provider-owned failure that names a stable recovery category without exposing credentials or audio. */
var GptTranscribeError = class extends Error {
	code;
	/**
	* @param code - stable failure category.
	* @param message - actionable text safe to display.
	* @param options - retained local cause, excluded from the public message.
	*/
	constructor(code, message, options) {
		super(message, options);
		this.code = code;
		this.name = "GptTranscribeError";
	}
};
//#endregion
//#region lib/types/languages.js
/** Language hints accepted by GPT Transcribe and named by the voice input language picker. */
const languages = [
	"auto",
	"zh",
	"yue",
	"en",
	"ja",
	"ko",
	"es",
	"fr",
	"de",
	"ru",
	"pt"
];
//#endregion
//#region lib/types/recognizer.js
var __addDisposableResource = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
/** The one file-transcription model this provider addresses. */
const MODEL = "gpt-transcribe";
const TIMEOUT_CODE = "GPT_TRANSCRIBE_TIMEOUT";
/**
* Read a response body without retaining more than the configured bound.
* @param response - successful transcription response.
* @param maxBytes - maximum accepted UTF-8 response bytes.
* @returns the complete response text.
*/
async function readText(response, maxBytes) {
	if (response.body === null) throw new GptTranscribeError("GPT_TRANSCRIBE_INVALID_RESPONSE", "OpenAI GPT Transcribe returned an empty response body");
	const reader = response.body.getReader();
	const chunks = [];
	let bytes = 0;
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			bytes += chunk.value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				throw new GptTranscribeError("GPT_TRANSCRIBE_RESPONSE_LIMIT", `OpenAI GPT Transcribe response exceeds ${maxBytes} bytes`);
			}
			chunks.push(chunk.value);
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks).toString("utf8");
}
/**
* Read the transcript from a JSON response, rejecting every other document.
* @param raw - complete response text.
* @returns the transcribed text, including an empty result for silence.
*/
function transcriptOf(raw) {
	let payload;
	try {
		payload = JSON.parse(raw);
	} catch (error) {
		throw new GptTranscribeError("GPT_TRANSCRIBE_INVALID_RESPONSE", "OpenAI GPT Transcribe returned invalid JSON", { cause: error });
	}
	if (typeof payload !== "object" || payload === null || !("text" in payload) || typeof payload.text !== "string") throw new GptTranscribeError("GPT_TRANSCRIBE_INVALID_RESPONSE", "OpenAI GPT Transcribe returned no transcript text");
	return payload.text;
}
/** One stateless provider implementation; each recording resolves its own credential and request. */
var GptTranscribeRecognizer = class {
	ctx;
	config;
	/**
	* @param ctx - Host context that supplies credentials and the launch environment.
	* @param config - validated endpoint, credential reference, and request bounds.
	*/
	constructor(ctx, config) {
		this.ctx = ctx;
		this.config = config;
	}
	/**
	* Transcribe one complete recording through the OpenAI transcription endpoint.
	* @param input - canonical WAV bytes and an accepted language hint.
	* @param signal - caller cancellation or provider withdrawal.
	* @returns final text and measured audio and request durations.
	*/
	async transcribe(input, signal) {
		const env_1 = {
			stack: [],
			error: void 0,
			hasError: false
		};
		try {
			signal.throwIfAborted();
			const audioSeconds = this.validate(input);
			const apiKey = await this.apiKey();
			signal.throwIfAborted();
			const timeout = __addDisposableResource(env_1, deadline(signal, this.config.timeoutMs, TIMEOUT_CODE), false);
			const started = performance.now();
			try {
				const response = await fetch(this.config.endpoint, {
					method: "POST",
					headers: { authorization: `Bearer ${apiKey}` },
					body: this.requestBody(input),
					redirect: "error",
					credentials: "omit",
					signal: timeout.signal
				});
				if (!response.ok) {
					await response.body?.cancel();
					throw this.httpError(response.status);
				}
				const text = transcriptOf(await readText(response, this.config.maxResponseBytes));
				timeout.signal.throwIfAborted();
				return {
					text,
					audioSeconds,
					inferenceSeconds: (performance.now() - started) / 1e3
				};
			} catch (error) {
				const expired = timeoutOf(timeout.signal, TIMEOUT_CODE);
				if (expired !== void 0 && expired !== signal.reason) throw new GptTranscribeError("GPT_TRANSCRIBE_TIMEOUT", `OpenAI GPT Transcribe timed out after ${expired.timeoutMs}ms`, { cause: error });
				timeout.signal.throwIfAborted();
				if (error instanceof GptTranscribeError) throw error;
				throw new GptTranscribeError("GPT_TRANSCRIBE_REQUEST_FAILED", "OpenAI GPT Transcribe request failed", { cause: error });
			}
		} catch (e_1) {
			env_1.error = e_1;
			env_1.hasError = true;
		} finally {
			__disposeResources(env_1);
		}
	}
	/**
	* Validate language, size, and the canonical WAV header before any network I/O.
	* @param input - recording and requested language hint.
	* @returns recording duration in seconds.
	*/
	validate(input) {
		if (!languages.includes(input.language)) throw new GptTranscribeError("GPT_TRANSCRIBE_UNSUPPORTED_LANGUAGE", `GPT Transcribe does not support language: ${input.language}`);
		if (input.audio.byteLength > this.config.maxAudioBytes) throw new GptTranscribeError("GPT_TRANSCRIBE_AUDIO_TOO_LARGE", `Recording exceeds ${this.config.maxAudioBytes} bytes`);
		try {
			return validateWave(input.audio, this.config.maxAudioBytes / 32e3);
		} catch (error) {
			throw new GptTranscribeError("GPT_TRANSCRIBE_INVALID_AUDIO", "GPT Transcribe requires a canonical 16 kHz mono PCM16 WAV recording", { cause: error });
		}
	}
	/**
	* Resolve the configured credential reference through the credentials service, or the launch environment without it.
	* @returns the API key used only in the authorization header for this request.
	*/
	async apiKey() {
		const reference = credentialRef(this.config.apiKeyEnv);
		const credentials = this.ctx.get("credentials");
		const value = credentials === void 0 ? launchEnvironmentOf(this.ctx).get(this.config.apiKeyEnv)?.value : (await credentials.resolve(reference))?.value;
		if (value === void 0 || value === "") throw new GptTranscribeError("GPT_TRANSCRIBE_MISSING_CREDENTIAL", `GPT Transcribe requires ${this.config.apiKeyEnv}; store it through the credentials service or export it in the launching environment`);
		return value;
	}
	/**
	* Encode one multipart request; `languages[]` carries the single selected hint and is omitted for automatic detection.
	* @param input - validated recording and language hint.
	* @returns the request body sent to the configured endpoint.
	*/
	requestBody(input) {
		const form = new FormData();
		form.append("model", MODEL);
		form.append("file", new Blob([input.audio.slice()], { type: "audio/wav" }), "recording.wav");
		if (input.language !== "auto") form.append("languages[]", input.language);
		return form;
	}
	/**
	* Map an unsuccessful response to an actionable failure without exposing its body.
	* @param status - HTTP status from the transcription endpoint.
	* @returns the categorized public failure.
	*/
	httpError(status) {
		if (status === 401 || status === 403) return new GptTranscribeError("GPT_TRANSCRIBE_AUTH", `OpenAI rejected ${this.config.apiKeyEnv} (HTTP ${status})`);
		if (status === 413) return new GptTranscribeError("GPT_TRANSCRIBE_AUDIO_TOO_LARGE", "OpenAI rejected the recording as too large (HTTP 413)");
		if (status === 429) return new GptTranscribeError("GPT_TRANSCRIBE_RATE_LIMIT", "OpenAI rate limited the transcription request (HTTP 429)");
		return new GptTranscribeError("GPT_TRANSCRIBE_HTTP", `OpenAI GPT Transcribe failed (HTTP ${status})`);
	}
};
//#endregion
//#region lib/types/config.js
/** Deployment configuration for the OpenAI GPT Transcribe cloud recognizer. */
/** Largest recording accepted by the OpenAI transcription endpoint. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
/**
* Accept an HTTP(S) endpoint without embedded credentials or a fragment.
* @param value - configured transcription endpoint.
* @returns the normalized endpoint URL.
*/
function endpoint(value) {
	const url = new URL(value);
	if (!["http:", "https:"].includes(url.protocol) || url.username !== "" || url.password !== "" || url.hash !== "") throw new Error("GPT Transcribe endpoint must be an HTTP(S) URL without credentials or a fragment");
	return url.href;
}
/** Validate deployment-varying cloud request choices at plugin activation. */
const Config = z.object({
	providerId: z.string().min(1).default("gpt-transcribe"),
	apiKeyEnv: z.string().pattern(/^[A-Za-z_][A-Za-z0-9_]*$/).default("OPENAI_API_KEY"),
	endpoint: z.transform(z.string(), endpoint).default("https://api.openai.com/v1/audio/transcriptions"),
	maxAudioBytes: z.natural().min(46).max(MAX_AUDIO_BYTES).default(MAX_AUDIO_BYTES),
	timeoutMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(3e5),
	maxResponseBytes: z.natural().min(1).default(1024 * 1024)
});
//#endregion
//#region lib/types/index.js
const name = "speech-to-text-openai";
const inject = ["speechToText"];
/**
* Register the cloud recognizer under its configured id; registration owns no download or model state.
* @param ctx - Host speech registry.
* @param config - validated credential reference, endpoint, and request bounds.
*/
function apply(ctx, config) {
	const recognizer = new GptTranscribeRecognizer(ctx, config);
	ctx.effect(() => ctx.speechToText.register({
		info: {
			id: config.providerId,
			name: "GPT Transcribe",
			location: "cloud",
			languages
		},
		transcribe: async (input, signal) => await recognizer.transcribe(input, signal)
	}));
}
//#endregion
export { Config, GptTranscribeError, apply, inject, name };
