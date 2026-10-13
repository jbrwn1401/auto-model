import type { Register } from 'claude-code'

// Сложность запроса → модель. При сомнении берём сильнее.
const MODELS = {
  simple: { id: 'claude-haiku-5-5', name: 'Haiku' },
  normal: { id: 'claude-sonnet-5-5', name: 'Sonnet' },
  complex: { id: 'claude-opus-5-5', name: 'Opus' },
} as const
type Level = keyof typeof MODELS
const LEVELS = Object.keys(MODELS) as Level[]

export const register: Register = on => {
  let isOn = false
  let current: Level = 'complex'
  const byTurn = new Map<string, Level>()

  const label = () => (isOn ? `Авто: ${MODELS[current].name}` : undefined)

  on('session.start', async ($, e, next) => {
    try {
      isOn = (await $.store.get('isOn')) === true
    } catch {
      isOn = false
    }
    await $.command.register({
      name: 'auto-model',
      description: 'Вкл/выкл режим «Авто»: модель выбирается сама под каждый запрос',
    })
    $.ui.status(label())
    return next(e)
  })

  on('command.run', { command: 'auto-model' }, async $ => {
    isOn = !isOn
    await $.store.set('isOn', isOn).catch(() => undefined)
    $.ui.status(label())
    return {
      text: isOn
        ? 'Режим «Авто» включён: простое → Haiku, обычное → Sonnet, сложное → Opus.'
        : 'Режим «Авто» выключен: работает модель, выбранная вручную.',
    }
  })

  on('turn.start', async ($, e, next) => {
    if (isOn && e.text.trim() !== '') {
      let level: Level = 'complex'
      try {
        const answer = await $.model.classify(
          e.text.slice(0, 4000),
          LEVELS,
          { model: MODELS.simple.id },
        )
        // simple: короткий вопрос, справка; normal: тексты, таблицы, правки;
        // complex: анализ, код, планы, много файлов. Нет ответа — Opus.
        if (answer && (LEVELS as string[]).includes(answer)) level = answer as Level
      } catch {
        level = 'complex'
      }
      current = level
      $.ui.status(label())
    }
    if (isOn) byTurn.set(e.turnId, current)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const level = byTurn.get(e.turnId)
    if (!isOn || level === undefined || e.agentId !== undefined) return yield* next(e)
    return yield* next({ ...e, model: MODELS[level].id })
  })

  on('turn.complete', ($, e, next) => {
    byTurn.delete(e.turnId)
    return next(e)
  })
}
