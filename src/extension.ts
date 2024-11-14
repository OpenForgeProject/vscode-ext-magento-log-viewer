// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "magento-log-viewer" is now active!');

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

	const logViewerProvider = new MagentoLogViewerProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MagentoLogViewerProvider.viewType, logViewerProvider)
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('magento-log-viewer.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from magento-log-viewer!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

class MagentoLogViewerProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'magentoLogViewerView';

	constructor(private readonly extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Magento Logs</title>
			</head>
			<body>
				<h1>Magento Logs</h1>
				<div id="logs">Log files will be displayed here.</div>
			</body>
			</html>`;
	}
}
