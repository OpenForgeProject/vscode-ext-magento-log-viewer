import * as assert from 'assert';
import * as vscode from 'vscode';
import { getEffectiveMagentoRoot } from '../helpers';

suite('Magento Root Configuration Test Suite', () => {

    setup(() => {
        // Reset configuration before each test
        const config = vscode.workspace.getConfiguration('magentoLogViewer');
        config.update('magentoRoot', undefined, vscode.ConfigurationTarget.Global);
    });

    teardown(() => {
        // Reset configuration after each test
        const config = vscode.workspace.getConfiguration('magentoLogViewer');
        config.update('magentoRoot', undefined, vscode.ConfigurationTarget.Global);
    });

    test('getEffectiveMagentoRoot should return configured path when set', async () => {
        const config = vscode.workspace.getConfiguration('magentoLogViewer');
        const testPath = '/custom/magento/path';

        await config.update('magentoRoot', testPath, vscode.ConfigurationTarget.Global);

        const effectivePath = getEffectiveMagentoRoot();
        assert.strictEqual(effectivePath, testPath, 'Should return the configured Magento root path');
    });

    test('getEffectiveMagentoRoot should return workspace root when configuration is empty', async () => {
        // Explicitly set configuration to empty string
        const config = vscode.workspace.getConfiguration('magentoLogViewer');
        await config.update('magentoRoot', '', vscode.ConfigurationTarget.Global);

        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            const effectivePath = getEffectiveMagentoRoot();
            const expectedPath = workspaceFolders[0].uri.fsPath;
            assert.strictEqual(effectivePath, expectedPath, 'Should return workspace root when magentoRoot is empty');
        } else {
            // If no workspace is open, should return empty string
            const effectivePath = getEffectiveMagentoRoot();
            assert.strictEqual(effectivePath, '', 'Should return empty string when no workspace is open');
        }
    });

    test('getEffectiveMagentoRoot should return workspace root when configuration is whitespace only', async () => {
        const config = vscode.workspace.getConfiguration('magentoLogViewer');

        await config.update('magentoRoot', '   ', vscode.ConfigurationTarget.Global);

        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            const effectivePath = getEffectiveMagentoRoot();
            const expectedPath = workspaceFolders[0].uri.fsPath;
            assert.strictEqual(effectivePath, expectedPath, 'Should return workspace root when magentoRoot is only whitespace');
        } else {
            // If no workspace is open, should return empty string
            const effectivePath = getEffectiveMagentoRoot();
            assert.strictEqual(effectivePath, '', 'Should return empty string when no workspace is open');
        }
    });

    test('getEffectiveMagentoRoot should handle workspaceUri parameter', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceUri = workspaceFolders[0].uri;

            const config = vscode.workspace.getConfiguration('magentoLogViewer', workspaceUri);
            const testPath = '/workspace/specific/path';

            await config.update('magentoRoot', testPath, vscode.ConfigurationTarget.Workspace);

            const effectivePath = getEffectiveMagentoRoot(workspaceUri);
            assert.strictEqual(effectivePath, testPath, 'Should return workspace-specific configured path');
        }
    });

});
