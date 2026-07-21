/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

// Re-export barrel for the helpers module.
// New code should prefer importing directly from the specific helper submodule.

export {
  showInformationMessage,
  showErrorMessage,
} from "./helpers/messages";

export {
  isValidPath,
  pathExists,
  pathExistsAsync,
  countFilesInDirectory,
} from "./helpers/pathUtils";

export {
  promptMagentoProjectSelection,
  selectMagentoRootFolder,
  selectMagentoRootFolderDirect,
  selectMagentoRootFromSettings,
  updateConfig,
  getEffectiveMagentoRoot,
} from "./helpers/config";

export {
  activateExtension,
  registerCommands,
} from "./helpers/activation";

export {
  openFile,
  handleOpenFileWithoutPathAsync,
  clearAllLogFiles,
  clearAllReportFiles,
  deleteReportFile,
} from "./helpers/files";

export {
  getLineCount,
  getCachedFileContent,
  getCachedFileContentAsync,
  clearFileContentCache,
  getCacheStatistics,
  invalidateFileCache,
  optimizeCacheSize,
} from "./helpers/caching";

export {
  getIconForLogLevel,
  getLogItems,
  getLogItemsAsync,
  formatTimestamp,
} from "./helpers/logParser";

export {
  parseReportTitle,
  getIconForReport,
} from "./helpers/reports";

export {
  parseTimeDuration,
  isFileOlderThan,
  autoCleanupOldLogFiles,
  startPeriodicCleanup,
  stopPeriodicCleanup,
  updatePeriodicCleanupContext,
} from "./helpers/cleanup";

export { TailingManager } from "./helpers/tailing";

export { updateBadge } from "./helpers/badge";
