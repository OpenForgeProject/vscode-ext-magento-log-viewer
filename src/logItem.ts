/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";

export class LogItem extends vscode.TreeItem {
  /**
   * Raw entry count associated with this item (e.g. number of log entries).
   * This is independent of the label text and is used for badge calculations.
   */
  public entryCount = 0;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public children?: LogItem[],
    public iconPath?: vscode.ThemeIcon,
    public contextValue: string = "logItem",
    public rawText?: string,
  ) {
    super(label, collapsibleState as vscode.TreeItemCollapsibleState);
    this.contextValue = contextValue;
    this.entryCount = this.extractEntryCount(label);
    this.description = this.entryCount > 0 ? `(${this.entryCount})` : "";
    this.label = this.label.replace(/\(\d+\)/, "").trim();

    // Add colors based on log level
    if (this.label.includes("ERROR")) {
      this.tooltip = "Error Message";
      this.resourceUri = vscode.Uri.parse("error");
    } else if (this.label.includes("WARN")) {
      this.tooltip = "Warning Message";
      this.resourceUri = vscode.Uri.parse("warning");
    } else if (this.label.includes("DEBUG")) {
      this.tooltip = "Debug Message";
      this.resourceUri = vscode.Uri.parse("debug");
    } else if (this.label.includes("INFO")) {
      this.tooltip = "Info Message";
      this.resourceUri = vscode.Uri.parse("info");
    }
  }

  description = "";

  private extractEntryCount(label: string): number {
    const match = label.match(/\((\d+)\)/);
    if (!match) {
      return 0;
    }

    const value = parseInt(match[1], 10);
    return isNaN(value) ? 0 : value;
  }
}
