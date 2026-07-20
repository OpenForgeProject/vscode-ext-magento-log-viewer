/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { BaseLogProvider } from "./baseLogProvider";
import { getLogItems } from "../helpers/logParser";
import { parseReportTitle, getIconForReport } from "../helpers/reports";
import { getCachedFileContent } from "../helpers/caching";
import { LogItem } from "../logItem";

export class ReportViewerProvider extends BaseLogProvider {
  constructor(workspaceRoot: string) {
    super(workspaceRoot);
    this.updateRefreshButtonVisibility();
    this.initializeAsync();
  }

  updateRefreshButtonVisibility(): void {
    vscode.commands.executeCommand(
      "setContext",
      "magentoLogViewer.hasMagentoRoot",
      !!this.workspaceRoot,
    );
    vscode.commands.executeCommand(
      "setContext",
      "magentoLogViewer.hasActiveSearchReports",
      !!this.searchTerm,
    );
  }

  // Search functionality
  public async searchInReports(): Promise<void> {
    const searchOptions = await vscode.window.showInputBox({
      prompt: "Search in report files...",
      placeHolder: "Enter search term (supports regex if enabled in settings)",
      value: this.searchTerm,
    });

    if (searchOptions !== undefined) {
      this.searchTerm = searchOptions;
      // Clear cached regex when search term changes
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

  getTreeItem(element: LogItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LogItem): Thenable<LogItem[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    // Show loading state if not yet initialized
    if (!this.isInitialized) {
      return Promise.resolve([
        new LogItem(
          "Loading report files...",
          vscode.TreeItemCollapsibleState.None,
        ),
      ]);
    }

    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      return new Promise((resolve) => {
        // Use setTimeout to yield control and prevent blocking the UI thread
        setTimeout(() => {
          try {
            const reportPath = path.join(this.workspaceRoot, "var", "report");
            const reportItems = this.getLogItems(reportPath);
            if (reportItems.length === 0) {
              resolve([
                new LogItem(
                  "No report files found",
                  vscode.TreeItemCollapsibleState.None,
                ),
              ]);
            } else {
              resolve(reportItems);
            }
          } catch (error) {
            console.error("Error getting report children:", error);
            resolve([
              new LogItem(
                "Error loading report files",
                vscode.TreeItemCollapsibleState.None,
              ),
            ]);
          }
        }, 0);
      });
    }
  }

  private getLogItems(dir: string): LogItem[] {
    const allItems = getLogItems(dir, parseReportTitle, getIconForReport);

    // Apply search filter
    const filteredItems = allItems
      .filter((item) => {
        if (!this.searchTerm) {
          return true;
        }

        // Search in filename and content
        const filename = item.label;
        const filepath = item.command?.arguments?.[0] as string;

        // Check filename
        if (this.matchesSearchTerm(filename)) {
          return true;
        }

        // Check file content if filepath exists
        if (filepath) {
          try {
            const fileContent = getCachedFileContent(filepath);
            if (fileContent && this.matchesSearchTerm(fileContent)) {
              return true;
            }
          } catch (error) {
            // Ignore file read errors for search
          }
        }

        return false;
      })
      .map((item) => {
        item.contextValue = "reportItem";
        return item;
      });

    const groupedItems = this.groupReportItems(filteredItems);
    return groupedItems;
  }

  private groupReportItems(items: LogItem[]): LogItem[] {
    const groupedByTitle = new Map<string, LogItem[]>();

    items.forEach((item) => {
      const title = item.label;
      const group = groupedByTitle.get(title) || [];
      group.push(item);
      groupedByTitle.set(title, group);
    });

    return Array.from(groupedByTitle.entries()).map(([title, group]) => {
      if (group.length > 1) {
        return new LogItem(
          `${title} (${group.length})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          group,
        );
      } else {
        return group[0];
      }
    });
  }
}
