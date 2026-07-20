/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as fs from "fs";

const LOG_ENTRY_PATTERN = /\.([A-Za-z]+):/g;
const BATCH_SIZE = 64 * 1024;

export async function countLogEntriesAsync(filePath: string): Promise<number> {
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
