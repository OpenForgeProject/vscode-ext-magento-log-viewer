/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import { pathExists, pathExistsAsync } from "./pathUtils";

// Cache for JSON reports to avoid repeated parsing
const reportCache = new Map<string, { content: unknown; timestamp: number }>();

// Cache for file contents to avoid repeated reads
const fileContentCache = new Map<
  string,
  { content: string; timestamp: number }
>();

// Dynamic cache configuration based on available memory and user settings
const getCacheConfig = () => {
  // Get user configuration
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );

  const userMaxFiles = config.get<number>("cacheMaxFiles", 0);
  const userMaxFileSize = config.get<number>("cacheMaxFileSize", 0);

  // If user has set specific values, use them
  if (userMaxFiles > 0 && userMaxFileSize > 0) {
    return {
      maxSize: userMaxFiles,
      maxFileSize: userMaxFileSize * 1024 * 1024, // Convert MB to bytes
    };
  }

  // Otherwise use automatic calculation
  const totalMemory = process.memoryUsage().heapTotal;
  const availableMemory = totalMemory - process.memoryUsage().heapUsed;

  // Use up to 10% of available heap memory for caching
  const maxCacheMemory = Math.min(availableMemory * 0.1, 50 * 1024 * 1024); // Max 50MB

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
};
const CACHE_CONFIG = getCacheConfig();

// Helper function for reading and parsing JSON reports with caching
function getReportContent(filePath: string): unknown | null {
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

// Enhanced file content caching function (asynchronous)
export async function getCachedFileContentAsync(
  filePath: string,
): Promise<string | null> {
  try {
    // Check if file exists first
    if (!(await pathExistsAsync(filePath))) {
      return null;
    }

    const stats = await fsPromises.stat(filePath);

    // For very large files (>50MB), avoid loading the whole content into memory.
    // Return a summary instead of the full file content.
    if (stats.size > 50 * 1024 * 1024) {
      return summarizeLargeFile(filePath, stats.size);
    }

    // Don't cache files larger than configured limit to prevent memory issues
    if (stats.size > CACHE_CONFIG.maxFileSize) {
      return await fsPromises.readFile(filePath, "utf-8");
    }

    const cachedContent = fileContentCache.get(filePath);

    // Return cached content if it's still valid
    if (cachedContent && cachedContent.timestamp >= stats.mtime.getTime()) {
      return cachedContent.content;
    }

    // Read file content asynchronously
    const content = await fsPromises.readFile(filePath, "utf-8");

    // Manage cache size - remove oldest entries if cache is full
    if (fileContentCache.size >= CACHE_CONFIG.maxSize) {
      // Remove multiple old entries if we're significantly over the limit
      const entriesToRemove = Math.max(
        1,
        Math.floor(CACHE_CONFIG.maxSize * 0.1),
      );
      const keys = Array.from(fileContentCache.keys());

      for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
        fileContentCache.delete(keys[i]);
      }
    }

    // Cache the content
    fileContentCache.set(filePath, {
      content,
      timestamp: stats.mtime.getTime(),
    });

    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Maximum number of characters to read from the head and tail of a large file
const LARGE_FILE_SUMMARY_HEAD_CHARS = 1000;
const LARGE_FILE_SUMMARY_TAIL_CHARS = 1000;

// Reads the beginning and end of a large file without loading it entirely into memory.
async function summarizeLargeFile(
  filePath: string,
  fileSize: number,
): Promise<string> {
  const headPromise = readFileRangeAsync(
    filePath,
    0,
    LARGE_FILE_SUMMARY_HEAD_CHARS,
  );
  const tailStart = Math.max(
    fileSize - LARGE_FILE_SUMMARY_TAIL_CHARS,
    LARGE_FILE_SUMMARY_HEAD_CHARS,
  );
  const tailPromise = readFileRangeAsync(
    filePath,
    tailStart,
    LARGE_FILE_SUMMARY_TAIL_CHARS,
  );

  const [head, tail] = await Promise.all([headPromise, tailPromise]);

  return [
    `--- File too large to display (${Math.round(fileSize / (1024 * 1024))}MB). Showing head and tail ---`,
    head,
    "\n... [content truncated] ...\n",
    tail,
  ].join("\n");
}

// Reads up to `charCount` characters starting at `startPosition` using a stream.
function readFileRangeAsync(
  filePath: string,
  startPosition: number,
  charCount: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, {
      encoding: "utf8",
      start: startPosition,
    });
    let result = "";

    stream.on("data", (chunk: string | Buffer) => {
      const chunkStr = typeof chunk === "string" ? chunk : chunk.toString();
      const remaining = charCount - result.length;
      if (remaining <= 0) {
        stream.destroy();
        return;
      }
      result += chunkStr.slice(0, remaining);
    });

    stream.on("end", () => {
      resolve(result);
    });

    stream.on("error", (error) => {
      console.error(`Error reading file range ${filePath}:`, error);
      reject(error);
    });

    stream.on("close", () => {
      resolve(result);
    });
  });
}

// Enhanced file content caching function (synchronous - for compatibility)
export function getCachedFileContent(filePath: string): string | null {
  try {
    // Check if file exists first
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);

    // Don't cache files larger than configured limit to prevent memory issues
    if (stats.size > CACHE_CONFIG.maxFileSize) {
      return fs.readFileSync(filePath, "utf-8");
    }

    const cachedContent = fileContentCache.get(filePath);

    // Return cached content if it's still valid
    if (cachedContent && cachedContent.timestamp >= stats.mtime.getTime()) {
      return cachedContent.content;
    }

    // Read file content
    const content = fs.readFileSync(filePath, "utf-8");

    // Manage cache size - remove oldest entries if cache is full
    if (fileContentCache.size >= CACHE_CONFIG.maxSize) {
      // Remove multiple old entries if we're significantly over the limit
      const entriesToRemove = Math.max(
        1,
        Math.floor(CACHE_CONFIG.maxSize * 0.1),
      );
      const keys = Array.from(fileContentCache.keys());

      for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
        fileContentCache.delete(keys[i]);
      }
    }

    // Cache the content
    fileContentCache.set(filePath, {
      content,
      timestamp: stats.mtime.getTime(),
    });

    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Function to clear file content cache (useful for testing or memory management)
export function clearFileContentCache(): void {
  fileContentCache.clear();
}

// Function to get cache statistics for monitoring
export function getCacheStatistics(): {
  size: number;
  maxSize: number;
  maxFileSize: number;
  memoryUsage: string;
} {
  const currentConfig = getCacheConfig();
  const memoryUsed = Array.from(fileContentCache.values()).reduce(
    (total, item) => total + item.content.length * 2,
    0,
  ); // Rough estimate (UTF-16)

  const stats = {
    size: fileContentCache.size,
    maxSize: currentConfig.maxSize,
    maxFileSize: currentConfig.maxFileSize,
    memoryUsage: `${Math.round((memoryUsed / 1024 / 1024) * 100) / 100} MB`,
  };

  // Log statistics if enabled in settings
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

// Function to invalidate cache for a specific file
export function invalidateFileCache(filePath: string): void {
  fileContentCache.delete(filePath);
  reportCache.delete(filePath);
  lineCountCache.delete(filePath);
}

// Function to optimize cache size based on current memory pressure
export function optimizeCacheSize(): void {
  const memoryUsage = process.memoryUsage();
  const heapUsedRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

  // If memory usage is high (>80%), aggressively clean cache
  if (heapUsedRatio > 0.8) {
    const targetSize = Math.floor(fileContentCache.size * 0.5);
    const keys = Array.from(fileContentCache.keys());
    const entriesToRemove = fileContentCache.size - targetSize;

    for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
      fileContentCache.delete(keys[i]);
    }

    console.log(
      `Cache optimized: Removed ${entriesToRemove} entries due to memory pressure`,
    );
  }
}

// Cache for file line counts
const lineCountCache = new Map<string, { count: number; timestamp: number }>();

// Returns the number of lines in the specified file.
export function getLineCount(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    const cachedCount = lineCountCache.get(filePath);

    if (cachedCount && cachedCount.timestamp >= stats.mtime.getTime()) {
      return cachedCount.count;
    }

    // More efficient counting with streams for large files
    if (stats.size > 1024 * 1024) {
      // For files > 1MB, estimate the line count based on a sample.
      const sampleSize = 102400; // 100KB
      const buffer = Buffer.alloc(sampleSize);
      const fd = fs.openSync(filePath, "r");
      const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
      fs.closeSync(fd);

      const sample = buffer.toString("utf-8", 0, bytesRead);
      const lines = sample.split("\n").length - 1;

      // Avoid division by zero and invalid estimates
      if (bytesRead === 0 || lines === 0) {
        lineCountCache.set(filePath, {
          count: 0,
          timestamp: stats.mtime.getTime(),
        });
        return 0;
      }

      // Estimate the total line count based on the sample
      const estimatedLines = Math.ceil(lines * (stats.size / bytesRead));

      lineCountCache.set(filePath, {
        count: estimatedLines,
        timestamp: stats.mtime.getTime(),
      });

      return estimatedLines;
    } else {
      // For smaller files, use cached content
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
    }
  } catch (error) {
    return 0; // Return 0 in case of error
  }
}

// Counts log entries in a file by scanning for the pattern "level:" without loading the full file into memory.
export async function countLogEntriesAsync(filePath: string): Promise<number> {
  const LOG_ENTRY_PATTERN = /\.([A-Za-z]+):/g;
  const BATCH_SIZE = 64 * 1024; // 64KB chunks

  return new Promise((resolve, reject) => {
    try {
      const stream = fs.createReadStream(filePath, { encoding: "utf8" });
      let partial = "";
      let count = 0;

      stream.on("data", (chunk: string | Buffer) => {
        const chunkStr = typeof chunk === "string" ? chunk : chunk.toString();
        const combined = partial + chunkStr;
        const lastNewline = combined.lastIndexOf("\n");

        if (lastNewline === -1) {
          partial = combined;
          return;
        }

        const processable = combined.slice(0, lastNewline);
        partial = combined.slice(lastNewline + 1);

        let match: RegExpExecArray | null;
        while ((match = LOG_ENTRY_PATTERN.exec(processable)) !== null) {
          count++;
        }
      });

      stream.on("end", () => {
        let match: RegExpExecArray | null;
        while ((match = LOG_ENTRY_PATTERN.exec(partial)) !== null) {
          count++;
        }
        resolve(count);
      });

      stream.on("error", (error) => {
        console.error(`Error counting log entries in ${filePath}:`, error);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export { getReportContent };
