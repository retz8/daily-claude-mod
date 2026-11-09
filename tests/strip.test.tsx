import { expect, mock, test } from 'claude-code/testing'

const HINT = {
  plugin: 'status-strip',
  component: 'PromptHint',
  surface: 'terminal',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

test('the line names the model plainly and shows each reported limit', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 1000000, tokens: 230000, percent: 23 }, rateLimits: [{ kind: 'seven_day', percentUsed: 7 }] },
  }))
  on('ui.status', () => ({ value: undefined }))
  on('settings.read', () => ({ value: { effortLevel: 'medium', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>? for shortcuts</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(HINT)

  const line = await ui.find({ type: 'Text', text: /Opus 5\.5/ })
  expect(line?.text).toBe('Opus 5.5 · high  ctx [####----------------] 23%  week [#-------------------] 7%')
  expect(await ui.find({ type: 'Text', text: /status-strip|claude-opus/ })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /for shortcuts/ })).toBeTruthy()
  await ui.unmount()
})

test('a model or effort switch mid-session shows without waiting for a turn', async ($, on) => {
  let model = 'claude-opus-5-5'
  // /effort writes the level under the current model, the top-level one left stale
  const perModel: Record<string, { effortLevel: string }> = { 'claude-opus-5-5': { effortLevel: 'high' } }
  on('settings.read', () => ({ value: { effortLevel: 'high', modelSettings: perModel } }))
  const clock = mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: model }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1000000 }, rateLimits: [] } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>? for shortcuts</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(HINT)
  expect((await ui.find({ type: 'Text', text: /Opus 5\.5/ }))?.text).toContain('Opus 5.5 · high')

  perModel['claude-opus-5-5'] = { effortLevel: 'xhigh' }
  await clock.advance(1500)
  expect((await ui.find({ type: 'Text', text: /Opus 5\.5/ }))?.text).toContain('Opus 5.5 · xhigh')

  model = 'claude-sonnet-5-5'
  perModel['claude-sonnet-5-5'] = { effortLevel: 'max' }
  await clock.advance(1500)
  expect((await ui.find({ type: 'Text', text: /Sonnet 5\.5/ }))?.text).toContain('Sonnet 5.5 · max')
  await ui.unmount()
})
