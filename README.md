# Error Sonar

Error Sonar is a VS Code extension that plays audio alerts for two events:

- new code diagnostics with `Error` severity
- terminal command executions that exit with a non-zero code

This project is implemented from scratch and is intended as your own publishable extension base.

## Features

- Detects when the total number of editor errors increases
- Detects failed terminal command runs
- Uses separate sound files for code errors and terminal errors
- Includes a configurable cooldown to avoid noisy repeats
- Supports Windows, macOS, and Linux audio playback commands

## Extension Settings

All settings live under `errorSonar`:

- `errorSonar.enabled`: enable or disable extension behavior
- `errorSonar.cooldownMs`: minimum delay between sounds
- `errorSonar.codeErrorSoundPath`: sound file for editor errors
- `errorSonar.terminalErrorSoundPath`: sound file for terminal failures
- `errorSonar.notifyOnStart`: show startup status message

If no custom path is provided, the extension tries these bundled defaults:

- `media/fahh.mp3` (used for both code and terminal errors by default)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Compile:

```bash
npm run compile
```

3. Run in Extension Development Host:

- Open this folder in VS Code
- Press `F5`

## Add your own sounds

Place your `.wav`/`.mp3` files in any location and set paths in VS Code settings.

Example:

```json
{
  "errorSonar.codeErrorSoundPath": "/absolute/path/to/fahh.mp3",
  "errorSonar.terminalErrorSoundPath": "/absolute/path/to/fahh.mp3"
