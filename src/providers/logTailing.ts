/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { LogItem } from "../logItem";
import { TailingManager } from "../helpers/tailing";

export interface LogTailingDelegate {
  matchesSearchTerm(text: string): boolean;
  checkAlertPatterns(fileName: string, lines: string[]): void;
  notifyNewErrors(fileName: string, count: number): void;
  refresh(specificFilePath?: string): void;
}

export class LogTailingController {
  private treeView: vscode.TreeView<LogItem> | null = null;
  private tailingManager: TailingManager | null = null;

  constructor(private readonly delegate: LogTailingDelegate) {}

  setTreeView(treeView: vscode.TreeView<LogItem>): void {
    this.treeView = treeView;
  }

  setTailingManager(tailingManager: TailingManager): void {
    this.tailingManager = tailingManager;
  }

  isTailing(filePath: string): boolean {
    return this.tailingManager?.isTailing(filePath) ?? false;
  }

  async appendNewEntries(
    filePath: string,
    newLines: string[],
    startLineNumber: number,
  ): Promise<void> {
    this.delegate.checkAlertPatterns(path.basename(filePath), newLines);

    const newEntries = this.parseIncrementalLines(newLines, startLineNumber);

    if (newEntries.length > 0) {
      this.delegate.refresh(filePath);

      const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
      const config = vscode.workspace.getConfiguration(
        "magentoLogViewer",
        workspaceUri,
      );
      const autoScroll = config.get<boolean>("tailingAutoScroll", true);

      if (autoScroll) {
        await this.scrollEditorToEnd(filePath);

        if (this.treeView) {
          try {
            this.treeView.message = undefined;
          } catch (error) {
            console.debug("Auto-scroll tree failed:", error);
          }
        }
      }

      const criticalCount = newEntries.filter(
        (entry) =>
          entry.message.toLowerCase().includes("critical") ||
          entry.message.toLowerCase().includes("error"),
      ).length;

      if (criticalCount > 0) {
        this.delegate.notifyNewErrors(path.basename(filePath), criticalCount);
      }
    }
  }

  private async scrollEditorToEnd(filePath: string): Promise<void> {
    try {
      const targetEditor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri.fsPath === filePath,
      );

      if (targetEditor) {
        const lastLine = targetEditor.document.lineCount - 1;
        const lastCharacter =
          targetEditor.document.lineAt(lastLine).text.length;
        const endPosition = new vscode.Position(lastLine, lastCharacter);
        const endRange = new vscode.Range(endPosition, endPosition);
        targetEditor.revealRange(endRange, vscode.TextEditorRevealType.Default);
      }
    } catch (error) {
      console.debug("Error scrolling editor to end:", error);
    }
  }

  private parseIncrementalLines(
    lines: string[],
    startLineNumber: number,
  ): Array<{ level: string; message: string; lineNumber: number }> {
    const parsedEntries: Array<{
      level: string;
      message: string;
      lineNumber: number;
    }> = [];

    lines.forEach((line, index) => {
      const match = line.match(/\.([A-Za-z]+):/);
      if (match) {
        const level = match[1].toUpperCase();
        const message = line.replace(
          /^\[.*?\]\s*(?:[A-Za-z0-9_]+)?\.[A-Za-z]+:\s*/,
          "",
        );

        if (
          this.delegate.matchesSearchTerm(line) ||
          this.delegate.matchesSearchTerm(message)
        ) {
          parsedEntries.push({
            level,
            message,
            lineNumber: startLineNumber + index,
          });
        }
      }
    });

    return parsedEntries;
  }
}
