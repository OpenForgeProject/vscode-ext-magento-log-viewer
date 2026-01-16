/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from 'vscode';

const EXTENSION_ID = 'MathiasElle.magento-log-viewer';
const STORAGE_KEY = 'lastVersion';
const URLS = {
    GITHUB: 'https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer',
    SPONSOR: 'https://github.com/sponsors/dermatz'
};
const ACTIONS = {
    SUPPORT: '❤️ Support this Project',
    CHANGELOG: 'Changelog',
    GITHUB: 'GitHub'
};

/**
 * Shows a notification when the extension is updated.
 * @param context Extension context
 */
export async function showUpdateNotification(context: vscode.ExtensionContext): Promise<void> {
    try {
        const lastVersion = context.globalState.get<string>(STORAGE_KEY);

        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        if (!extension) {
            console.warn(`Extension ${EXTENSION_ID} could not be found.`);
            return;
        }

        const currentVersion = extension.packageJSON.version;

        // check if the extension has been updated
        if (lastVersion === currentVersion) {
            return;
        }

        const action = await vscode.window.showInformationMessage(
            `Magento Log Viewer was updated to Version ${currentVersion} ✨!`,
            ACTIONS.SUPPORT,
            ACTIONS.CHANGELOG,
            ACTIONS.GITHUB
        );

        switch (action) {
            case ACTIONS.GITHUB:
                await vscode.env.openExternal(vscode.Uri.parse(URLS.GITHUB));
                break;
            case ACTIONS.CHANGELOG:
                try {
                    const changelogPath = vscode.Uri.joinPath(extension.extensionUri, 'CHANGELOG.md');
                    const doc = await vscode.workspace.openTextDocument(changelogPath);
                    await vscode.window.showTextDocument(doc);
                } catch (error) {
                    console.error('Error opening changelog:', error);
                }
                break;
            case ACTIONS.SUPPORT:
                await vscode.env.openExternal(vscode.Uri.parse(URLS.SPONSOR));
                break;
        }

        // Update the last version in global state
        await context.globalState.update(STORAGE_KEY, currentVersion);
    } catch (error) {
        console.error('Fehler in showUpdateNotification:', error);
    }
}
