---
description: "使用 OpenAI 的 GPT Transcribe 云端模型转写录音。"
kind: "package-reference"
---

# @deepseek-ai/dsh-speech-to-text-openai

[English](README.md) | 中文

## 概述

此 Provider 将一段完整录音连同 `gpt-transcribe` 发送到 OpenAI 的 `/v1/audio/transcriptions` 端点，并返回最终文字。它以 `gpt-transcribe` 注册到 `ctx.speechToText`，并声明云端处理位置。[语音输入 Bundle](../voice-input-bundle/README.zh.md)将其与本地 SenseVoice Provider 并列挂载；选择它需要 `apiKeyEnv` 命名的凭据。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

Bundle 无需配置即可注册此 Provider。`providerId` 默认为 `gpt-transcribe`；语音输入的 Provider 选择器会将其列在 `sensevoice-local` 旁边，而 Bundle 仍以 `sensevoice-local` 为默认。`apiKeyEnv` 默认为 `OPENAI_API_KEY`；部署将密钥存放在其他引用下时，可改用另一个 POSIX 标识符。

每段录音都在 Host 上按请求解析凭据。已挂载的凭据服务决定其值；没有该服务时，由启动环境提供。值缺失或为空时会在任何网络 I/O 之前失败，并指出该引用。请通过凭据服务保存密钥，或在启动环境中导出它；该值不会进入 `cordis.yml`、诊断信息或转写文字。

`endpoint` 默认为 `https://api.openai.com/v1/audio/transcriptions`；`maxAudioBytes` 默认为端点的 25 MB 上限，`timeoutMs` 默认为 300000 毫秒，`maxResponseBytes` 默认为 1 MiB。此 Provider 接受语音输入选择器列出的语言提示，并将选中的提示作为 `languages[]` 发送；`auto` 会省略该字段。音频必须是规范的 16 kHz 单声道 PCM16 WAV。

请求从不重试，也不回退到其他 Provider。凭据被拒、录音过大、触发限流、其他 HTTP 状态、超时、取消、JSON 格式错误以及响应过大都是不同的失败。请求受 `timeoutMs` 和 `maxResponseBytes` 约束，Provider 不保留音频或转写文字。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>维护者信息 — 点击展开</summary>

`GptTranscribeRecognizer` 在解析凭据和启动截止时间之前校验语言、字节上限与 WAV 头。它发送包含 `model`、`file` 和可选 `languages[]` 字段的 multipart 请求体，通过受字节上限约束的读取器读取响应，并且只接受带字符串 `text` 的 JSON 对象。`inferenceSeconds` 测量从发起请求到解析响应的耗时。注册是一个 `ctx.effect`，因此撤销会在语音服务汇合已接受任务之前移除 Provider；共享 HTTP 请求观察注册的取消信号。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

[语音输入子系统](../../../docs/subsystems/voice-input.zh.md)

-----

<a id="model-experience"></a>
## 模型体验

无，因为录音与转写文字不进入模型请求；之后的文字由普通用户提交拥有。

#### KV 缓存影响

没有直接影响；普通提交拥有消息内容。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 仅支持云端。音频会离开 Host 发往 OpenAI，因此不能向外部发送录音的部署必须继续选择本地 Provider。请求需要 `apiKeyEnv` 命名的凭据；Provider 从不提示输入或保存它。端点将录音限制在 25 MB，Provider 不切分更长音频、不流式返回部分文字、不返回时间戳，也不标注说话人。一个请求只面向一个 Provider；没有重试、回退或离线路径。语言选择器只提供语音 UI 列出的提示，而不是模型能检测的所有语言。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者信息 — 点击展开</summary>

无。

</details>
