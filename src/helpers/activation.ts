/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { showInformationMessage } from "./messages";
import {
  openFile,
  handleOpenFileWithoutPathAsync,
  clearAllLogFiles,
  clearAllReportFiles,
  deleteReportFile,
} from "./files";
import {
  autoCleanupOldLogFiles,
  startPeriodicCleanup,
  stopPeriodicCleanup,
  updatePeriodicCleanupContext,
} from "./cleanup";
import { updateBadge } from "./badge";
import { invalidateFileCache } from "./caching";
import { isValidPath } from "./pathUtils";
import { LogViewerProvider, ReportViewerProvider } from "../logViewer";

// Activates the extension by setting up the log viewer and file system watcher.
export function activateExtension(
  context: vscode.ExtensionContext,
  magentoRoot: string,
  reportViewerProvider: ReportViewerProvider,
): LogViewerProvider | null {
  if (!magentoRoot || !isValidPath(magentoRoot)) {
    vscode.window
      .showErrorMessage(
        "Magento root path is not set or is not a directory.",
        "Open Settings",
      )
      .then((selection) => {
        if (selection === "Open Settings") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "magentoLogViewer",
          );
        }
      });
    return null;
  }

  const logViewerProvider = new LogViewerProvider(magentoRoot);

  const logTreeView = vscode.window.createTreeView("logFiles", {
    treeDataProvider: logViewerProvider,
  });
  const reportTreeView = vscode.window.createTreeView("reportFiles", {
    treeDataProvider: reportViewerProvider,
  });

  // Set tree view reference for auto-scroll in tailing
  logViewerProvider.setTreeView(logTreeView);

  registerCommands(
    context,
    logViewerProvider,
    reportViewerProvider,
    magentoRoot,
  );
  context.subscriptions.push(logTreeView, reportTreeView);

  updateBadge(
    logTreeView,
    logViewerProvider,
    reportViewerProvider,
    magentoRoot,
  );

  const logPath = path.join(magentoRoot, "var", "log");
  const reportPath = path.join(magentoRoot, "var", "report");

  const logWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(logPath, "*"),
  );
  logWatcher.onDidChange((uri) => {
    invalidateFileCache(uri.fsPath);
    logViewerProvider.refresh();
    logViewerProvider.checkFileForAlerts(uri.fsPath).catch(console.error);
  });
  logWatcher.onDidCreate(() => logViewerProvider.refresh());
  logWatcher.onDidDelete(() => logViewerProvider.refresh());

  const reportWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(reportPath, "*"),
  );
  reportWatcher.onDidChange((uri) => {
    invalidateFileCache(uri.fsPath);
    reportViewerProvider.refresh();
  });
  reportWatcher.onDidCreate(() => reportViewerProvider.refresh());
  reportWatcher.onDidDelete(() => reportViewerProvider.refresh());

  context.subscriptions.push(logWatcher, reportWatcher);

  // Run automatic cleanup on activation (silently in background)
  setTimeout(async () => {
    console.log(
      "[Magento Log Viewer] Running initial cleanup after activation...",
    );
    try {
      await autoCleanupOldLogFiles(magentoRoot, false); // false = no UI notifications

      // Refresh providers after cleanup to update the UI
      logViewerProvider.refresh();
      reportViewerProvider.refresh();
      console.log("[Magento Log Viewer] Initial cleanup completed");
    } catch (error) {
      console.error(
        "[Magento Log Viewer] Error during automatic log cleanup on startup:",
        error,
      );
    }
  }, 2000); // Wait 2 seconds after activation to avoid interfering with startup

  // Start periodic cleanup if enabled
  startPeriodicCleanup(
    context,
    magentoRoot,
    logViewerProvider,
    reportViewerProvider,
  );

  // Watch for configuration changes to restart periodic cleanup
  const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration("magentoLogViewer.enablePeriodicCleanup") ||
      event.affectsConfiguration("magentoLogViewer.periodicCleanupInterval")
    ) {
      startPeriodicCleanup(
        context,
        magentoRoot,
        logViewerProvider,
        reportViewerProvider,
      );
      updatePeriodicCleanupContext();
    }

    if (event.affectsConfiguration("magentoLogViewer.enableAutoCleanup")) {
      updatePeriodicCleanupContext();
    }
  });
  context.subscriptions.push(configWatcher);

  // Return the logViewerProvider so it can be used for tailing
  return logViewerProvider;
}

// Registers commands for the extension.
export function registerCommands(
  context: vscode.ExtensionContext,
  logViewerProvider: LogViewerProvider,
  reportViewerProvider: ReportViewerProvider,
  magentoRoot: string,
): void {
  const commands = [];

  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.refreshLogFiles",
      () => {
        logViewerProvider.refresh();
        vscode.window.showInformationMessage("✅ Log files refreshed");
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.refreshReportFiles",
      () => {
        reportViewerProvider.refresh();
        vscode.window.showInformationMessage("✅ Report files refreshed");
      },
    ),
  );

  // Register manual cleanup command
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.cleanupOldLogFiles",
      async () => {
        const result = await autoCleanupOldLogFiles(magentoRoot, true);

        // Refresh providers after cleanup to update the UI
        if (result.deletedCount > 0) {
          logViewerProvider.refresh();
          reportViewerProvider.refresh();
        }
      },
    ),
  );

  // Search commands
  commands.push(
    vscode.commands.registerCommand("magento-log-viewer.searchLogs", () =>
      logViewerProvider.searchInLogs(),
    ),
  );
  commands.push(
    vscode.commands.registerCommand("magento-log-viewer.clearSearch", () =>
      logViewerProvider.clearSearch(),
    ),
  );
  commands.push(
    vscode.commands.registerCommand("magento-log-viewer.searchReports", () =>
      reportViewerProvider.searchInReports(),
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.clearSearchReports",
      () => reportViewerProvider.clearSearch(),
    ),
  );

  // Improved command registration for openFile
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.openFile",
      async (filePath: string | unknown, lineNumber?: number) => {
        // If filePath is not a string, show a selection box with available log files
        if (typeof filePath !== "string") {
          await handleOpenFileWithoutPathAsync(magentoRoot);
          return;
        }

        openFile(filePath, lineNumber);
      },
    ),
  );

  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.openFileAtLine",
      (filePath: string, lineNumber: number) => {
        openFile(filePath, lineNumber);
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.clearAllLogFiles",
      () => {
        clearAllLogFiles(logViewerProvider, magentoRoot);
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.clearAllLogFilesAuto",
      () => {
        clearAllLogFiles(logViewerProvider, magentoRoot);
      },
    ),
  );
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.clearAllReportFiles",
      () => {
        clearAllReportFiles(reportViewerProvider, magentoRoot);
      },
    ),
  );

  // Register periodic cleanup management commands
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.togglePeriodicCleanup",
      async () => {
        const workspaceUri =
          vscode.workspace.workspaceFolders?.[0]?.uri || null;
        const config = vscode.workspace.getConfiguration(
          "magentoLogViewer",
          workspaceUri,
        );
        const currentlyEnabled = config.get<boolean>(
          "enablePeriodicCleanup",
          false,
        );

        await config.update(
          "enablePeriodicCleanup",
          !currentlyEnabled,
          vscode.ConfigurationTarget.Workspace,
        );

        if (!currentlyEnabled) {
          startPeriodicCleanup(
            context,
            magentoRoot,
            logViewerProvider,
            reportViewerProvider,
          );
          vscode.window.showInformationMessage(
            "✅ Periodic log cleanup enabled",
          );
        } else {
          stopPeriodicCleanup();
          vscode.window.showInformationMessage(
            "⏹️ Periodic log cleanup disabled",
          );
        }

        // Update context variable
        updatePeriodicCleanupContext();
      },
    ),
  );

  // Register separate enable/disable commands
  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.enablePeriodicCleanup",
      async () => {
        const workspaceUri =
          vscode.workspace.workspaceFolders?.[0]?.uri || null;
        const config = vscode.workspace.getConfiguration(
          "magentoLogViewer",
          workspaceUri,
        );

        await config.update(
          "enablePeriodicCleanup",
          true,
          vscode.ConfigurationTarget.Workspace,
        );
        startPeriodicCleanup(
          context,
          magentoRoot,
          logViewerProvider,
          reportViewerProvider,
        );
        vscode.window.showInformationMessage("✅ Automatic cleanup enabled");
        updatePeriodicCleanupContext();
      },
    ),
  );

  commands.push(
    vscode.commands.registerCommand(
      "magento-log-viewer.disablePeriodicCleanup",
      async () => {
        const workspaceUri =
          vscode.workspace.workspaceFolders?.[0]?.uri || null;
        const config = vscode.workspace.getConfiguration(
          "magentoLogViewer",
          workspaceUri,
        );

        await config.update(
          "enablePeriodicCleanup",
          false,
          vscode.ConfigurationTarget.Workspace,
        );
        stopPeriodicCleanup();
        vscode.window.showInformationMessage("⏹️ Automatic cleanup disabled");
        updatePeriodicCleanupContext();
      },
    ),
  );

  // Register settings command
  commands.push(
    vscode.commands.registerCommand("magento-log-viewer.openSettings", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "magentoLogViewer",
      );
    }),
  );

  // Add all commands to context subscriptions
  context.subscriptions.push(...commands);

  // Initialize context variables
  updatePeriodicCleanupContext();
}
