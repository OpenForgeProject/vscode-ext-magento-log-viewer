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
			config.update('magentoLogViewer.isMagentoProject', selection, vscode.ConfigurationTarget.Global);
		});
	}

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
