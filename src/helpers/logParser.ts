/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { pathExists } from "./pathUtils";
import { LogItem } from "../logItem";

// Returns the appropriate icon for the given log level.
export function getIconForLogLevel(level: string): vscode.ThemeIcon {
  switch (level.toUpperCase()) {
    case "CRITICAL":
      return new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("magentoLogViewer.criticalColor"),
      );
    case "ERROR":
      return new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("magentoLogViewer.errorColor"),
      );
    case "WARN":
      return new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("magentoLogViewer.warningColor"),
      );
    case "DEBUG":
      return new vscode.ThemeIcon(
        "debug",
        new vscode.ThemeColor("magentoLogViewer.debugColor"),
      );
    case "INFO":
      return new vscode.ThemeIcon(
        "info",
        new vscode.ThemeColor("magentoLogViewer.infoColor"),
      );
    default:
      return new vscode.ThemeIcon("circle-outline");
  }
}

export function getLogItems(
  dir: string,
  parseTitle: (filePath: string) => string,
  getIcon: (filePath: string) => vscode.ThemeIcon,
): LogItem[] {
  if (!pathExists(dir)) {
    return [];
  }

  const items: LogItem[] = [];
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      const subItems = getLogItems(filePath, parseTitle, getIcon);
      if (subItems.length > 0) {
        items.push(...subItems);
      }
    } else if (fs.lstatSync(filePath).isFile()) {
      const title = parseTitle(filePath);
      const logFile = new LogItem(title, vscode.TreeItemCollapsibleState.None, {
        command: "magento-log-viewer.openFile",
        title: "Open Log File",
        arguments: [filePath],
      });
      logFile.iconPath = getIcon(filePath);
      items.push(logFile);
    }
  });

  return items;
}

// Precompiled regular expression for timestamps
const timestampRegex =
  /(\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}\])/;

// Formats a timestamp from ISO format to localized user format
export function formatTimestamp(timestamp: string): string {
  try {
    // Look for Magento log timestamp pattern: [2025-05-27T19:42:17.646000+00:00]
    const match = timestamp.match(timestampRegex);

    if (!match || !match[1]) {
      return timestamp; // Return original if no timestamp format matches
    }

    // Extract the timestamp without brackets
    const dateTimeStr = match[1].substring(1, match[1].length - 1);

    try {
      const date = new Date(dateTimeStr);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timestamp; // Return original if date parsing failed
      }

      // Format the date according to user's locale
      const localizedTimestamp = date.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Replace the ISO timestamp with the localized one
      return timestamp.replace(match[1], `[${localizedTimestamp}]`);
    } catch (parseError) {
      console.error("Error parsing date:", parseError);
      return timestamp; // Return original on date parsing error
    }
  } catch (error) {
    console.error(
      "Failed to format timestamp:",
      error instanceof Error ? error.message : String(error),
    );
    return timestamp; // Return original on error
  }
}
