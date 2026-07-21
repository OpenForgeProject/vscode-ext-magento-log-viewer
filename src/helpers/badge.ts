/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { pathExists, countFilesInDirectory } from "./pathUtils";
import { LogViewerProvider, ReportViewerProvider } from "../logViewer";

// Cache for badge updates
let lastUpdateTime = 0;
const BADGE_UPDATE_THROTTLE = 1000; // Maximum one update per second

// Updates the badge count for the tree view based on the number of log entries.
export function updateBadge(
  treeView: vscode.TreeView<unknown>,
  logViewerProvider: LogViewerProvider,
  reportViewerProvider: ReportViewerProvider,
  magentoRoot: string,
): void {
  const updateBadgeCount = async () => {
    // Throttling - only update once per second
    const now = Date.now();
    if (now - lastUpdateTime < BADGE_UPDATE_THROTTLE) {
      return;
    }
    lastUpdateTime = now;

    const logPath = path.join(magentoRoot, "var", "log");
    const reportPath = path.join(magentoRoot, "var", "report");

    // Check if directories exist before reading them
    const logFilesExist = pathExists(logPath);
    const reportFilesExist = pathExists(reportPath);

    let totalLogEntries = 0;
    let totalReportFiles = 0;

    if (logFilesExist) {
      const logFiles = await logViewerProvider.getLogFilesWithoutUpdatingBadge(
        logPath,
      );
      totalLogEntries = logFiles.reduce(
        (count, file) => count + (file.entryCount || 0),
        0,
      );
    }

    if (reportFilesExist) {
      // Only count the number of report files, not load their content
      try {
        totalReportFiles = countFilesInDirectory(reportPath);
      } catch (error) {
        console.error("Error counting report files:", error);
      }
    }

    const totalEntries = totalLogEntries + totalReportFiles;
    treeView.badge = {
      value: totalEntries,
      tooltip: `${totalEntries} log and report entries`,
    };

    vscode.commands.executeCommand(
      "setContext",
      "magentoLogViewer.hasLogFiles",
      totalEntries > 0,
    );

    // Update status bar item
    if (LogViewerProvider.statusBarItem) {
      LogViewerProvider.statusBarItem.text = `Magento Log-Entries: ${totalEntries}`;
    }
  };

  // Debounced event handler
  let updateTimeout: NodeJS.Timeout | null = null;
  const debouncedUpdate = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
      updateBadgeCount().catch(console.error);
    }, 200);
  };

  logViewerProvider.onDidChangeTreeData(debouncedUpdate);
  reportViewerProvider.onDidChangeTreeData(debouncedUpdate);
  updateBadgeCount().catch(console.error);

  vscode.commands.executeCommand("setContext", "magentoLogViewerBadge", 0);
}
