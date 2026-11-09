export type Limit = { kind: string; percent: number }

export type Figures = { model: string; contextPercent: number | null; limits: Limit[] }

declare module 'claude-code' {
  interface PluginState {
    'status-strip': { figures: Figures | null }
  }
}
