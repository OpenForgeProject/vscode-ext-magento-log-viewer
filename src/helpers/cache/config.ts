/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";

export interface CacheConfig {
  maxSize: number;
  maxFileSize: number;
}

export function getCacheConfig(): CacheConfig {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );

  const userMaxFiles = config.get<number>("cacheMaxFiles", 0);
  const userMaxFileSize = config.get<number>("cacheMaxFileSize", 0);

  if (userMaxFiles > 0 && userMaxFileSize > 0) {
    return {
      maxSize: userMaxFiles,
      maxFileSize: userMaxFileSize * 1024 * 1024,
    };
  }

  const totalMemory = process.memoryUsage().heapTotal;
  const availableMemory = totalMemory - process.memoryUsage().heapUsed;
  const maxCacheMemory = Math.min(availableMemory * 0.1, 50 * 1024 * 1024);

  const autoMaxSize =
    userMaxFiles > 0
      ? userMaxFiles
      : Math.max(
          20,
          Math.min(100, Math.floor(maxCacheMemory / (2 * 1024 * 1024))),
        );
  const autoMaxFileSize =
    userMaxFileSize > 0
      ? userMaxFileSize * 1024 * 1024
      : Math.max(1024 * 1024, Math.min(10 * 1024 * 1024, maxCacheMemory / 10));

  return {
    maxSize: autoMaxSize,
    maxFileSize: autoMaxFileSize,
  };
}
