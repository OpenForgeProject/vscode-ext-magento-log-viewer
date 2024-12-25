import * as vscode from 'vscode';
import { promptMagentoProjectSelection, showErrorMessage, activateExtension, isValidPath, deleteReportFile } from './helpers';
import { LogItem, ReportViewerProvider } from './logViewer';

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration();
  const isMagentoProject = config.get<string>('magentoLogViewer.isMagentoProject', 'Please select');

  if (isMagentoProject === 'Please select') {
    promptMagentoProjectSelection(config, context);
  } else if (isMagentoProject === 'Yes') {
    const magentoRoot = config.get<string>('magentoLogViewer.magentoRoot', '');
    if (!magentoRoot || !isValidPath(magentoRoot)) {
      showErrorMessage('Magento root path is not set or is not a directory.');
      return;
    }
    const reportViewerProvider = new ReportViewerProvider(magentoRoot);
    activateExtension(context, magentoRoot, reportViewerProvider);

    vscode.commands.registerCommand('magento-log-viewer.deleteReportFile', (logItem: LogItem) => {
      if (logItem && logItem.command && logItem.command.arguments && logItem.command.arguments[0]) {
        const filePath = logItem.command.arguments[0];
        deleteReportFile(filePath);
        reportViewerProvider.refresh();
      } else {
        showErrorMessage('Failed to delete report file: Invalid file path.');
      }
    });
  }
}

export function deactivate(): void {}
