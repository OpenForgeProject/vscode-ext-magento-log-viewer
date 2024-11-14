import * as vscode from 'vscode';
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
