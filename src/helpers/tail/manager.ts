/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { pathExistsAsync } from "../pathUtils";
import { TailedFileInfo } from "./types";
import { readFileFromPosition, processNewContent } from "./reading";
import { getUpdateIntervalMs } from "./timer";
import {
  saveTailedFilesState,
  restoreTailedFilesState,
} from "./state";

export class TailingManager implements vscode.Disposable {
  private tailedFiles = new Map<string, TailedFileInfo>();
  private updateTimer: NodeJS.Timeout | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly MAX_TAILED_FILES = 5;
  private isActive = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onNewEntriesCallback: (
      filePath: string,
      newLines: string[],
      startLine: number,
    ) => Promise<void>,
    private readonly onTailingStateChanged?: () => void,
  ) {}

  public async startTailing(filePath: string): Promise<boolean> {
    if (this.tailedFiles.has(filePath)) {
      return true;
    }

    if (this.tailedFiles.size >= this.MAX_TAILED_FILES) {
      vscode.window.showWarningMessage(
        `Maximum ${this.MAX_TAILED_FILES} files can be tailed simultaneously`,
      );
      return false;
    }

    try {
      if (!(await pathExistsAsync(filePath))) {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
        return false;
      }

      const stats = await import("fs").then((fs) =>
        fs.promises.stat(filePath),
      );
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > 100) {
        const proceed = await vscode.window.showWarningMessage(
          `File is ${fileSizeMB.toFixed(1)}MB. Tailing may impact performance. Continue?`,
          "Yes",
          "No",
        );
        if (proceed !== "Yes") {
          return false;
        }
      }

      const fileName = path.basename(filePath);
      this.tailedFiles.set(filePath, {
        position: stats.size,
        lastLineNumber: 0,
        buffer: "",
        filePath,
        fileName,
      });

      if (!this.isActive) {
        this.startUpdateTimer();
      }

      vscode.window.showInformationMessage(`📡 Started tailing: ${fileName}`);
      this.updateContext();
      this.onTailingStateChanged?.();

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to start tailing: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  public stopTailing(filePath: string): void {
    if (this.tailedFiles.delete(filePath)) {
      const fileName = path.basename(filePath);
      vscode.window.showInformationMessage(`⏹️ Stopped tailing: ${fileName}`);

      if (this.tailedFiles.size === 0 && this.updateTimer) {
        this.stopUpdateTimer();
      }

      this.updateContext();
      this.onTailingStateChanged?.();
    }
  }

  public stopAllTailing(): void {
    const count = this.tailedFiles.size;
    this.tailedFiles.clear();
    this.stopUpdateTimer();

    if (count > 0) {
      vscode.window.showInformationMessage(
        `⏹️ Stopped tailing ${count} file(s)`,
      );
    }

    this.updateContext();
    this.onTailingStateChanged?.();
  }

  public isTailing(filePath: string): boolean {
    return this.tailedFiles.has(filePath);
  }

  public getTailedFiles(): string[] {
    return Array.from(this.tailedFiles.keys());
  }

  public async restoreState(): Promise<void> {
    return restoreTailedFilesState(this.context, (filePath) =>
      this.startTailing(filePath),
    );
  }

  private startUpdateTimer(): void {
    if (this.updateTimer) {
      return;
    }

    const intervalMs = getUpdateIntervalMs();
    this.isActive = true;
    this.updateTimer = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);

    console.log(
      `Tailing update timer started with interval: ${intervalMs}ms`,
    );
  }

  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      this.isActive = false;
      console.log("Tailing update timer stopped");
    }
  }

  private async checkForUpdates(): Promise<void> {
    const CONCURRENCY_LIMIT = 3;
    const entries = Array.from(this.tailedFiles.entries());

    for (let i = 0; i < entries.length; i += CONCURRENCY_LIMIT) {
      const batch = entries.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(
        batch.map(([filePath, fileInfo]) =>
          this.checkFileUpdate(filePath, fileInfo),
        ),
      );
    }
  }

  private async checkFileUpdate(
    filePath: string,
    fileInfo: TailedFileInfo,
  ): Promise<void> {
    try {
      const result = await readFileFromPosition(filePath, fileInfo.position);

      if (!result) {
        this.stopTailing(filePath);
        return;
      }

      if (result.content) {
        const newLines = processNewContent(fileInfo, result.content);

        if (newLines.length > 0) {
          fileInfo.position = result.newPosition;
          await this.onNewEntriesCallback(
            filePath,
            newLines,
            fileInfo.lastLineNumber,
          );
          fileInfo.lastLineNumber += newLines.length;
        }
      }

      fileInfo.position = result.newPosition;
    } catch (error) {
      console.error(`Error checking file update for ${filePath}:`, error);
    }
  }

  private updateContext(): void {
    const hasTailedFiles = this.tailedFiles.size > 0;
    vscode.commands.executeCommand(
      "setContext",
      "magentoLogViewer.hasTailedFiles",
      hasTailedFiles,
    );
    vscode.commands.executeCommand(
      "setContext",
      "magentoLogViewer.tailingActive",
      this.isActive,
    );
  }

  dispose(): void {
    saveTailedFilesState(this.context, this.tailedFiles).catch((error) => {
      console.error("Error saving tailing state:", error);
    });

    this.stopAllTailing();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
