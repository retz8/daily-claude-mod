# status-strip

A Claude Code mod that adds one colored line under the prompt: the model in plain words, how full the context window is, and a bar for each usage limit your account actually reports.

```
Opus 5.5  ctx [####----------------] 23%  week [#-------------------] 7%
```

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install status-strip --marketplace retz8/daily-claude-mod
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install status-strip --marketplace retz8/daily-claude-mod
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `retz8/daily-claude-mod`, then Add plugin.

## What it shows

- **Model** — `claude-opus-5-5` reads as `Opus 5.5`; a 1M-context model gets `(1M)`.
- **ctx** — the context window's fill, updated after every turn.
- **Limits** — one bar per window the account reports (`5h`, `week`, `spend`). A plan with no 5-hour limit shows no 5-hour bar.

If you used a `statusLine` command before, remove it from `~/.claude/settings.json` so you don't get two strips.

## Develop

```
claude plugin validate .
claude plugin test .
```

The hooks module is `hooks/register.tsx`.
