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
        vscode.window.showInformationMessage('Please select the Magento root folder.', 'Select Magento Root Folder').then(buttonSelection => {
          if (buttonSelection === 'Select Magento Root Folder') {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const defaultUri = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;
            vscode.window.showOpenDialog({ defaultUri, canSelectFolders: true, canSelectMany: false, openLabel: 'Select Magento Root Folder' }).then(folderUri => {
              if (folderUri?.[0]) {
                config.update('magentoLogViewer.magentoRoot', folderUri[0].fsPath, vscode.ConfigurationTarget.Workspace).then(() => {
                  vscode.window.showInformationMessage('Magento root folder successfully saved!');
                  config.update('magentoLogViewer.isMagentoProject', 'Yes', vscode.ConfigurationTarget.Workspace);
                  activateExtension(context, folderUri[0].fsPath);
                });
              }
            });
          }
        });
      } else {
        config.update('magentoLogViewer.isMagentoProject', selection, vscode.ConfigurationTarget.Workspace);
      }
    });
  } else if (isMagentoProject === 'Yes') {
    const magentoRoot = config.get<string>('magentoLogViewer.magentoRoot', '');
    if (!magentoRoot || !isValidPath(magentoRoot)) {
      vscode.window.showErrorMessage('Magento root path is not set or is not a directory.');
      return;
    }
    activateExtension(context, magentoRoot);
  }
}

function activateExtension(context: vscode.ExtensionContext, magentoRoot: string) {
  const logViewerProvider = new LogViewerProvider(magentoRoot);
  const treeView = vscode.window.createTreeView('logFiles', { treeDataProvider: logViewerProvider });

  vscode.commands.registerCommand('magento-log-viewer.refreshLogFiles', () => logViewerProvider.refresh());
  vscode.commands.registerCommand('magento-log-viewer.openFile', (...args: any[]) => {
    const filePath = args[0] as string;
    const lineNumber = args[1] as number | undefined;

    if (lineNumber !== undefined) {
      const options: vscode.TextDocumentShowOptions = {
        selection: new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, 0))
      };
      vscode.window.showTextDocument(vscode.Uri.file(filePath), options);
    } else {
      vscode.window.showTextDocument(vscode.Uri.file(filePath));
    }
  });
  vscode.commands.registerCommand('magento-log-viewer.openFileAtLine', (filePath: string, lineNumber: number) => {
    const options: vscode.TextDocumentShowOptions = {
      selection: new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, 0))
    };
    vscode.window.showTextDocument(vscode.Uri.file(filePath), options);
  });

  vscode.commands.registerCommand('magento-log-viewer.clearAllLogFiles', () => {
    const logPath = path.join(magentoRoot, 'var', 'log');
    if (logViewerProvider.pathExists(logPath)) {
      const files = fs.readdirSync(logPath);
      files.forEach(file => fs.unlinkSync(path.join(logPath, file)));
      logViewerProvider.refresh();
      vscode.window.showInformationMessage('All log files have been cleared.');
    } else {
      vscode.window.showInformationMessage('No log files found to clear.');
    }
  });

  context.subscriptions.push(treeView);

  // Update the badge count
  const updateBadge = () => {
    const logFiles = logViewerProvider.getLogFilesWithoutUpdatingBadge(path.join(magentoRoot, 'var', 'log'));
    const totalEntries = logFiles.reduce((count, file) => count + parseInt(file.description?.match(/\d+/)?.[0] || '0', 10), 0);
    treeView.badge = { value: totalEntries, tooltip: `${totalEntries} log entries` };
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
