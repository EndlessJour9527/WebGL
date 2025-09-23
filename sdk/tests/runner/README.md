# WebGL Conformance Runner (JSAR)

This runner enumerates HTML cases under a folder (e.g. `conformance2`), launches each case in JSAR (or via a custom command), waits for a while, then copies JSAR runtime logs from `.cache/logs` into a versioned output folder grouped by case name.

## Layout
- `runner.js`: Main script
- `runner.config.json`: Active config (see fields below)
- `../logs/0.10.01`: Output folder for logs (created automatically)

## Usage

1. Configure `runner.config.json` fields:

- `casesRoot`: relative path to cases root (e.g. `../conformance2`)
- `logsSrc`: source logs dir (e.g. `../../../../jsar-runtime/.cache/logs`)
- `logsOut`: output base dir (e.g. `../logs/0.10.01`)
- `caseGlob`: glob for cases (default `**/*.html`)
- `jsarBin`: absolute path to JSAR binary, e.g.
	- `/Users/.../jsar-runtime/build/targets/darwin/transmute_browser`
- `useFileURL`: when true, pass `file://` URL instead of a filesystem path
- `args`: array of arguments template for JSAR. `{{absCasePath}}` is replaced per-case.
- `execution.waitMs`: wait time before copying logs (ms)

Process control (to avoid orphaned children):
- `inheritIO`: when true, JSAR stdout/stderr are shown in the terminal
- `detached`: spawn JSAR in a separate process group (default true)
- `killProcessGroup`: when stopping, signal the whole group (default true)
- `killGraceMs`: ms to wait between SIGTERM and SIGKILL

Fallback: if `execution.command` is provided, the runner will execute that command instead of spawning `jsarBin`. The template supports `{{jsarBin}}` and `{{absCasePath}}`.

2. Run:

```sh
node runner/runner.js
```

Optional: you can pass a `--config` CLI arg to specify an alternative config file.
