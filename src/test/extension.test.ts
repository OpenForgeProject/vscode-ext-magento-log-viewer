import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

const extensionId = 'MathiasElle.magento-log-viewer';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		const extension = vscode.extensions.getExtension(extensionId);
		assert.ok(extension, "Extension is not installed");
	});

	test('Extension should activate', async () => {
		const extension = vscode.extensions.getExtension(extensionId);
		if (extension) {
			await extension.activate();
			assert.ok(extension.isActive, "Extension is not active");
		}
	});

	test('Extension should start', async () => {
		const extension = vscode.extensions.getExtension(extensionId);
		if (extension) {
			await extension.activate();
			assert.ok(extension.isActive, "Extension did not start");
		}
	});

	test('Extension should add settings section', () => {
		const configuration = vscode.workspace.getConfiguration('magentoLogViewer');
		const isMagentoProject = configuration.get('isMagentoProject');
		assert.notStrictEqual(isMagentoProject, undefined, "Settings section 'magentoLogViewer' is not added");
	});

	test('Extension should prompt if it is a Magento project', async () => {
		const configuration = vscode.workspace.getConfiguration('magentoLogViewer');
		const isMagentoProject = configuration.get('isMagentoProject');
		assert.strictEqual(isMagentoProject, 'Please select', "Extension did not prompt if it is a Magento project");
	});

	test('Extension should have logo in activity bar', async () => {
		const activityBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		activityBarItem.text = '$(magento-logfile-viewer-logo)';
		activityBarItem.show();
		assert.strictEqual(activityBarItem.text, '$(magento-logfile-viewer-logo)', "Logo is not present in the activity bar");
	});

});
