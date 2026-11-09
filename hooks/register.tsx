import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit, Timer } from 'claude-code'

import type { Figures } from '../types'

// The 256-color codes the old status line script used: 209, 75, 214.
const MODEL_COLOR = '#ff875f'
const CONTEXT_COLOR = '#5fafff'
const LIMIT_COLOR = '#ffaf00'

const LIMIT_LABEL: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'week',
  spend_limit: 'spend',
}

const figures = atom({ plugin: 'status-strip', key: 'figures' } as const, null)

// claude-opus-5-5 -> Opus 5.5; claude-sonnet-4-5[1m] -> Sonnet 4.5 (1M)
const friendlyModel = (id: string): string => {
  const match = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?![\d])/i.exec(id)
  if (!match) return id
  const [, family = '', major = '', minor] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1)
  const version = minor === undefined ? major : `${major}.${minor}`
  const wide = /\[1m\]/i.test(id) ? ' (1M)' : ''
  return `${name} ${version}${wide}`
}

const bar = (percent: number | null): string => {
  const filled = percent === null ? 0 : Math.max(0, Math.min(20, Math.floor((percent / 100) * 20)))
  return `[${'#'.repeat(filled)}${'-'.repeat(20 - filled)}]`
}

const shown = (percent: number | null): string => (percent === null ? '--%' : `${Math.round(percent)}%`)

const levelOf = (entry: unknown): string | null => {
  if (typeof entry !== 'object' || entry === null) return null
  const level = (entry as { effortLevel?: unknown }).effortLevel
  return typeof level === 'string' ? level : null
}

// /effort saves the level per model, under modelSettings.<model id>.effortLevel;
// the top-level effortLevel is the fallback for a model with no entry of its own.
const savedEffort = async ($: EngineInterface, modelId: string): Promise<string | null> => {
  const settings = await $.settings.read()
  const perModel = settings.modelSettings
  const bareId = modelId.replace(/\[.*\]$/, '')
  const entries = typeof perModel === 'object' && perModel !== null ? (perModel as Record<string, unknown>) : {}
  return levelOf(entries[modelId]) ?? levelOf(entries[bareId]) ?? levelOf(settings)
}

const measure = async (
  $: EngineInterface,
  context: SessionContextUsage,
  rateLimits: SessionRateLimit[],
): Promise<void> => {
  const modelId = await $.session.model()
  const model = friendlyModel(modelId)
  const effort = await savedEffort($, modelId)
  await update($, figures, previous => ({
    model,
    effort: previous?.effort ?? effort,
    contextPercent: context.percent ?? null,
    limits: rateLimits.map(limit => ({ kind: limit.kind, percent: limit.percentUsed })),
  }))
}

// A model or effort switch (/model, /effort, the picker, a shortcut) raises no
// event of its own, so both are read on a short timer and the line redrawn only
// when one changed. A model request then carries the effort it was sent at.
const SWITCH_CHECK_MS = 1500

const refreshSwitches = async ($: EngineInterface, lastSaved: { effort: string | null }): Promise<void> => {
  const current = await read($, figures)
  if (current === null) return
  const modelId = await $.session.model()
  const model = friendlyModel(modelId)
  const saved = await savedEffort($, modelId)
  const effortMoved = saved !== lastSaved.effort
  lastSaved.effort = saved
  const effort = effortMoved ? saved : (current.effort ?? null)
  if (model !== current.model || effort !== (current.effort ?? null)) {
    await update($, figures, () => ({ ...current, model, effort }))
  }
}

export const register: Register = on => {
  let switchCheck: Timer | undefined

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    $.ui.status(undefined)
    const { context, rateLimits } = await $.session.usage()
    await measure($, context, rateLimits)
    const lastSaved = { effort: await savedEffort($, await $.session.model()) }
    switchCheck?.cancel()
    switchCheck = $.clock.every(SWITCH_CHECK_MS, () => void refreshSwitches($, lastSaved))
    return result
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && e.effort !== undefined) {
      const effort = String(e.effort)
      const current = await read($, figures)
      if (current !== null && current.effort !== effort) {
        await update($, figures, () => ({ ...current, effort }))
      }
    }
    return yield* next(e)
  })

  on('session.measure', async ($, e, next) => {
    await measure($, e.context, e.rateLimits)
    return next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const engineLine = await next(e)
    const current = await read($, figures)
    if (current === null) return engineLine

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {engineLine}
        <Text wrap="truncate-end">
          <Text color={MODEL_COLOR}>{current.model}</Text>
          {current.effort ? <Text dimColor>{` · ${current.effort}`}</Text> : null}
          {'  ctx '}
          <Text color={CONTEXT_COLOR}>
            {bar(current.contextPercent)} {shown(current.contextPercent)}
          </Text>
          {current.limits.map(limit => (
            <Text>
              {`  ${LIMIT_LABEL[limit.kind] ?? limit.kind} `}
              <Text color={LIMIT_COLOR}>
                {bar(limit.percent)} {shown(limit.percent)}
              </Text>
            </Text>
          ))}
        </Text>
      </Box>
    )
  })
}
