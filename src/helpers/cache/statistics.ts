/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import { getCacheConfig } from "./config";
import {
  getFileContentCache,
  getFileContentCacheSize,
} from "./fileContent";

export function getCacheStatistics(): {
  size: number;
  maxSize: number;
  maxFileSize: number;
  memoryUsage: string;
} {
  const currentConfig = getCacheConfig();
  const cache = getFileContentCache();
  const memoryUsed = Array.from(cache.values()).reduce(
    (total, item) => total + item.content.length * 2,
    0,
  );

  const stats = {
    size: getFileContentCacheSize(),
    maxSize: currentConfig.maxSize,
    maxFileSize: currentConfig.maxFileSize,
    memoryUsage: `${Math.round((memoryUsed / 1024 / 1024) * 100) / 100} MB`,
  };

  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );
  const enableLogging = config.get<boolean>("enableCacheStatistics", false);

  if (enableLogging) {
    console.log("Magento Log Viewer Cache Statistics:", stats);
  }

  return stats;
}

export function optimizeCacheSize(): void {
  const memoryUsage = process.memoryUsage();
  const heapUsedRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

  if (heapUsedRatio > 0.8) {
    const cache = getFileContentCache();
    const targetSize = Math.floor(cache.size * 0.5);
    const keys = Array.from(cache.keys());
    const entriesToRemove = cache.size - targetSize;

    for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
      cache.delete(keys[i]);
    }

    console.log(
      `Cache optimized: Removed ${entriesToRemove} entries due to memory pressure`,
    );
  }
}
