/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";
import { showInformationMessage, showErrorMessage } from "./messages";
import { pathExists, pathExistsAsync } from "./pathUtils";
import { LogViewerProvider, ReportViewerProvider } from "../logViewer";

// Opens a file in the editor at the specified line number.
export function openFile(filePath: string, lineNumber?: number): void {
  try {
    if (typeof filePath !== "string" || !filePath) {
      showErrorMessage("Cannot open file: Invalid file path");
      return;
    }

    // Check if the path is absolute or just contains a line number like "/20"
    if (
      filePath.startsWith("/") &&
      !filePath.includes("/var/log/") &&
      !filePath.includes("/var/report/")
    ) {
      // Possibly only a line number was specified, e.g. "/20"
      const possibleLineNumber = parseInt(filePath.substring(1));
      if (!isNaN(possibleLineNumber)) {
        // We have a valid line number, but no file path
        showErrorMessage(
          `Cannot open file: Only a line number (${possibleLineNumber}) was specified, but no file path`,
        );
        return;
      }
    }

    // Make sure the path exists
    if (!fs.existsSync(filePath)) {
      showErrorMessage(`Cannot open file: File does not exist: ${filePath}`);
      return;
    }

    const options: vscode.TextDocumentShowOptions =
      lineNumber !== undefined && typeof lineNumber === "number"
        ? {
            selection: new vscode.Range(
              new vscode.Position(lineNumber, 0),
              new vscode.Position(lineNumber, 0),
            ),
          }
        : {};

    vscode.window.showTextDocument(vscode.Uri.file(filePath), options);
  } catch (error) {
    showErrorMessage(
      `Error opening file: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error("Error opening file:", error);
  }
}

// Clears all log files in the Magento log directory.
export function clearAllLogFiles(
  logViewerProvider: LogViewerProvider,
  magentoRoot: string,
): void {
  vscode.window
    .showWarningMessage(
      "Are you sure you want to delete all log files?",
      "Yes",
      "No",
    )
    .then((selection) => {
      if (selection === "Yes") {
        const logPath = path.join(magentoRoot, "var", "log");
        if (pathExists(logPath)) {
          const files = fs.readdirSync(logPath);
          files.forEach((file) => fs.unlinkSync(path.join(logPath, file)));
          logViewerProvider.refresh();
          showInformationMessage("All log files have been cleared.");
        } else {
          showInformationMessage("No log files found to clear.");
        }
      }
    });
}

// Clears all report files in the Magento report directory.
export function clearAllReportFiles(
  reportViewerProvider: ReportViewerProvider,
  magentoRoot: string,
): void {
  vscode.window
    .showWarningMessage(
      "Are you sure you want to delete all report files?",
      "Yes",
      "No",
    )
    .then((selection) => {
      if (selection === "Yes") {
        const reportPath = path.join(magentoRoot, "var", "report");
        if (pathExists(reportPath)) {
          const deleteReportFilesRecursively = (dir: string) => {
            const files = fs.readdirSync(dir);
            files.forEach((file) => {
              const filePath = path.join(dir, file);
              const stats = fs.lstatSync(filePath);
              if (stats.isFile()) {
                fs.unlinkSync(filePath);
              } else if (stats.isDirectory()) {
                deleteReportFilesRecursively(filePath);
                // Remove empty directory
                try {
                  fs.rmdirSync(filePath);
                } catch (error) {
                  // Directory not empty, ignore
                }
              }
            });
          };
          deleteReportFilesRecursively(reportPath);
          reportViewerProvider.refresh();
          showInformationMessage("All report files have been cleared.");
        } else {
          showInformationMessage("No report files found to clear.");
        }
      }
    });
}

// Deletes a report file.
export function deleteReportFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
    showInformationMessage(`Report file ${filePath} deleted successfully.`);
  } catch (error) {
    showErrorMessage(
      `Failed to delete report file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Shows a dialog to select a log file when no path is provided (async version)
export async function handleOpenFileWithoutPathAsync(
  magentoRoot: string,
  lineNumber?: number,
): Promise<void> {
  try {
    // Collect log and report files asynchronously
    const logPath = path.join(magentoRoot, "var", "log");
    const reportPath = path.join(magentoRoot, "var", "report");
    const logFiles: string[] = [];
    const reportFiles: string[] = [];

    // Check directories and read files in parallel
    const [logExists, reportExists] = await Promise.all([
      pathExistsAsync(logPath),
      pathExistsAsync(reportPath),
    ]);

    const fileReadPromises: Promise<void>[] = [];

    if (logExists) {
      fileReadPromises.push(
        fsPromises
          .readdir(logPath)
          .then((files) => {
            return Promise.all(
              files.map(async (file) => {
                const filePath = path.join(logPath, file);
                const stats = await fsPromises.stat(filePath);
                if (stats.isFile()) {
                  logFiles.push(filePath);
                }
              }),
            );
          })
          .then(() => {}),
      );
    }

    if (reportExists) {
      fileReadPromises.push(
        fsPromises
          .readdir(reportPath)
          .then((files) => {
            return Promise.all(
              files.map(async (file) => {
                const filePath = path.join(reportPath, file);
                const stats = await fsPromises.stat(filePath);
                if (stats.isFile()) {
                  reportFiles.push(filePath);
                }
              }),
            );
          })
          .then(() => {}),
      );
    }

    await Promise.all(fileReadPromises);

    // Create a list of options for the quick pick
    const options: { label: string; description: string; filePath: string }[] =
      [
        ...logFiles.map((filePath) => ({
          label: path.basename(filePath),
          description: "Log File",
          filePath,
        })),
        ...reportFiles.map((filePath) => ({
          label: path.basename(filePath),
          description: "Report File",
          filePath,
        })),
      ];

    // If no files were found
    if (options.length === 0) {
      showErrorMessage("No log or report files found.");
      return;
    }

    // Show a quick pick dialog
    const selection = await vscode.window.showQuickPick(options, {
      placeHolder:
        lineNumber !== undefined
          ? `Select a file to navigate to line ${lineNumber}`
          : "Select a log or report file",
    });

    if (selection) {
      openFile(selection.filePath, lineNumber);
    }
  } catch (error) {
    showErrorMessage(
      `Error fetching log files: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error("Error fetching log files:", error);
  }
}
