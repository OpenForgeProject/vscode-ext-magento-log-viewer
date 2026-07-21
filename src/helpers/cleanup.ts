/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";
import { showInformationMessage, showErrorMessage } from "./messages";
import { pathExists } from "./pathUtils";
import { invalidateFileCache } from "./caching";
import { LogViewerProvider, ReportViewerProvider } from "../logViewer";

/**
 * Parses a time duration string like "30min", "2h", "7d", "1w", "3M" into milliseconds
 * @param duration Duration string (e.g., "30min", "2h", "7d")
 * @returns Number of milliseconds or null if invalid
 */
export function parseTimeDuration(duration: string): number | null {
  // Match patterns: 30min, 2h, 7d, 1w, 3M
  const match = duration.match(/^(\d+)(min|[hdwM])$/);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    min: 60 * 1000, // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
    w: 7 * 24 * 60 * 60 * 1000, // weeks
    M: 30 * 24 * 60 * 60 * 1000, // months (approximated as 30 days)
  };

  return value * multipliers[unit as keyof typeof multipliers];
}

/**
 * Checks if a file is older than the specified duration
 * @param filePath Path to the file
 * @param maxAge Duration string (e.g., "30d", "2h")
 * @returns true if file is older than maxAge
 */
export function isFileOlderThan(filePath: string, maxAge: string): boolean {
  try {
    const maxAgeMs = parseTimeDuration(maxAge);
    if (maxAgeMs === null) {
      console.warn(`Invalid time duration format: ${maxAge}`);
      return false;
    }

    const stats = fs.statSync(filePath);
    const fileAge = Date.now() - stats.mtime.getTime();
    return fileAge > maxAgeMs;
  } catch (error) {
    console.error(`Error checking file age for ${filePath}:`, error);
    return false;
  }
}

/**
 * Automatically cleans up old log files based on configuration
 * @param magentoRoot Path to Magento root directory
 * @param showNotifications Whether to show UI notifications
 * @returns Promise with cleanup results
 */
export async function autoCleanupOldLogFiles(
  magentoRoot: string,
  showNotifications: boolean = false,
): Promise<{ deletedCount: number; errors: string[] }> {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );

  const isEnabled = config.get<boolean>("enableAutoCleanup", false);
  const maxAge = config.get<string>("autoCleanupMaxAge", "30d");

  console.log(
    `[Magento Log Viewer] autoCleanupOldLogFiles called - enabled: ${isEnabled}, maxAge: ${maxAge}, magentoRoot: ${magentoRoot}`,
  );

  if (!isEnabled) {
    if (showNotifications) {
      vscode.window.showInformationMessage("Automatic log cleanup is disabled");
    }
    console.log("[Magento Log Viewer] Auto cleanup is disabled, skipping");
    return { deletedCount: 0, errors: [] };
  }

  // Validate duration format
  const maxAgeMs = parseTimeDuration(maxAge);
  if (maxAgeMs === null) {
    const error = `Invalid time duration format: ${maxAge}. Use format like 30d, 2h, 1w, 3m`;
    if (showNotifications) {
      vscode.window.showErrorMessage(error);
    }
    return { deletedCount: 0, errors: [error] };
  }

  const logPath = path.join(magentoRoot, "var", "log");

  if (!pathExists(logPath)) {
    const error = "Log directory not found";
    if (showNotifications) {
      vscode.window.showWarningMessage(error);
    }
    return { deletedCount: 0, errors: [error] };
  }

  let deletedCount = 0;
  const errors: string[] = [];

  try {
    const files = await fsPromises.readdir(logPath);

    for (const file of files) {
      const filePath = path.join(logPath, file);

      try {
        const stats = await fsPromises.stat(filePath);

        // Only process actual files (not directories)
        if (!stats.isFile()) {
          continue;
        }

        // Check if file is older than configured age
        if (isFileOlderThan(filePath, maxAge)) {
          await fsPromises.unlink(filePath);
          deletedCount++;

          // Invalidate cache for deleted file
          invalidateFileCache(filePath);

          const fileAgeMs = Date.now() - stats.mtime.getTime();
          const fileAgeDays = Math.round(fileAgeMs / (1000 * 60 * 60 * 24));
          const fileAgeHours = Math.round(fileAgeMs / (1000 * 60 * 60));
          console.log(
            `Auto-deleted old log file: ${file} (age: ${fileAgeDays} days / ${fileAgeHours} hours)`,
          );
        }
      } catch (fileError) {
        const errorMsg = `Failed to process ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    // Show result notifications if requested
    if (showNotifications) {
      if (deletedCount > 0) {
        vscode.window.showInformationMessage(
          `✅ Deleted ${deletedCount} old log file(s) (older than ${maxAge})`,
        );
      } else if (errors.length === 0) {
        vscode.window.showInformationMessage(
          `No log files older than ${maxAge} found`,
        );
      }
    }

    if (errors.length > 0 && showNotifications) {
      vscode.window.showWarningMessage(
        `Cleanup completed with ${errors.length} error(s). Check console for details.`,
      );
    }
  } catch (error) {
    const errorMsg = `Failed to read log directory: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    if (showNotifications) {
      vscode.window.showErrorMessage(errorMsg);
    }
  }

  return { deletedCount, errors };
}

// Global variable to store the periodic cleanup timer
let periodicCleanupTimer: NodeJS.Timeout | null = null;

/**
 * Starts or restarts periodic cleanup based on current configuration
 * @param context VS Code extension context
 * @param magentoRoot Path to Magento root directory
 * @param logViewerProvider Log viewer provider for UI updates
 * @param reportViewerProvider Report viewer provider for UI updates
 */
export function startPeriodicCleanup(
  context: vscode.ExtensionContext,
  magentoRoot: string,
  logViewerProvider: LogViewerProvider,
  reportViewerProvider: ReportViewerProvider,
): void {
  // Stop any existing periodic cleanup
  stopPeriodicCleanup();

  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );

  const isEnabled = config.get<boolean>("enablePeriodicCleanup", false);
  const interval = config.get<string>("periodicCleanupInterval", "1h");

  if (!isEnabled) {
    console.log("[Magento Log Viewer] Periodic cleanup is disabled");
    return;
  }

  // Parse interval to milliseconds
  const intervalMs = parsePeriodicInterval(interval);
  if (intervalMs === null) {
    console.error(`Invalid periodic cleanup interval: ${interval}`);
    return;
  }

  console.log(
    `[Magento Log Viewer] Starting periodic log cleanup every ${interval} (${intervalMs}ms)`,
  );

  // Set up periodic cleanup
  periodicCleanupTimer = setInterval(async () => {
    console.log(`[Magento Log Viewer] Running periodic cleanup check...`);
    try {
      const result = await autoCleanupOldLogFiles(magentoRoot, false); // Silent cleanup

      if (result.deletedCount > 0) {
        console.log(
          `[Magento Log Viewer] Periodic cleanup: Deleted ${result.deletedCount} old log file(s)`,
        );

        // Refresh UI after cleanup
        logViewerProvider.refresh();
        reportViewerProvider.refresh();
      } else {
        console.log(
          `[Magento Log Viewer] Periodic cleanup: No old files to delete`,
        );
      }

      if (result.errors.length > 0) {
        console.error(
          `[Magento Log Viewer] Periodic cleanup errors: ${result.errors.join(", ")}`,
        );
      }
    } catch (error) {
      console.error(
        "[Magento Log Viewer] Error during periodic log cleanup:",
        error,
      );
    }
  }, intervalMs);

  // Add cleanup timer to context subscriptions for proper disposal
  context.subscriptions.push({
    dispose: () => stopPeriodicCleanup(),
  });
}

/**
 * Stops the periodic cleanup timer
 */
export function stopPeriodicCleanup(): void {
  if (periodicCleanupTimer) {
    clearInterval(periodicCleanupTimer);
    periodicCleanupTimer = null;
    console.log("Stopped periodic log cleanup");
  }
}

/**
 * Parses periodic cleanup interval string to milliseconds
 * @param interval Interval string (e.g., "5min", "1h", "24h")
 * @returns Number of milliseconds or null if invalid
 */
function parsePeriodicInterval(interval: string): number | null {
  const validIntervals: Record<string, number> = {
    "5min": 5 * 60 * 1000,
    "10min": 10 * 60 * 1000,
    "15min": 15 * 60 * 1000,
    "30min": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  };

  return validIntervals[interval] || null;
}

/**
 * Updates the context variable for periodic cleanup status
 */
export function updatePeriodicCleanupContext(): void {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );
  const isPeriodicEnabled = config.get<boolean>("enablePeriodicCleanup", false);
  const isAutoEnabled = config.get<boolean>("enableAutoCleanup", false);

  vscode.commands.executeCommand(
    "setContext",
    "magentoLogViewer.periodicCleanupEnabled",
    isPeriodicEnabled,
  );
  vscode.commands.executeCommand(
    "setContext",
    "magentoLogViewer.autoCleanupEnabled",
    isAutoEnabled,
  );
}
