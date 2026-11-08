# dsh-gpt-transcribe

Personal patch for **DeepSeek Harness**: adds an OpenAI **GPT Transcribe** speech provider beside the built-in local SenseVoice provider.

Not an upstream contribution and not affiliated with DeepSeek. Provided as-is for my own use.

## What it adds

- `@deepseek-ai/dsh-speech-to-text-openai`, a cloud recognizer that calls `POST /v1/audio/transcriptions` with `model=gpt-transcribe`.
- Multipart WAV upload, optional `languages[]` hint, request deadline, bounded response, cancellation, and typed failures.
- `OPENAI_API_KEY` resolution through DSH credentials (or the launch environment).
- The provider appears in **Plugins → Voice input → Recognition service** beside SenseVoice. SenseVoice remains the default unless selected otherwise.

Audio is sent to OpenAI only when GPT Transcribe is explicitly selected.

## Compatibility

Tested against **DeepSeek Harness 0.2.1-rc.3** on macOS. It uses the experimental `ctx.speechToText` provider API, so a future DSH release can break it. The source patch is included in `patch/` for rebasing.

## Install

```sh
git clone https://github.com/perforationbot/dsh-gpt-transcribe.git
cd dsh-gpt-transcribe
node install.mjs --profile superagent
```

The installer:

1. Finds the installed `@deepseek-ai/dsh` package (or accepts `--dsh-root`).
2. Copies the built plugin into the installation’s `node_modules`.
3. Inserts the provider row into the installed voice-input bundle patch.
4. Updates the bundle’s locale/README metadata and dependency entry.
5. Ensures the voice-input bundle is enabled in the profile.
6. Touches the profile patch so a running HMR-enabled DSH reconciles live.

Use `--dry-run` to inspect, `--no-reload` to skip the HMR touch, `--profile <name>` for another profile, or `--home <path>` for a non-default DSH home.

Then:

- If HMR was active, the provider is available immediately.
- Otherwise restart DSH.
- Open **Plugins → Voice input → Recognition service** and pick **GPT Transcribe**.

### Credentials

Set `OPENAI_API_KEY` in the launch environment, or add it under `refs:` in:

```text
~/.dsh/.credentials.yaml
```

The credential store reloads edits automatically; the provider resolves the key per request, so no restart is needed after adding it. This repository never contains credentials.

## Updating DeepSeek Harness

The durable state is **not** in the DSH package tree:

- profile bundle enablement and the selected recognizer live in `~/.dsh/profiles/<profile>/`;
- the credential lives in `~/.dsh/.credentials.yaml`.

A DSH upgrade replaces the installed package files. After each upgrade, rerun:

```sh
node install.mjs --profile superagent
```

The installer is idempotent and re-applies the provider package and bundle patch. It does not duplicate rows. The profile, selection, and credentials remain intact.

If the DSH speech-provider API changed, update the plugin source from `patch/gpt-transcribe-provider.patch`, rebuild, and replace `plugin/`.

## Repository layout

| Path | Purpose |
|---|---|
| `install.mjs` | Idempotent installer for an existing DSH installation |
| `plugin/` | Built provider package copied into DSH |
| `patch/gpt-transcribe-provider.patch` | Source patch against `deepseek-ai/deepseek-harness` commit `fcc0ad46` |
| `bundle/` | Updated voice-input bundle patch reference, locale metadata, and README |

The patch was generated from the DSH 0.2.2-rc.1 source tree and validated with the 0.2.1-rc.3 runtime used above.

## Uninstall

1. Remove the `speech-to-text-openai` row from the installed voice-input bundle’s `cordis.patch.yml`.
2. Remove `node_modules/@deepseek-ai/dsh-speech-to-text-openai` from the DSH installation.
3. Restart DSH, or touch the profile patch to trigger HMR.

The profile’s `speech-to-text` selection may still name `gpt-transcribe`; switch it back to `sensevoice-local` in the voice settings or remove that profile override.

## License

MIT. DeepSeek Harness itself is MIT-licensed by DeepSeek; the patch in `patch/` is a derivative work against it.
