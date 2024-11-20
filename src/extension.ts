import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogViewerProvider } from './logViewer';

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration();
  const isMagentoProject = config.get<string>('magentoLogViewer.isMagentoProject', 'Please select');

  if (isMagentoProject === 'Please select') {
    vscode.window.showInformationMessage('Is this a Magento project?', 'Yes', 'No').then(selection => {
      if (selection === 'Yes') {
        selectMagentoRootFolder(config, context);
      } else {
        updateConfig(config, 'magentoLogViewer.isMagentoProject', selection);
      }
    });
  } else if (isMagentoProject === 'Yes') {
    const magentoRoot = config.get<string>('magentoLogViewer.magentoRoot', '');
    if (!magentoRoot || !isValidPath(magentoRoot)) {
      showErrorMessage('Magento root path is not set or is not a directory.');
      return;
    }
    activateExtension(context, magentoRoot);
  }
}

function selectMagentoRootFolder(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('Please select the Magento root folder.', 'Select Magento Root Folder').then(buttonSelection => {
    if (buttonSelection === 'Select Magento Root Folder') {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const defaultUri = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;
      vscode.window.showOpenDialog({ defaultUri, canSelectFolders: true, canSelectMany: false, openLabel: 'Select Magento Root Folder' }).then(folderUri => {
        if (folderUri?.[0]) {
          updateConfig(config, 'magentoLogViewer.magentoRoot', folderUri[0].fsPath).then(() => {
            showInformationMessage('Magento root folder successfully saved!');
            updateConfig(config, 'magentoLogViewer.isMagentoProject', 'Yes');
            activateExtension(context, folderUri[0].fsPath);
          });
        }
      });
    }
  });
}

function updateConfig(config: vscode.WorkspaceConfiguration, key: string, value: unknown) {
  return config.update(key, value, vscode.ConfigurationTarget.Workspace);
}

function showInformationMessage(message: string) {
  try {
    vscode.window.showInformationMessage(message);
  } catch (error) {
    console.error('Failed to show information message:', error instanceof Error ? error.message : String(error));
  }
}

function showErrorMessage(message: string) {
  try {
    vscode.window.showErrorMessage(message);
  } catch (error) {
    console.error('Failed to show error message:', error instanceof Error ? error.message : String(error));
  }
}

function activateExtension(context: vscode.ExtensionContext, magentoRoot: string) {
  const logViewerProvider = new LogViewerProvider(magentoRoot);
  const treeView = vscode.window.createTreeView('logFiles', { treeDataProvider: logViewerProvider });

  vscode.commands.registerCommand('magento-log-viewer.refreshLogFiles', () => logViewerProvider.refresh());
  vscode.commands.registerCommand('magento-log-viewer.openFile', (filePath: string, lineNumber?: number) => {
    if (typeof filePath === 'string') {
      const options: vscode.TextDocumentShowOptions = lineNumber !== undefined && typeof lineNumber === 'number' ? {
        selection: new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, 0))
      } : {};
      vscode.window.showTextDocument(vscode.Uri.file(filePath), options);
    }
  });
  vscode.commands.registerCommand('magento-log-viewer.openFileAtLine', (filePath: string, lineNumber: number) => {
    const options: vscode.TextDocumentShowOptions = {
      selection: new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, 0))
    };
    vscode.window.showTextDocument(vscode.Uri.file(filePath), options);
  });

  vscode.commands.registerCommand('magento-log-viewer.clearAllLogFiles', () => {
    vscode.window.showWarningMessage('Are you sure you want to delete all log files?', 'Yes', 'No').then(selection => {
      if (selection === 'Yes') {
        const logPath = path.join(magentoRoot, 'var', 'log');
        if (logViewerProvider.pathExists(logPath)) {
          const files = fs.readdirSync(logPath);
          files.forEach(file => fs.unlinkSync(path.join(logPath, file)));
          logViewerProvider.refresh();
          showInformationMessage('All log files have been cleared.');
        } else {
          showInformationMessage('No log files found to clear.');
        }
      }
    });
  });

  context.subscriptions.push(treeView);

  // Update the badge count
  const updateBadge = () => {
    const logFiles = logViewerProvider.getLogFilesWithoutUpdatingBadge(path.join(magentoRoot, 'var', 'log'));
    const totalEntries = logFiles.reduce((count, file) => count + parseInt(file.description?.match(/\d+/)?.[0] || '0', 10), 0);
    treeView.badge = { value: totalEntries, tooltip: `${totalEntries} log entries` };

    // Enable or disable the "Delete Logfiles" button based on the presence of log files
    vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasLogFiles', totalEntries > 0);
  };

  logViewerProvider.onDidChangeTreeData(updateBadge);
  updateBadge();

  vscode.commands.executeCommand('setContext', 'magentoLogViewerBadge', 0);

  // Watch for changes in the log directory
  const logPath = path.join(magentoRoot, 'var', 'log');
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(logPath, '*'));
  watcher.onDidChange(() => logViewerProvider.refresh());
  watcher.onDidCreate(() => logViewerProvider.refresh());
  watcher.onDidDelete(() => logViewerProvider.refresh());

  context.subscriptions.push(watcher);
}

function isValidPath(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory();
  } catch (error) {
    return false;
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
