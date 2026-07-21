/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";
import { BaseLogProvider } from "./baseLogProvider";
import { pathExists, pathExistsAsync } from "../helpers/pathUtils";
import { getCachedFileContent, countLogEntriesAsync } from "../helpers/caching";
import { TailingManager } from "../helpers/tailing";
import { LogItem } from "../logItem";
import { groupLogEntries } from "./logGrouping";
import { LogTailingController } from "./logTailing";
import { LogNotificationController } from "./logNotifications";

export class LogViewerProvider extends BaseLogProvider {
  public static statusBarItem: vscode.StatusBarItem | undefined;
  private tailingController = new LogTailingController(this);
  private notificationController = new LogNotificationController(
    this.workspaceRoot,
  );

  constructor(workspaceRoot: string) {
    super(workspaceRoot);

    if (!LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
      );
      LogViewerProvider.statusBarItem.command =
        "magento-log-viewer.refreshLogFiles";
      LogViewerProvider.statusBarItem.show();
    }

    this.updateRefreshButtonVisibility();
    this.initializeAsync();
  }

  public setTreeView(treeView: vscode.TreeView<LogItem>): void {
    this.tailingController.setTreeView(treeView);
  }

  public setTailingManager(tailingManager: TailingManager): void {
    this.tailingController.setTailingManager(tailingManager);
  }

  private isTailing(filePath: string): boolean {
    return this.tailingController.isTailing(filePath);
  }

  protected onInitializationComplete(): void {
    this.updateBadgeAsync().catch(console.error);
  }

  updateRefreshButtonVisibility(): void {
    vscode.commands.executeCommand(
      "setContext",
      "magentoLogViewer.hasMagentoRoot",
      !!this.workspaceRoot,
    );
    vscode.commands.executeCommand(
      "setContext",
      "magentoLogViewer.hasActiveSearch",
      !!this.searchTerm,
    );
  }

  public async searchInLogs(): Promise<void> {
    const searchOptions = await vscode.window.showInputBox({
      prompt: "Search in log entries...",
      placeHolder: "Enter search term (supports regex if enabled in settings)",
      value: this.searchTerm,
    });

    if (searchOptions !== undefined) {
      this.searchTerm = searchOptions;
      this.cachedSearchRegex = null;
      this.lastSearchTerm = "";
      this.lastSearchFlags = "";
      this.updateRefreshButtonVisibility();
      this.refresh();

      if (this.searchTerm) {
        vscode.window.showInformationMessage(
          `Searching for: "${this.searchTerm}"`,
        );
      }
    }
  }

  refresh(specificFilePath?: string): void {
    super.refresh(specificFilePath);
    this.updateBadgeAsync().catch(console.error);
  }

  public async appendNewEntries(
    filePath: string,
    newLines: string[],
    startLineNumber: number,
  ): Promise<void> {
    return this.tailingController.appendNewEntries(
      filePath,
      newLines,
      startLineNumber,
    );
  }

  public async checkFileForAlerts(filePath: string): Promise<void> {
    return this.notificationController.checkFileForAlerts(filePath);
  }

  public notifyNewErrors(fileName: string, count: number): void {
    this.notificationController.notifyNewErrors(fileName, count);
  }

  public checkAlertPatterns(fileName: string, lines: string[]): void {
    this.notificationController.checkAlertPatterns(fileName, lines);
  }

  getTreeItem(element: LogItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LogItem): Thenable<LogItem[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([
        new LogItem(
          "Magento root not configured. Run: Select Root Folder",
          vscode.TreeItemCollapsibleState.None,
        ),
      ]);
    }

    if (!this.isInitialized) {
      return Promise.resolve([
        new LogItem(
          "Loading log files...",
          vscode.TreeItemCollapsibleState.None,
        ),
      ]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      return new Promise((resolve) => {
        this.getLogItemsAsync(this.workspaceRoot)
          .then((logItems) => {
            resolve(logItems);
          })
          .catch((error: Error) => {
            console.error("Error getting log children:", error);
            resolve([
              new LogItem(
                "Error loading log files",
                vscode.TreeItemCollapsibleState.None,
              ),
            ]);
          });
      });
    }
  }

  private async getLogItemsAsync(workspaceRoot: string): Promise<LogItem[]> {
    const logPath = path.join(workspaceRoot, "var", "log");

    if (!(await pathExistsAsync(logPath))) {
      return [
        new LogItem(`No items found`, vscode.TreeItemCollapsibleState.None),
      ];
    }

    try {
      const files = await fsPromises.readdir(logPath);
      if (files.length === 0) {
        return [
          new LogItem(`No items found`, vscode.TreeItemCollapsibleState.None),
        ];
      }

      const items: LogItem[] = [];
      const batchSize = 5;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        const batchPromises = batch.map(async (file) => {
          const filePath = path.join(logPath, file);

          try {
            const stats = await fsPromises.stat(filePath);
            if (!stats.isFile()) {
              return null;
            }

            const children = this.getLogFileLines(filePath);

            let logEntryCount = 0;
            try {
              logEntryCount = await countLogEntriesAsync(filePath);
            } catch (error) {
              console.error(`Error counting entries in ${filePath}:`, error);
              logEntryCount = children.reduce((total, level) => {
                const match = level.label.match(/\((\d+)(?:,\s*grouped)?\)/);
                return total + (match ? parseInt(match[1], 10) : 0);
              }, 0);
            }

            const displayCount = logEntryCount > 0 ? logEntryCount : 0;
            const isTailingActive = this.isTailing(filePath);
            const label = isTailingActive
              ? `${file} (${displayCount}) 📡 Live`
              : `${file} (${displayCount})`;

            const logFile = new LogItem(
              label,
              displayCount > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
              {
                command: "magento-log-viewer.openFile",
                title: "Open Log File",
                arguments: [filePath],
              },
            );
            logFile.iconPath = isTailingActive
              ? new vscode.ThemeIcon(
                  "broadcast",
                  new vscode.ThemeColor("charts.green"),
                )
              : new vscode.ThemeIcon("file");
            logFile.children = displayCount > 0 ? children : [];
            logFile.contextValue = isTailingActive
              ? "logItem-tailing"
              : "logItem";
            return logFile;
          } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        items.push(...(batchResults.filter(Boolean) as LogItem[]));

        if (i + batchSize < files.length) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }

      return items;
    } catch (error) {
      console.error(`Error reading directory ${logPath}:`, error);
      return [
        new LogItem(
          "Error loading log files",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }
  }

  public getLogFileLines(filePath: string): LogItem[] {
    const fileContent = getCachedFileContent(filePath);
    if (!fileContent) {
      return [];
    }

    const lines = fileContent.split("\n");
    return this.groupLogEntries(lines, filePath);
  }

  public groupLogEntries(lines: string[], filePath: string): LogItem[] {
    return groupLogEntries(
      this.groupByMessage,
      this.matchesSearchTerm.bind(this),
      lines,
      filePath,
    );
  }

  async getLogFilesWithoutUpdatingBadge(dir: string): Promise<LogItem[]> {
    if (!pathExists(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    const items = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dir, file);
        if (!fs.lstatSync(filePath).isFile()) {
          return null;
        }

        let logEntryCount = 0;
        try {
          logEntryCount = await countLogEntriesAsync(filePath);
        } catch (error) {
          console.error(`Error counting entries in ${filePath}:`, error);
        }

        return new LogItem(
          `${file} (${logEntryCount})`,
          vscode.TreeItemCollapsibleState.None,
          {
            command: "magento-log-viewer.openFile",
            title: "Open Log File",
            arguments: [filePath],
          },
        );
      }),
    );

    return items.filter(Boolean) as LogItem[];
  }

  private async updateBadgeAsync(): Promise<void> {
    const logPath = path.join(this.workspaceRoot, "var", "log");
    const logFiles = await this.getLogFilesWithoutUpdatingBadge(logPath);
    const totalEntries = logFiles.reduce(
      (count, file) => count + (file.entryCount || 0),
      0,
    );

    const searchInfo = this.searchTerm ? ` | Search: "${this.searchTerm}"` : "";
    if (LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem.text = `Magento Log-Entries: ${totalEntries}${searchInfo}`;
    }
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
    if (LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem.dispose();
      LogViewerProvider.statusBarItem = undefined;
    }
    this.cachedSearchRegex = null;
    this.lastSearchTerm = "";
    this.lastSearchFlags = "";
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
