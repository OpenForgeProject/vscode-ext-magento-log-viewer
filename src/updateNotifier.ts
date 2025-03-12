import * as vscode from 'vscode';

export async function showUpdateNotification(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension('MathiasElle.magento-log-viewer');
    if (!extension) {
        return;
    }

    const currentVersion = extension.packageJSON.version;
    const lastVersion = context.globalState.get<string>('lastVersion');

    if (lastVersion !== currentVersion) {
        const action = await vscode.window.showInformationMessage(
            `Magento Log Viewer wurde auf Version ${currentVersion} ✨!`,
            '❤️ Support this Project',
            'Changelog',
            'GitHub'
        );

        if (action === 'GitHub') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer'));
        } else if (action === 'Changelog') {
            const changelogPath = vscode.Uri.joinPath(extension.extensionUri, 'CHANGELOG.md');
            const doc = await vscode.workspace.openTextDocument(changelogPath);
            await vscode.window.showTextDocument(doc);
        } else if (action === '❤️ Support this Project') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/dermatz'));
        }

        await context.globalState.update('lastVersion', currentVersion);
    }
}
