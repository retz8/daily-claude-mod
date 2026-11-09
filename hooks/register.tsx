import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

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

const measure = async (
  $: EngineInterface,
  context: SessionContextUsage,
  rateLimits: SessionRateLimit[],
): Promise<void> => {
  const next: Figures = {
    model: friendlyModel(await $.session.model()),
    contextPercent: context.percent ?? null,
    limits: rateLimits.map(limit => ({ kind: limit.kind, percent: limit.percentUsed })),
  }
  await update($, figures, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    $.ui.status(undefined)
    const { context, rateLimits } = await $.session.usage()
    await measure($, context, rateLimits)
    return result
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
