import * as vscode from 'vscode';
import * as path from 'path';
import { LogViewerProvider } from './logViewer';

export function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration();
	const isMagentoProject = config.get('magentoLogViewer.isMagentoProject', 'Please select');

	if (isMagentoProject === 'Please select') {
		vscode.window.showInformationMessage('Ist dies ein Magento Projekt?', 'Ja', 'Nein').then(selection => {
			if (selection === 'Ja') {
				vscode.window.showInformationMessage('Bitte wählen Sie den Magento Root Ordner aus.', 'Jetzt Magento Root auswählen').then(buttonSelection => {
					if (buttonSelection === 'Jetzt Magento Root auswählen') {
						vscode.window.showOpenDialog({ canSelectFolders: true, canSelectMany: false, openLabel: 'Select Magento Root Folder' }).then(folderUri => {
							if (folderUri && folderUri[0]) {
								config.update('magentoLogViewer.magentoRoot', folderUri[0].fsPath, vscode.ConfigurationTarget.Global).then(() => {
									vscode.window.showInformationMessage('Magento Root Ordner erfolgreich gespeichert!');
								});
							}
						});
					}
				});
			}
			config.update('magentoLogViewer.isMagentoProject', selection, vscode.ConfigurationTarget.Global);
		});
	}

	const magentoRoot = config.get('magentoLogViewer.magentoRoot', '');

	const logViewerProvider = new LogViewerProvider(magentoRoot);
	const treeView = vscode.window.createTreeView('logFiles', { treeDataProvider: logViewerProvider });

	vscode.commands.registerCommand('magento-log-viewer.refreshLogFiles', () => logViewerProvider.refresh());
	vscode.commands.registerCommand('magento-log-viewer.openFile', (resource) => {
		vscode.window.showTextDocument(vscode.Uri.file(resource));
	});

	context.subscriptions.push(treeView);

	// Update the badge count
	const updateBadge = () => {
		const logFiles = logViewerProvider.getLogFilesWithoutUpdatingBadge(path.join(magentoRoot, 'var', 'log'));
		treeView.badge = { value: logFiles.length, tooltip: `${logFiles.length} log files` };
	};

	logViewerProvider.onDidChangeTreeData(updateBadge);
	updateBadge();

	vscode.commands.executeCommand('setContext', 'magentoLogViewerBadge', 0);
}

// This method is called when your extension is deactivated
export function deactivate() {}
