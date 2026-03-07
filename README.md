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
