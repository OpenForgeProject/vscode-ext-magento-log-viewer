/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { promises as fsPromises } from "fs";

export class LogNotificationController {
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_THROTTLE = 60000;
  private readonly alertPatternThrottleMap = new Map<string, number>();
  private readonly fileAlertPositions = new Map<string, number>();

  constructor(private readonly workspaceRoot: string) {}

  notifyNewErrors(fileName: string, count: number): void {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration(
      "magentoLogViewer",
      workspaceUri,
    );
    const showNotifications = config.get<boolean>(
      "tailingShowNotifications",
      true,
    );

    if (!showNotifications) {
      return;
    }

    const now = Date.now();

    if (now - this.lastNotificationTime < this.NOTIFICATION_THROTTLE) {
      return;
    }

    this.lastNotificationTime = now;

    const message = `🔴 ${count} new error(s) in ${fileName}`;
    vscode.window.showWarningMessage(message, "Open File").then((selection) => {
      if (selection === "Open File") {
        vscode.commands.executeCommand(
          "magento-log-viewer.openFile",
          path.join(this.workspaceRoot, "var", "log", fileName),
        );
      }
    });
  }

  async checkFileForAlerts(filePath: string): Promise<void> {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration(
      "magentoLogViewer",
      workspaceUri,
    );
    if (config.get<string[]>("tailingAlertPatterns", []).length === 0) {
      return;
    }

    try {
      const stats = await fsPromises.stat(filePath);
      const knownPosition = this.fileAlertPositions.get(filePath);

      if (knownPosition === undefined) {
        this.fileAlertPositions.set(filePath, stats.size);
        return;
      }

      if (stats.size < knownPosition) {
        this.fileAlertPositions.set(filePath, stats.size);
        return;
      }

      if (stats.size === knownPosition) {
        return;
      }

      await this.readAndCheckAlerts(filePath, knownPosition, stats.size);
    } catch {
      // File might not exist, ignore
    }
  }

  private async readAndCheckAlerts(
    filePath: string,
    from: number,
    to: number,
  ): Promise<void> {
    const bytesToRead = to - from;
    const buffer = Buffer.alloc(bytesToRead);
    const fd = await fsPromises.open(filePath, "r");
    try {
      const { bytesRead } = await fd.read(buffer, 0, bytesToRead, from);
      this.fileAlertPositions.set(filePath, from + bytesRead);
      const lines = buffer
        .toString("utf-8", 0, bytesRead)
        .split("\n")
        .filter((l) => l.trim());
      if (lines.length > 0) {
        this.checkAlertPatterns(path.basename(filePath), lines);
      }
    } finally {
      await fd.close();
    }
  }

  public checkAlertPatterns(fileName: string, lines: string[]): void {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration(
      "magentoLogViewer",
      workspaceUri,
    );
    const patterns = config.get<string[]>("tailingAlertPatterns", []);

    if (patterns.length === 0) {
      return;
    }

    const now = Date.now();

    for (const patternStr of patterns) {
      const lastFired = this.alertPatternThrottleMap.get(patternStr) ?? 0;
      if (now - lastFired < this.NOTIFICATION_THROTTLE) {
        continue;
      }

      let regex: RegExp;
      try {
        regex = new RegExp(patternStr, "i");
      } catch {
        continue;
      }

      const matched = lines.some((line) => regex.test(line));
      if (matched) {
        this.alertPatternThrottleMap.set(patternStr, now);
        vscode.window
          .showWarningMessage(
            `🔔 Alert pattern matched in ${fileName}: "${patternStr}"`,
            "Open File",
          )
          .then((selection) => {
            if (selection === "Open File") {
              vscode.commands.executeCommand(
                "magento-log-viewer.openFile",
                path.join(this.workspaceRoot, "var", "log", fileName),
              );
            }
          });
      }
    }
  }
}
