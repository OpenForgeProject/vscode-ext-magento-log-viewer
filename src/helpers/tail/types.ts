/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

export interface TailedFileInfo {
  position: number;
  lastLineNumber: number;
  buffer: string;
  filePath: string;
  fileName: string;
}
