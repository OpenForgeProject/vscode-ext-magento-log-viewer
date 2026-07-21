/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";

export function parseUpdateInterval(interval: string): number {
  const intervals: Record<string, number> = {
    instant: 100,
    "250ms": 250,
    "500ms": 500,
    "1s": 1000,
    "2s": 2000,
  };

  return intervals[interval] || 500;
}

export function getUpdateIntervalMs(): number {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );
  const interval = config.get<string>("tailingUpdateInterval", "500ms");
  return parseUpdateInterval(interval);
}
