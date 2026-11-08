#!/usr/bin/env node
/**
 * Install the GPT Transcribe provider into an existing DeepSeek Harness
 * installation and patch its optional voice-input bundle.
 *
 * The profile (bundle enablement, selected recognizer) and the credential file
 * live in the Harness home and survive DSH upgrades. Only the installed DSH
 * package tree is replaced on upgrade, so rerun this script afterwards.
 */
import { execFileSync } from 'node:child_process'
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROVIDER_PACKAGE = '@deepseek-ai/dsh-speech-to-text-openai'
const VOICE_BUNDLE = '@deepseek-ai/dsh-experimental-voice-input-bundle'
const TESTED_DSH_VERSION = '0.2.1-rc.3'

const argv = process.argv.slice(2)
const flag = name => argv.includes(name)
const option = (name, fallback) => {
  const index = argv.indexOf(name)
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback
}

const dryRun = flag('--dry-run')
const noReload = flag('--no-reload')
const profileName = option('--profile', 'superagent')
const home = resolve(option('--home', process.env.DSH_HOME ?? join(homedir(), '.dsh')))
const explicitRoot = option('--dsh-root', process.env.DSH_ROOT)

const log = message => console.log(`[gpt-transcribe] ${message}`)
const warn = message => console.warn(`[gpt-transcribe] WARNING: ${message}`)

function manifestAt(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } catch {
    return undefined
  }
}

/** Locate the installed @deepseek-ai/dsh package root. */
function findDshRoot() {
  if (explicitRoot !== undefined) return resolve(explicitRoot)
  const candidates = []
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (globalRoot.length > 0) candidates.push(join(globalRoot, '@deepseek-ai/dsh'))
  } catch {
    // npm may be unavailable on the PATH used to run this script.
  }
  candidates.push(
    join(homedir(), '.hermes/node/lib/node_modules/@deepseek-ai/dsh'),
    '/usr/local/lib/node_modules/@deepseek-ai/dsh',
    '/opt/homebrew/lib/node_modules/@deepseek-ai/dsh',
  )
  for (const candidate of candidates) {
    const manifest = manifestAt(candidate)
    if (manifest?.name === '@deepseek-ai/dsh') return candidate
  }
  throw new Error('Could not find @deepseek-ai/dsh. Pass --dsh-root /path/to/@deepseek-ai/dsh.')
}

/** Insert the provider row before the first known bundle row, preserving its indentation. */
function insertProviderRow(text) {
  if (text.includes(`id: speech-to-text-openai`)) return { text, changed: false }
  for (const id of ['api-speech-to-text', 'ui-voice-input']) {
    const match = new RegExp(`^(\\s+)- id: ${id}\\s*$`, 'm').exec(text)
    if (match === null) continue
    const indent = match[1]
    const row = `${indent}- id: speech-to-text-openai\n${indent}  name: '${PROVIDER_PACKAGE}'\n`
    return { text: text.slice(0, match.index) + row + text.slice(match.index), changed: true }
  }
  throw new Error('The installed voice-input bundle patch has no known insertion point. '
    + 'Update this installer for the new DSH layout, or apply the provider row manually.')
}

async function main() {
  const dshRoot = findDshRoot()
  const dshManifest = manifestAt(dshRoot)
  if (dshManifest?.name !== '@deepseek-ai/dsh') throw new Error(`Not a DSH installation: ${dshRoot}`)
  log(`DSH ${dshManifest.version ?? 'unknown'} at ${dshRoot}`)
  if (dshManifest.version !== TESTED_DSH_VERSION) {
    warn(`this plugin is tested against DSH ${TESTED_DSH_VERSION}; current is ${dshManifest.version ?? 'unknown'}. `
      + 'Verify the speech provider API before relying on it.')
  }

  const bundleDir = join(dshRoot, 'node_modules/@deepseek-ai/dsh-experimental-voice-input-bundle')
  await access(join(bundleDir, 'package.json'), constants.F_OK)
  const pluginSource = join(HERE, 'plugin')
  const pluginManifest = manifestAt(pluginSource)
  if (pluginManifest?.name !== PROVIDER_PACKAGE) throw new Error(`Missing built plugin at ${pluginSource}`)
  const pluginTarget = join(dshRoot, 'node_modules/@deepseek-ai/dsh-speech-to-text-openai')

  if (!dryRun) {
    await rm(pluginTarget, { recursive: true, force: true })
    await cp(pluginSource, pluginTarget, { recursive: true })
  }
  log(`${dryRun ? 'would install' : 'installed'} ${PROVIDER_PACKAGE} -> ${pluginTarget}`)

  const bundlePatchPath = join(bundleDir, 'cordis.patch.yml')
  const currentPatch = await readFile(bundlePatchPath, 'utf8')
  const patched = insertProviderRow(currentPatch)
  if (patched.changed) {
    if (!dryRun) await writeFile(bundlePatchPath, patched.text)
    log(`${dryRun ? 'would add' : 'added'} the provider row to the voice-input bundle patch`)
  } else {
    log('voice-input bundle patch already contains the provider row')
  }

  const bundleLocaleSource = join(HERE, 'bundle/locale')
  const bundleLocaleTarget = join(bundleDir, 'locale')
  const localeFiles = (await readdir(bundleLocaleSource)).filter(file => file.endsWith('.json'))
  if (!dryRun) {
    await mkdir(bundleLocaleTarget, { recursive: true })
    for (const file of localeFiles) await cp(join(bundleLocaleSource, file), join(bundleLocaleTarget, file))
    for (const file of ['README.md', 'README.zh.md']) {
      try { await cp(join(HERE, 'bundle', file), join(bundleDir, file)) } catch { /* optional metadata */ }
    }
  }
  log(`${dryRun ? 'would update' : 'updated'} the bundle locale and README metadata`)

  const bundleManifestPath = join(bundleDir, 'package.json')
  const bundleManifest = JSON.parse(await readFile(bundleManifestPath, 'utf8'))
  bundleManifest.description = 'Experimental voice input with local SenseVoice or OpenAI GPT Transcribe'
  bundleManifest.dependencies ??= {}
  if (bundleManifest.dependencies[PROVIDER_PACKAGE] !== pluginManifest.version) {
    bundleManifest.dependencies[PROVIDER_PACKAGE] = pluginManifest.version
    if (!dryRun) await writeFile(bundleManifestPath, `${JSON.stringify(bundleManifest, null, 2)}\n`)
    log(`${dryRun ? 'would record' : 'recorded'} the provider dependency in the bundle manifest`)
  }

  const profileDir = join(home, 'profiles', profileName)
  const profileManifestPath = join(profileDir, 'package.json')
  const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
  profileManifest.dsh ??= {}
  profileManifest.dsh.profile ??= {}
  const bundles = profileManifest.dsh.profile.bundles
  if (!Array.isArray(bundles)) throw new Error(`Profile ${profileName} has no dsh.profile.bundles list`)
  if (!bundles.includes(VOICE_BUNDLE)) {
    bundles.push(VOICE_BUNDLE)
    if (!dryRun) await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`)
    log(`${dryRun ? 'would enable' : 'enabled'} the voice-input bundle in profile ${profileName}`)
  } else {
    log(`voice-input bundle already enabled in profile ${profileName}`)
  }

  if (!noReload) {
    const profilePatchPath = join(profileDir, 'cordis.patch.yml')
    try {
      let text = await readFile(profilePatchPath, 'utf8')
      text = text.replace(/^# dsh-gpt-transcribe: installed.*(?:\n|$)/gm, '').trimEnd()
      text += `\n# dsh-gpt-transcribe: installed ${new Date().toISOString()}\n`
      if (!dryRun) await writeFile(profilePatchPath, text)
      log(`${dryRun ? 'would touch' : 'touched'} the profile patch to trigger a live HMR reconcile`)
    } catch {
      warn(`could not touch ${profilePatchPath}; restart DSH to load the provider`)
    }
  }

  log('')
  log('Credentials are not modified. Set OPENAI_API_KEY in the launch environment or refs in')
  log(`  ${join(home, '.credentials.yaml')}`)
  log('Then use Plugins -> Voice input -> Recognition service -> GPT Transcribe.')
  log('If HMR was not running, restart DSH. After a DSH upgrade, rerun this installer.')
}

main().catch(error => {
  console.error(`[gpt-transcribe] ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
