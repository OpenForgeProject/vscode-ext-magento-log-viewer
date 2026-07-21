/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as fs from "fs";
import { promises as fsPromises } from "fs";
import { pathExistsAsync } from "../pathUtils";
import { getCacheConfig } from "./config";

const fileContentCache = new Map<
  string,
  { content: string; timestamp: number }
>();

const LARGE_FILE_SUMMARY_HEAD_CHARS = 1000;
const LARGE_FILE_SUMMARY_TAIL_CHARS = 1000;

export async function getCachedFileContentAsync(
  filePath: string,
): Promise<string | null> {
  try {
    if (!(await pathExistsAsync(filePath))) {
      return null;
    }

    const stats = await fsPromises.stat(filePath);

    if (stats.size > 50 * 1024 * 1024) {
      return summarizeLargeFile(filePath, stats.size);
    }

    const cacheConfig = getCacheConfig();
    if (stats.size > cacheConfig.maxFileSize) {
      return await fsPromises.readFile(filePath, "utf-8");
    }

    const cachedContent = fileContentCache.get(filePath);

    if (cachedContent && cachedContent.timestamp >= stats.mtime.getTime()) {
      return cachedContent.content;
    }

    const content = await fsPromises.readFile(filePath, "utf-8");

    if (fileContentCache.size >= cacheConfig.maxSize) {
      const entriesToRemove = Math.max(
        1,
        Math.floor(cacheConfig.maxSize * 0.1),
      );
      const keys = Array.from(fileContentCache.keys());

      for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
        fileContentCache.delete(keys[i]);
      }
    }

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

export function getCachedFileContent(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const cacheConfig = getCacheConfig();

    if (stats.size > cacheConfig.maxFileSize) {
      return fs.readFileSync(filePath, "utf-8");
    }

    const cachedContent = fileContentCache.get(filePath);

    if (cachedContent && cachedContent.timestamp >= stats.mtime.getTime()) {
      return cachedContent.content;
    }

    const content = fs.readFileSync(filePath, "utf-8");

    if (fileContentCache.size >= cacheConfig.maxSize) {
      const entriesToRemove = Math.max(
        1,
        Math.floor(cacheConfig.maxSize * 0.1),
      );
      const keys = Array.from(fileContentCache.keys());

      for (let i = 0; i < entriesToRemove && keys.length > 0; i++) {
        fileContentCache.delete(keys[i]);
      }
    }

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

export function clearFileContentCache(): void {
  fileContentCache.clear();
}

export function invalidateFileContentCache(filePath: string): void {
  fileContentCache.delete(filePath);
}

export function getFileContentCache(): Map<
  string,
  { content: string; timestamp: number }
> {
  return fileContentCache;
}

export function getFileContentCacheSize(): number {
  return fileContentCache.size;
}

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
