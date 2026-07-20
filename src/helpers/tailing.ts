/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";
import { pathExistsAsync } from "./pathUtils";

/**
 * Interface for tracked file position data
 */
interface TailedFileInfo {
  position: number; // Current byte offset in file
  lastLineNumber: number; // Last processed line number
  buffer: string; // Buffer for partial line reads
  filePath: string; // Full path to the file
  fileName: string; // Display name
}

/**
 * Manages real-time log file tailing with incremental reading
 */
export class TailingManager implements vscode.Disposable {
  private tailedFiles = new Map<string, TailedFileInfo>();
  private updateTimer: NodeJS.Timeout | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly MAX_TAILED_FILES = 5; // Safety limit
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

  /**
   * Starts tailing a log file
   */
  public async startTailing(filePath: string): Promise<boolean> {
    if (this.tailedFiles.has(filePath)) {
      return true; // Already tailing
    }

    if (this.tailedFiles.size >= this.MAX_TAILED_FILES) {
      vscode.window.showWarningMessage(
        `Maximum ${this.MAX_TAILED_FILES} files can be tailed simultaneously`,
      );
      return false;
    }

    try {
      // Check file exists and get initial position
      if (!(await pathExistsAsync(filePath))) {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
        return false;
      }

      const stats = await fsPromises.stat(filePath);

      // Warn for very large files
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

      // Initialize file tracking
      const fileName = path.basename(filePath);
      this.tailedFiles.set(filePath, {
        position: stats.size, // Start from end of file
        lastLineNumber: 0,
        buffer: "",
        filePath,
        fileName,
      });

      // Start update timer if not already running
      if (!this.isActive) {
        this.startUpdateTimer();
      }

      vscode.window.showInformationMessage(`📡 Started tailing: ${fileName}`);
      this.updateContext();

      // Notify state change for UI update
      this.onTailingStateChanged?.();

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to start tailing: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Stops tailing a specific file
   */
  public stopTailing(filePath: string): void {
    if (this.tailedFiles.delete(filePath)) {
      const fileName = path.basename(filePath);
      vscode.window.showInformationMessage(`⏹️ Stopped tailing: ${fileName}`);

      // Stop timer if no more files are being tailed
      if (this.tailedFiles.size === 0 && this.updateTimer) {
        this.stopUpdateTimer();
      }

      this.updateContext();

      // Notify state change for UI update
      this.onTailingStateChanged?.();
    }
  }

  /**
   * Stops tailing all files
   */
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

    // Notify state change for UI update
    this.onTailingStateChanged?.();
  }

  /**
   * Checks if a file is currently being tailed
   */
  public isTailing(filePath: string): boolean {
    return this.tailedFiles.has(filePath);
  }

  /**
   * Gets list of currently tailed files
   */
  public getTailedFiles(): string[] {
    return Array.from(this.tailedFiles.keys());
  }

  /**
   * Reads new content from file since last position
   */
  private async readFileFromPosition(
    filePath: string,
    fromPosition: number,
  ): Promise<{ content: string; newPosition: number } | null> {
    try {
      const stats = await fsPromises.stat(filePath);

      // File hasn't grown
      if (stats.size <= fromPosition) {
        return { content: "", newPosition: fromPosition };
      }

      // File was truncated (rotated/cleared)
      if (stats.size < fromPosition) {
        return { content: "", newPosition: 0 };
      }

      // Read new content
      const bytesToRead = stats.size - fromPosition;
      const buffer = Buffer.alloc(bytesToRead);
      const fd = await fsPromises.open(filePath, "r");

      try {
        const { bytesRead } = await fd.read(
          buffer,
          0,
          bytesToRead,
          fromPosition,
        );
        const content = buffer.toString("utf-8", 0, bytesRead);

        return {
          content,
          newPosition: fromPosition + bytesRead,
        };
      } finally {
        await fd.close();
      }
    } catch (error) {
      console.error(`Error reading file from position ${fromPosition}:`, error);
      return null;
    }
  }

  /**
   * Processes new content and extracts complete lines
   */
  private processNewContent(
    fileInfo: TailedFileInfo,
    newContent: string,
  ): string[] {
    if (!newContent) {
      return [];
    }

    // Combine with buffer from previous partial line
    const fullContent = fileInfo.buffer + newContent;
    const lines = fullContent.split("\n");

    // Last line might be incomplete, save to buffer
    fileInfo.buffer = lines.pop() || "";

    return lines;
  }

  /**
   * Starts the periodic update timer
   */
  private startUpdateTimer(): void {
    if (this.updateTimer) {
      return; // Already running
    }

    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration(
      "magentoLogViewer",
      workspaceUri,
    );
    const interval = config.get<string>("tailingUpdateInterval", "500ms");

    const intervalMs = this.parseUpdateInterval(interval);

    this.isActive = true;
    this.updateTimer = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);

    console.log(
      `Tailing update timer started with interval: ${interval} (${intervalMs}ms)`,
    );
  }

  /**
   * Stops the periodic update timer
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      this.isActive = false;
      console.log("Tailing update timer stopped");
    }
  }

  /**
   * Checks all tailed files for updates
   */
  private async checkForUpdates(): Promise<void> {
    const updatePromises: Promise<void>[] = [];

    for (const [filePath, fileInfo] of this.tailedFiles.entries()) {
      updatePromises.push(this.checkFileUpdate(filePath, fileInfo));
    }

    // Process all files in parallel (with small delay to avoid overwhelming system)
    await Promise.all(updatePromises);
  }

  /**
   * Checks a single file for updates
   */
  private async checkFileUpdate(
    filePath: string,
    fileInfo: TailedFileInfo,
  ): Promise<void> {
    try {
      const result = await this.readFileFromPosition(
        filePath,
        fileInfo.position,
      );

      if (!result) {
        // Error reading file, might have been deleted
        this.stopTailing(filePath);
        return;
      }

      if (result.content) {
        const newLines = this.processNewContent(fileInfo, result.content);

        if (newLines.length > 0) {
          // Update position
          fileInfo.position = result.newPosition;

          // Notify callback with new lines (await for auto-scroll)
          await this.onNewEntriesCallback(
            filePath,
            newLines,
            fileInfo.lastLineNumber,
          );

          // Update line counter
          fileInfo.lastLineNumber += newLines.length;
        }
      }

      // Update position even if no new lines (file grew but no complete line yet)
      fileInfo.position = result.newPosition;
    } catch (error) {
      console.error(`Error checking file update for ${filePath}:`, error);
    }
  }

  /**
   * Parses update interval string to milliseconds
   */
  private parseUpdateInterval(interval: string): number {
    const intervals: Record<string, number> = {
      instant: 100,
      "250ms": 250,
      "500ms": 500,
      "1s": 1000,
      "2s": 2000,
    };

    return intervals[interval] || 500; // Default 500ms
  }

  /**
   * Updates VS Code context for UI visibility
   */
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

  /**
   * Saves tailed files state to workspace
   */
  private async saveState(): Promise<void> {
    const state = Array.from(this.tailedFiles.entries()).map(
      ([path, info]) => ({
        filePath: path,
        position: info.position,
        lastLineNumber: info.lastLineNumber,
      }),
    );

    await this.context.workspaceState.update("tailedFiles", state);
  }

  /**
   * Restores tailed files state from workspace
   */
  public async restoreState(): Promise<void> {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration(
      "magentoLogViewer",
      workspaceUri,
    );
    const persistAcrossSessions = config.get<boolean>(
      "tailingPersistAcrossSessions",
      false,
    );

    if (!persistAcrossSessions) {
      return;
    }

    const state =
      this.context.workspaceState.get<
        Array<{ filePath: string; position: number; lastLineNumber: number }>
      >("tailedFiles");

    if (state && state.length > 0) {
      for (const item of state) {
        await this.startTailing(item.filePath);
      }

      vscode.window.showInformationMessage(
        `📡 Restored tailing for ${state.length} file(s)`,
      );
    }
  }

  /**
   * Cleanup on disposal
   */
  dispose(): void {
    this.saveState().catch((error) => {
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
