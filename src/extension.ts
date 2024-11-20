import * as vscode from 'vscode';
import { promptMagentoProjectSelection, showErrorMessage, activateExtension, isValidPath } from './helpers';

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
    activateExtension(context, magentoRoot);
  }
}

// This method is called when your extension is deactivated
export function deactivate(): void {}
