/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from 'vscode';

const STORAGE_KEY = 'lastVersion';
const URLS = {
    GITHUB: 'https://github.com/OpenForgeProject/vscode-ext-magento-log-viewer',
    SPONSOR: 'https://github.com/sponsors/dermatz'
};
const ACTIONS = {
    SUPPORT: '☕️✨ Buy me a coffee',
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
        const currentVersion = context.extension.packageJSON.version;

        // Always update the stored version immediately to prevent duplicate notifications
        if (lastVersion !== currentVersion) {
            await context.globalState.update(STORAGE_KEY, currentVersion);
        }

        // Detect new installation or unchanged version
        if (!lastVersion || lastVersion === currentVersion) {
            return;
        }

        // Handle the user interaction asynchronously to avoid blocking startup
        void handleUpdateNotification(context, currentVersion).catch(error => {
            console.error('Error handling update notification interaction:', error);
        });
    } catch (error) {
        console.error('Error in showUpdateNotification:', error);
    }
}

async function handleUpdateNotification(context: vscode.ExtensionContext, currentVersion: string): Promise<void> {
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
        case ACTIONS.CHANGELOG: {
            const changelogPath = vscode.Uri.joinPath(context.extensionUri, 'CHANGELOG.md');
            const doc = await vscode.workspace.openTextDocument(changelogPath);
            await vscode.window.showTextDocument(doc);
            break;
        }
        case ACTIONS.SUPPORT:
            await vscode.env.openExternal(vscode.Uri.parse(URLS.SPONSOR));
            break;
    }
}
