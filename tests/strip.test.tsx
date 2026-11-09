import { expect, test } from 'claude-code/testing'

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
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>? for shortcuts</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(HINT)

  const line = await ui.find({ type: 'Text', text: /Opus 5\.5/ })
  expect(line?.text).toBe('Opus 5.5  ctx [####----------------] 23%  week [#-------------------] 7%')
  expect(await ui.find({ type: 'Text', text: /status-strip|claude-opus/ })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /for shortcuts/ })).toBeTruthy()
  await ui.unmount()
})
