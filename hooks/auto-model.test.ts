import { expect, test } from 'claude-code/testing'

test('в режиме «Авто» сложный запрос уходит в Opus, простой — в Haiku', async ($, on) => {
  let answer = 'complex'
  const sent: string[] = []
  on('command.register', async (_$, e) => ({ value: { command: e.name } }) as never)
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('command.run', async () => ({}))
  on('ui.status', async () => ({ value: undefined }) as never)
  on('store.get', async () => ({ value: undefined }) as never)
  on('store.set', async () => ({ value: undefined }) as never)
  on('model.classify', async () => ({ value: answer }) as never)
  on('turn.step', async function* (_$, e) {
    sent.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })

  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  await $.command.run({ command: 'auto-model', args: '' } as never)

  await $.turn.start({ text: 'Спроектируй систему маршрутизации', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', messageCount: 1 })) {}

  answer = 'simple'
  await $.turn.start({ text: 'Который час?', turnId: 't2' })
  for await (const _ of $.turn.step({ turnId: 't2', index: 0, model: 'claude-sonnet-5-5', messageCount: 1 })) {}

  expect(sent).toEqual(['claude-opus-5-5', 'claude-haiku-5-5'])
})
