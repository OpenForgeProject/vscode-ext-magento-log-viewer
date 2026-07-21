/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";

// Checks if the given path is a valid directory.
export function isValidPath(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Checks if the given path exists (asynchronous version)
 * @param p Path to check
 * @returns Promise<boolean> - true if path exists, false otherwise
 */
export async function pathExistsAsync(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Checks if the given path exists (synchronous fallback for compatibility)
 * @param p Path to check
 * @returns boolean - true if path exists, false otherwise
 */
export function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
  } catch (err) {
    return false;
  }
  return true;
}

// Helper function for efficiently counting files in a directory
export function countFilesInDirectory(dir: string): number {
  if (!pathExists(dir)) {
    return 0;
  }

  let count = 0;
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);

    if (stats.isFile()) {
      count++;
    } else if (stats.isDirectory()) {
      count += countFilesInDirectory(fullPath);
    }
  }

  return count;
}
