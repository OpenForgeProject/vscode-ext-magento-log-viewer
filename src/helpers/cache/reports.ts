/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as fs from "fs";
import { getCachedFileContent } from "./fileContent";

const reportCache = new Map<string, { content: unknown; timestamp: number }>();

export function getReportContent(filePath: string): unknown | null {
  try {
    const stats = fs.statSync(filePath);
    const cachedReport = reportCache.get(filePath);

    if (cachedReport && cachedReport.timestamp >= stats.mtime.getTime()) {
      return cachedReport.content;
    }

    const fileContent = getCachedFileContent(filePath);
    if (!fileContent) {
      return null;
    }

    const report = JSON.parse(fileContent);

    reportCache.set(filePath, {
      content: report,
      timestamp: stats.mtime.getTime(),
    });

    return report;
  } catch (error) {
    return null;
  }
}

export function invalidateReportCache(filePath: string): void {
  reportCache.delete(filePath);
}
