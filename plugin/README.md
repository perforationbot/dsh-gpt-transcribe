---
description: "Transcribe recordings with OpenAI's GPT Transcribe cloud model."
kind: "package-reference"
---

# @deepseek-ai/dsh-speech-to-text-openai

English | [中文](README.zh.md)

## Summary

This provider sends one complete recording to OpenAI's `/v1/audio/transcriptions` endpoint with `gpt-transcribe` and returns the final text. It registers with `ctx.speechToText` under `gpt-transcribe` and advertises cloud processing. The [voice input bundle](../voice-input-bundle/README.md) mounts it beside the local SenseVoice provider; selecting it requires a credential named by `apiKeyEnv`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The bundle registers the provider without configuration. `providerId` defaults to `gpt-transcribe`; the voice input provider picker lists it beside `sensevoice-local`, while the bundle keeps `sensevoice-local` as its default. `apiKeyEnv` defaults to `OPENAI_API_KEY` and accepts another POSIX identifier when the deployment stores the key under a different reference.

Each recording resolves the credential on the Host per request. A mounted credentials service decides the value; without that service, the launch environment supplies it. A missing or empty value fails before network I/O with an error naming the reference. Store the key through the credentials service or export it in the launching environment; the value never enters `cordis.yml`, diagnostics, or the transcript.

`endpoint` defaults to `https://api.openai.com/v1/audio/transcriptions`; `maxAudioBytes` defaults to the endpoint's 25 MB limit, `timeoutMs` to 300000 ms, and `maxResponseBytes` to 1 MiB. The provider accepts the language hints the voice input picker names and sends the selected hint as `languages[]`; `auto` omits it. Audio must be canonical 16 kHz mono PCM16 WAV.

Requests never retry or fall back to another provider. A rejected credential, an oversized recording, rate limiting, another HTTP status, a timeout, cancellation, malformed JSON, and an oversized response are distinct failures. The request is bounded by `timeoutMs` and `maxResponseBytes`, and the provider retains no audio or transcript.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

`GptTranscribeRecognizer` validates the language, byte bound, and WAV header before resolving the credential and starting the deadline. It sends a multipart body with `model`, `file`, and an optional `languages[]` field, reads the response through a byte-bounded reader, and accepts only a JSON object with a string `text`. `inferenceSeconds` measures the request through response parsing. Registration is one `ctx.effect`, so withdrawal removes the provider before the speech service joins accepted work; the shared HTTP request observes the registration's cancellation signal.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[Voice input subsystem](../../../docs/subsystems/voice-input.md)

-----

<a id="model-experience"></a>
## Model Experience

None, as recordings and transcripts remain outside model requests; ordinary user submission owns any later text.

#### KV Cache effect

No direct effect; ordinary submission owns the message content.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Cloud only. Audio leaves the Host for OpenAI, so deployments that cannot send recordings externally must keep the local provider selected. The request requires the credential named by `apiKeyEnv`; the provider never prompts for or stores it. The endpoint limits recordings to 25 MB, and the provider does not split longer audio, stream partial text, return timestamps, or label speakers. One request addresses one provider; there is no retry, fallback, or offline path. The language picker offers the hints the voice UI names, not every language the model can detect.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
