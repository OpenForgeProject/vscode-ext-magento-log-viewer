/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import { promises as fsPromises } from "fs";

export async function readFileFromPosition(
  filePath: string,
  fromPosition: number,
): Promise<{ content: string; newPosition: number } | null> {
  try {
    const stats = await fsPromises.stat(filePath);

    if (stats.size <= fromPosition) {
      return { content: "", newPosition: fromPosition };
    }

    if (stats.size < fromPosition) {
      return { content: "", newPosition: 0 };
    }

    const bytesToRead = stats.size - fromPosition;
    const buffer = Buffer.alloc(bytesToRead);
    const fd = await fsPromises.open(filePath, "r");

    try {
      const { bytesRead } = await fd.read(
        buffer,
        0,
        bytesToRead,
        fromPosition,
      );
      const content = buffer.toString("utf-8", 0, bytesRead);

      return {
        content,
        newPosition: fromPosition + bytesRead,
      };
    } finally {
      await fd.close();
    }
  } catch (error) {
    console.error(`Error reading file from position ${fromPosition}:`, error);
    return null;
  }
}

export function processNewContent(
  fileInfo: { buffer: string },
  newContent: string,
): string[] {
  if (!newContent) {
    return [];
  }

  const fullContent = fileInfo.buffer + newContent;
  const lines = fullContent.split("\n");

  fileInfo.buffer = lines.pop() || "";

  return lines;
}
