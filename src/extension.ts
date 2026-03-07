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

