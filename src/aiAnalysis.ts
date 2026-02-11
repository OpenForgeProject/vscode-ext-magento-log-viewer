/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from 'vscode';
import { showErrorMessage } from './helpers';
import { LogItem } from './logViewer';

export async function explainError(item?: unknown): Promise<void> {
    let textToAnalyze = '';
    let filePath = '';

    // Check if called from tree view
    if (item instanceof LogItem && item.contextValue === 'logEntry' && item.rawText) {
        textToAnalyze = item.rawText;
        // Try to obtain file path from command arguments
        if (item.command?.arguments?.[0]) {
            filePath = String(item.command.arguments[0]);
        }
    } else {
        // Fallback to active editor
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            textToAnalyze = editor.document.getText(selection);
            filePath = editor.document.uri.fsPath;

            // If no selection, take the current line
            if (!textToAnalyze.trim()) {
                textToAnalyze = editor.document.lineAt(selection.active.line).text;
            }
        }
    }

    if (!textToAnalyze.trim()) {
        showErrorMessage('Please select an error message or log entry to explain.');
        return;
    }

    try {
        // Construct a prompt that includes the error context
        // We limit the text length to avoid issues with extremely large logs
        const truncatedText = textToAnalyze.length > 2000
            ? textToAnalyze.substring(0, 2000) + '... (truncated)'
            : textToAnalyze;

        let prompt = `Explain this Magento error and suggest solutions:`;

        if (filePath) {
            const fileName = vscode.workspace.asRelativePath(filePath);
            prompt += `\nFile: ${fileName}`;
        }

        prompt += `\n\n${truncatedText}`;

        // Attempt to open the Copilot Chat view with the query
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt });

    } catch (error) {
        if (error instanceof Error) {
            showErrorMessage(`Failed to open Chat: ${error.message}`);
        } else {
            showErrorMessage('Failed to open Chat.');
        }
        console.error(error);
    }
}
