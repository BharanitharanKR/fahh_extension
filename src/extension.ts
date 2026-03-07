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
