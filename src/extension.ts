import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

const CONFIG_NAMESPACE = 'errorSonar';

interface LoadedConfig {
  enabled: boolean;
  cooldownMs: number;
  notifyOnStart: boolean;
  codeErrorSoundPath?: string;
  terminalErrorSoundPath?: string;
}

class SoundGate {
  private isPlaying = false;
  private lastPlayedAt = 0;

  constructor(private readonly output: vscode.OutputChannel) {}

  public async play(filePath: string, cooldownMs: number): Promise<void> {
    const now = Date.now();

    if (this.isPlaying) {
      return;
    }

    if (cooldownMs > 0 && now - this.lastPlayedAt < cooldownMs) {
      return;
    }

    this.isPlaying = true;
    this.lastPlayedAt = now;

    try {
      await playAudioFile(filePath);
    } catch (error) {
      this.output.appendLine(`[Error Sonar] Failed to play '${filePath}': ${toErrorMessage(error)}`);
    } finally {
      this.isPlaying = false;
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Error Sonar');
  context.subscriptions.push(output);

  let config = loadConfig(context, output);
  let previousErrorCount = getTotalDiagnosticsErrorCount();
  const soundGate = new SoundGate(output);

  const diagnosticsDisposable = vscode.languages.onDidChangeDiagnostics(() => {
    const currentErrorCount = getTotalDiagnosticsErrorCount();

    if (!config.enabled) {
      previousErrorCount = currentErrorCount;
      return;
    }

    if (currentErrorCount > previousErrorCount && config.codeErrorSoundPath) {
      void soundGate.play(config.codeErrorSoundPath, config.cooldownMs);
    }

    previousErrorCount = currentErrorCount;
  });

  const terminalDisposable = vscode.window.onDidEndTerminalShellExecution((event) => {
    if (!config.enabled || !config.terminalErrorSoundPath) {
      return;
    }

    if (typeof event.exitCode === 'number' && event.exitCode !== 0) {
      void soundGate.play(config.terminalErrorSoundPath, config.cooldownMs);
    }
  });

  const configurationDisposable = vscode.workspace.onDidChangeConfiguration((changeEvent) => {
    if (!changeEvent.affectsConfiguration(CONFIG_NAMESPACE)) {
      return;
    }

    config = loadConfig(context, output);
  });

  context.subscriptions.push(diagnosticsDisposable, terminalDisposable, configurationDisposable);

  if (config.notifyOnStart) {
    if (config.enabled) {
      void vscode.window.showInformationMessage('Error Sonar is active.');
    } else {
      void vscode.window.showInformationMessage('Error Sonar loaded but currently disabled in settings.');
    }
  }
}

export function deactivate(): void {
  // Nothing to clean up explicitly; disposables are tracked via subscriptions.
}

function loadConfig(context: vscode.ExtensionContext, output: vscode.OutputChannel): LoadedConfig {
  const settings = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

  const enabled = settings.get<boolean>('enabled', true);
  const rawCooldown = settings.get<number>('cooldownMs', 1200);
  const notifyOnStart = settings.get<boolean>('notifyOnStart', true);

  const codePathSetting = settings.get<string>('codeErrorSoundPath', '');
  const terminalPathSetting = settings.get<string>('terminalErrorSoundPath', '');

  const defaultFahhPath = path.join(context.extensionPath, 'media', 'fahh.mp3');
  const codeErrorSoundPath = resolveSoundPath(codePathSetting, defaultFahhPath);
  const terminalErrorSoundPath = resolveSoundPath(terminalPathSetting, defaultFahhPath);

  const cooldownMs = Number.isFinite(rawCooldown) ? Math.max(0, rawCooldown) : 0;

  if (enabled && !codeErrorSoundPath) {
    output.appendLine('[Error Sonar] No valid file found for code errors. Set errorSonar.codeErrorSoundPath or add media/fahh.mp3.');
  }

  if (enabled && !terminalErrorSoundPath) {
    output.appendLine('[Error Sonar] No valid file found for terminal errors. Set errorSonar.terminalErrorSoundPath or add media/fahh.mp3.');
  }

  return {
    enabled,
    cooldownMs,
    notifyOnStart,
    codeErrorSoundPath,
    terminalErrorSoundPath
  };
}

function resolveSoundPath(configuredPath: string, bundledFallbackPath: string): string | undefined {
  const trimmedPath = configuredPath.trim();
  const candidates: string[] = [];

  if (trimmedPath.length > 0) {
    if (path.isAbsolute(trimmedPath)) {
      candidates.push(trimmedPath);
    } else {
      const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
      for (const folder of workspaceFolders) {
        candidates.push(path.join(folder.uri.fsPath, trimmedPath));
      }
      candidates.push(path.resolve(trimmedPath));
    }
  } else {
    candidates.push(bundledFallbackPath);
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function getTotalDiagnosticsErrorCount(): number {
  let total = 0;

  for (const [, diagnostics] of vscode.languages.getDiagnostics()) {
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
        total += 1;
      }
    }
  }

  return total;
}

async function playAudioFile(filePath: string): Promise<void> {
  if (process.platform === 'darwin') {
    await runProcess('afplay', [filePath]);
    return;
  }

  if (process.platform === 'win32') {
    const escapedPath = filePath.replace(/'/g, "''");
    const command = [
      'Add-Type -AssemblyName presentationCore;',
      '$p = New-Object System.Windows.Media.MediaPlayer;',
      `$p.Open('${escapedPath}');`,
      '$p.Play();',
      'Start-Sleep -Milliseconds 1800'
    ].join(' ');

    await runProcess('powershell', ['-NoProfile', '-NonInteractive', '-Command', command]);
    return;
  }

  await runFirstAvailable([
    { command: 'paplay', args: [filePath] },
    { command: 'aplay', args: [filePath] },
    { command: 'ffplay', args: ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath] },
    { command: 'mpg123', args: [filePath] }
  ]);
}

async function runFirstAvailable(commands: Array<{ command: string; args: string[] }>): Promise<void> {
  const errors: string[] = [];

  for (const item of commands) {
    try {
      await runProcess(item.command, item.args);
      return;
