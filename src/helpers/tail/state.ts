/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import type { TailedFileInfo } from "./types";

export interface PersistedTailedFile {
  filePath: string;
  position: number;
  lastLineNumber: number;
}

export async function saveTailedFilesState(
  context: vscode.ExtensionContext,
  tailedFiles: Map<string, TailedFileInfo>,
): Promise<void> {
  const state = Array.from(tailedFiles.entries()).map(([filePath, info]) => ({
    filePath,
    position: info.position,
    lastLineNumber: info.lastLineNumber,
  }));

  await context.workspaceState.update("tailedFiles", state);
}

export async function restoreTailedFilesState(
  context: vscode.ExtensionContext,
  startTailing: (filePath: string) => Promise<boolean>,
): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );
  const persistAcrossSessions = config.get<boolean>(
    "tailingPersistAcrossSessions",
    false,
  );

  if (!persistAcrossSessions) {
    return;
  }

  const state = context.workspaceState.get<PersistedTailedFile[]>(
    "tailedFiles",
  );

  if (state && state.length > 0) {
    for (const item of state) {
      await startTailing(item.filePath);
    }

    vscode.window.showInformationMessage(
      `📡 Restored tailing for ${state.length} file(s)`,
    );
  }
}
