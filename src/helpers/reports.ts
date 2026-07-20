/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { getReportContent } from "./caching";

export function parseReportTitle(filePath: string): string {
  try {
    const report = getReportContent(filePath);
    if (!report) {
      return path.basename(filePath);
    }

    if (filePath.includes("/api/")) {
      const folderName = path.basename(path.dirname(filePath));
      const capitalizedFolderName =
        folderName.charAt(0).toUpperCase() + folderName.slice(1);
      return `${capitalizedFolderName}: ${String(report)}`;
    }

    // Type guard to check if report is a record type with string keys
    if (report && typeof report === "object" && report !== null) {
      const reportObj = report as Record<string, unknown>;
      if ("0" in reportObj && typeof reportObj["0"] === "string") {
        return reportObj["0"] || path.basename(filePath);
      }
    }

    return path.basename(filePath);
  } catch (error) {
    return path.basename(filePath);
  }
}

export function getIconForReport(filePath: string): vscode.ThemeIcon {
  try {
    const report = getReportContent(filePath);
    if (!report) {
      return new vscode.ThemeIcon("file");
    }

    if (filePath.includes("/api/")) {
      return new vscode.ThemeIcon("warning");
    }

    // Type guard to check if report is a record type with string keys
    if (report && typeof report === "object" && report !== null) {
      const reportObj = report as Record<string, unknown>;
      if (
        "0" in reportObj &&
        typeof reportObj["0"] === "string" &&
        reportObj["0"].toLowerCase().includes("error")
      ) {
        return new vscode.ThemeIcon("error");
      }
    }

    return new vscode.ThemeIcon("file");
  } catch (error) {
    return new vscode.ThemeIcon("file");
  }
}
