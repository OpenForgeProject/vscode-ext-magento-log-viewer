/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from 'vscode';
import { promptMagentoProjectSelection, showErrorMessage, activateExtension, isValidPath, deleteReportFile, clearFileContentCache, selectMagentoRootFolderDirect, getEffectiveMagentoRoot, selectMagentoRootFromSettings, autoCleanupOldLogFiles, stopPeriodicCleanup, TailingManager } from './helpers';
import { LogItem, ReportViewerProvider, LogViewerProvider } from './logViewer';
import { showUpdateNotification } from './updateNotifier';

const disposables: vscode.Disposable[] = [];

// Global tailing manager instance
let tailingManager: TailingManager | null = null;
let logViewerProviderGlobal: LogViewerProvider | null = null;

export function activate(context: vscode.ExtensionContext): void {

  // Show Update-Popup first (lightweight operation)
  showUpdateNotification(context);

  // Register the settings button command
  const selectMagentoRootCommand = vscode.commands.registerCommand('magento-log-viewer.selectMagentoRootFromSettings', () => {
    selectMagentoRootFromSettings();
  });
  disposables.push(selectMagentoRootCommand);
  context.subscriptions.push(selectMagentoRootCommand);

  // Initialize extension in a more intelligent way
  const initializeExtension = async () => {
    try {
      // Wait for workspace to be stable before heavy file operations
      // This helps when VS Code is still indexing files
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        // Small delay to let indexing settle, but not too long to affect UX
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceUri = workspaceFolders?.[0]?.uri || null;

      const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
      const isMagentoProject = config.get<string>('isMagentoProject', 'Please select');

      if (isMagentoProject === 'Please select') {
        promptMagentoProjectSelection(config, context);
      } else if (isMagentoProject === 'Yes') {
        const magentoRoot = getEffectiveMagentoRoot(workspaceUri);
        if (!magentoRoot || !isValidPath(magentoRoot)) {
          // Show error message and automatically open folder picker
          vscode.window.showErrorMessage(
            'Magento root path is not set or is not a directory.',
            'Select Magento Root Folder'
          ).then(selection => {
            if (selection === 'Select Magento Root Folder') {
              selectMagentoRootFolderDirect(config, context);
            }
          });
          return;
        }

        // Create providers asynchronously to avoid blocking
        const reportViewerProvider = new ReportViewerProvider(magentoRoot);

        // Initialize tailing manager with callback for new entries
        tailingManager = new TailingManager(
          context,
          async (filePath, newLines, startLine) => {
            if (logViewerProviderGlobal) {
              await logViewerProviderGlobal.appendNewEntries(filePath, newLines, startLine);
            }
          },
          () => {
            // Refresh tree when tailing state changes (start/stop)
            if (logViewerProviderGlobal) {
              logViewerProviderGlobal.refresh();
            }
          }
        );
        disposables.push(tailingManager);

        // Restore tailing state if enabled
        await tailingManager.restoreState();

        // Activate extension and store the logViewerProvider
        logViewerProviderGlobal = activateExtension(context, magentoRoot, reportViewerProvider);

        // Set tailing manager reference for visual indicators
        logViewerProviderGlobal.setTailingManager(tailingManager);

        // Register tailing commands
        const startTailingCommand = vscode.commands.registerCommand('magento-log-viewer.startTailing', async (logItem: LogItem) => {
          if (!tailingManager) {
            showErrorMessage('Tailing manager not initialized');
            return;
          }

          // Extract file path from log item
          const filePath = logItem?.command?.arguments?.[0] as string;
          if (filePath) {
            await tailingManager.startTailing(filePath);
          } else {
            showErrorMessage('Unable to determine file path for tailing');
          }
        });

        const stopTailingCommand = vscode.commands.registerCommand('magento-log-viewer.stopTailing', (logItem: LogItem) => {
          if (!tailingManager) {
            return;
          }

          const filePath = logItem?.command?.arguments?.[0] as string;
          if (filePath) {
            tailingManager.stopTailing(filePath);
          }
        });

        const stopAllTailingCommand = vscode.commands.registerCommand('magento-log-viewer.stopAllTailing', () => {
          if (tailingManager) {
            tailingManager.stopAllTailing();
          }
        });

        const toggleTailingCommand = vscode.commands.registerCommand('magento-log-viewer.toggleTailing', async (logItem: LogItem) => {
          if (!tailingManager) {
            return;
          }

          const filePath = logItem?.command?.arguments?.[0] as string;
          if (!filePath) {
            return;
          }

          if (tailingManager.isTailing(filePath)) {
            tailingManager.stopTailing(filePath);
          } else {
            await tailingManager.startTailing(filePath);
          }
        });

        disposables.push(startTailingCommand, stopTailingCommand, stopAllTailingCommand, toggleTailingCommand);

        const deleteCommand = vscode.commands.registerCommand('magento-log-viewer.deleteReportFile', (logItem: LogItem) => {
          if (logItem && logItem.command && logItem.command.arguments && logItem.command.arguments[0]) {
            const filePath = logItem.command.arguments[0];
            deleteReportFile(filePath);
            reportViewerProvider.refresh();
          } else {
            showErrorMessage('Failed to delete report file: Invalid file path.');
          }
        });

        disposables.push(deleteCommand);
        context.subscriptions.push(...disposables);
      }
    } catch (error) {
      console.error('Failed to initialize Magento Log Viewer:', error);
      showErrorMessage('Failed to initialize Magento Log Viewer. Check the console for details.');
    }
  };

  // Initialize asynchronously to avoid blocking VS Code startup
  initializeExtension();
}

export function deactivate(): void {
  // Stop periodic cleanup
  stopPeriodicCleanup();

  // Stop and dispose tailing manager
  if (tailingManager) {
    tailingManager.dispose();
    tailingManager = null;
  }

  // Clear global references
  logViewerProviderGlobal = null;

  // Clear any context values we set
  vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasMagentoRoot', undefined);
  vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasTailedFiles', undefined);
  vscode.commands.executeCommand('setContext', 'magentoLogViewer.tailingActive', undefined);

  // Clear all caches to free memory
  clearFileContentCache();

  // Dispose of all disposables
  while (disposables.length) {
    const disposable = disposables.pop();
    if (disposable) {
      try {
        disposable.dispose();
      } catch (err) {
        console.error('Error disposing:', err);
      }
    }
  }
}
