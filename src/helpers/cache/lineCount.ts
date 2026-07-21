/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as fs from "fs";
import { getCachedFileContent } from "./fileContent";

const lineCountCache = new Map<string, { count: number; timestamp: number }>();

export function getLineCount(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    const cachedCount = lineCountCache.get(filePath);

    if (cachedCount && cachedCount.timestamp >= stats.mtime.getTime()) {
      return cachedCount.count;
    }

    if (stats.size > 1024 * 1024) {
      return estimateLineCount(filePath, stats);
    }

    const fileContent = getCachedFileContent(filePath);
    if (!fileContent) {
      return 0;
    }

    const lineCount = fileContent.split("\n").length;

    lineCountCache.set(filePath, {
      count: lineCount,
      timestamp: stats.mtime.getTime(),
    });

    return lineCount;
  } catch (error) {
    return 0;
  }
}

export function invalidateLineCount(filePath: string): void {
  lineCountCache.delete(filePath);
}

function estimateLineCount(
  filePath: string,
  stats: fs.Stats,
): number {
  const sampleSize = 102400;
  const buffer = Buffer.alloc(sampleSize);
  const fd = fs.openSync(filePath, "r");
  const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
  fs.closeSync(fd);

  const sample = buffer.toString("utf-8", 0, bytesRead);
  const lines = sample.split("\n").length - 1;

  if (bytesRead === 0 || lines === 0) {
    lineCountCache.set(filePath, {
      count: 0,
      timestamp: stats.mtime.getTime(),
    });
    return 0;
  }

  const estimatedLines = Math.ceil(lines * (stats.size / bytesRead));

  lineCountCache.set(filePath, {
    count: estimatedLines,
    timestamp: stats.mtime.getTime(),
  });

  return estimatedLines;
}
