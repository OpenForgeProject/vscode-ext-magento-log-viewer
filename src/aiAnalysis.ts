/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from 'vscode';
import { showErrorMessage } from './helpers';
import { LogItem } from './logViewer';

export async function explainError(item?: unknown): Promise<void> {
    let textToAnalyze = '';

    // Check if called from tree view
    if (item instanceof LogItem && item.contextValue === 'logEntry' && item.rawText) {
        textToAnalyze = item.rawText;
    } else {
        // Fallback to active editor
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            textToAnalyze = editor.document.getText(selection);

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

    // Check if Language Model API is available
    if (!vscode.lm || !vscode.lm.selectChatModels) {
        const action = await vscode.window.showInformationMessage(
            'The AI features require VS Code 1.90+ and the "vscode.lm" API availability.',
            'OK'
        );
        return;
    }

    try {
        // Select a model - prefer GPT-4 or similar high-quality models
        const models = await vscode.lm.selectChatModels({ family: 'gpt-4' });
        let model = models[0];

        // Fallback to any model if specific family not found
        if (!model) {
            const allModels = await vscode.lm.selectChatModels();
            if (allModels.length > 0) {
                model = allModels[0];
            }
        }

        if (!model) {
            const action = await vscode.window.showWarningMessage(
                'No AI models found. Please ensure you have GitHub Copilot Chat or another AI extension installed and active.',
                'Install GitHub Copilot Chat'
            );
            if (action === 'Install GitHub Copilot Chat') {
                vscode.commands.executeCommand('workbench.extensions.installExtension', 'GitHub.copilot-chat');
            }
            return;
        }

        // Create a new untitled markdown file for the response
        const doc = await vscode.workspace.openTextDocument({
            content: '# Magento Error Analysis\n\nAnalyzing...\n',
            language: 'markdown'
        });
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        // Prepare the prompt
        const prompt = `You are an expert Magento 2 developer.
        Analyze the following error log entry from a Magento application.
        Provide a clear, concise explanation of what caused the error and suggest 1-3 concrete solutions or debugging steps.

        Error Log:
        \`\`\`
        ${textToAnalyze}
        \`\`\`

        Response format:
        ## Explanation
        ...

        ## Potential Solutions
        1. ...
        2. ...

        ## Troubleshooting
        ...
        `;

        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];

        // Send request and stream response to the document
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        let fullResponse = '';

        // Clear the initial "Analyzing..." text
        await editor.edit(edit => {
            const range = new vscode.Range(new vscode.Position(2, 0), new vscode.Position(3, 0));
            edit.replace(range, '');
        });

        // Stream the chunks
        for await (const chunk of response.text) {
            fullResponse += chunk;
            await editor.edit(edit => {
                const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
                const position = lastLine.range.end;
                edit.insert(position, chunk);
            });
        }

    } catch (error) {
        if (error instanceof Error) {
            showErrorMessage(`AI Analysis failed: ${error.message}`);
        } else {
            showErrorMessage('AI Analysis failed with an unknown error.');
        }
        console.error(error);
    }
}
