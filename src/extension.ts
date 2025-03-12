import * as vscode from 'vscode';
import { promptMagentoProjectSelection, showErrorMessage, activateExtension, isValidPath, deleteReportFile } from './helpers';
import { LogItem, ReportViewerProvider } from './logViewer';
import { showUpdateNotification } from './updateNotifier';

let disposables: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext): void {

  // Show Update-Popup
  showUpdateNotification(context);

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceUri = workspaceFolders?.[0]?.uri || null;

  const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
  const isMagentoProject = config.get<string>('isMagentoProject', 'Please select');

  if (isMagentoProject === 'Please select') {
    promptMagentoProjectSelection(config, context);
  } else if (isMagentoProject === 'Yes') {
    const magentoRoot = config.get<string>('magentoRoot', '');
    if (!magentoRoot || !isValidPath(magentoRoot)) {
      showErrorMessage('Magento root path is not set or is not a directory.');
      return;
    }
    const reportViewerProvider = new ReportViewerProvider(magentoRoot);
    activateExtension(context, magentoRoot, reportViewerProvider);

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
}

export function deactivate(): void {
  // Clear any context values we set
  vscode.commands.executeCommand('setContext', 'magentoLogViewer.hasMagentoRoot', undefined);

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
