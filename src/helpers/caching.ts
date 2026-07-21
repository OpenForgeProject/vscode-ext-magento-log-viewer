/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

export { getCacheConfig } from "./cache/config";
export {
  getCachedFileContent,
  getCachedFileContentAsync,
  clearFileContentCache,
  invalidateFileContentCache,
} from "./cache/fileContent";
export { getCacheStatistics, optimizeCacheSize } from "./cache/statistics";
export { getLineCount, invalidateLineCount } from "./cache/lineCount";
export { countLogEntriesAsync } from "./cache/logEntries";
export { getReportContent, invalidateReportCache } from "./cache/reports";

import { invalidateFileContentCache } from "./cache/fileContent";
import { invalidateLineCount } from "./cache/lineCount";
import { invalidateReportCache } from "./cache/reports";

export function invalidateFileCache(filePath: string): void {
  invalidateFileContentCache(filePath);
  invalidateLineCount(filePath);
  invalidateReportCache(filePath);
}
