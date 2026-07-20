/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import * as path from "path";
import { showInformationMessage, showErrorMessage } from "./messages";
import { activateExtension } from "./activation";
import { ReportViewerProvider } from "../logViewer";

// Prompts the user to confirm if the current project is a Magento project.
export function promptMagentoProjectSelection(
  config: vscode.WorkspaceConfiguration,
  context: vscode.ExtensionContext,
): void {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    vscode.window
      .showInformationMessage("Is this a Magento project?", "Yes", "No")
      .then((selection) => {
        if (selection === "Yes") {
          selectMagentoRootFolder(config, context);
        } else if (selection === "No") {
          updateConfig(config, "isMagentoProject", selection);
        }
      });
  }
}

// Prompts the user to select the Magento root folder and updates the configuration.
export function selectMagentoRootFolder(
  config: vscode.WorkspaceConfiguration,
  context: vscode.ExtensionContext,
): void {
  vscode.window
    .showInformationMessage(
      "Please select the Magento root folder.",
      "Select Magento Root Folder",
    )
    .then((buttonSelection) => {
      if (buttonSelection === "Select Magento Root Folder") {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const defaultUri =
          workspaceFolders && workspaceFolders.length > 0
            ? workspaceFolders[0].uri
            : undefined;
        vscode.window
          .showOpenDialog({
            defaultUri,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "Select Magento Root Folder",
          })
          .then((folderUri) => {
            if (folderUri?.[0]) {
              const workspaceUri =
                vscode.workspace.workspaceFolders?.[0]?.uri || null;
              const newConfig = vscode.workspace.getConfiguration(
                "magentoLogViewer",
                workspaceUri,
              );
              const relativePath = vscode.workspace.asRelativePath(
                folderUri[0].fsPath,
              );
              updateConfig(newConfig, "magentoRoot", relativePath).then(() => {
                showInformationMessage(
                  "Magento root folder successfully saved!",
                );
                updateConfig(newConfig, "isMagentoProject", "Yes");
                activateExtension(
                  context,
                  folderUri[0].fsPath,
                  new ReportViewerProvider(folderUri[0].fsPath),
                );
              });
            }
          });
      }
    });
}

// Directly opens the folder selection dialog without showing the information message first.
export function selectMagentoRootFolderDirect(
  config: vscode.WorkspaceConfiguration,
  context: vscode.ExtensionContext,
): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const defaultUri =
    workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri
      : undefined;
  vscode.window
    .showOpenDialog({
      defaultUri,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "Select Magento Root Folder",
      title: "Select Magento Root Folder",
    })
    .then((folderUri) => {
      if (folderUri?.[0]) {
        const workspaceUri =
          vscode.workspace.workspaceFolders?.[0]?.uri || null;
        const newConfig = vscode.workspace.getConfiguration(
          "magentoLogViewer",
          workspaceUri,
        );
        const relativePath = vscode.workspace.asRelativePath(
          folderUri[0].fsPath,
        );
        updateConfig(newConfig, "magentoRoot", relativePath).then(() => {
          showInformationMessage("Magento root folder successfully saved!");
          updateConfig(newConfig, "isMagentoProject", "Yes");
          activateExtension(
            context,
            folderUri[0].fsPath,
            new ReportViewerProvider(folderUri[0].fsPath),
          );
        });
      }
    });
}

// Opens folder selection dialog from Command Palette and updates the magentoRoot configuration.
export async function selectMagentoRootFromSettings(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceUri = workspaceFolders?.[0]?.uri || null;
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );

  // Open folder picker directly without confirmation dialog
  const defaultUri =
    workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri
      : undefined;

  const folderUri = await vscode.window.showOpenDialog({
    defaultUri,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Magento Root Folder",
    title: "Select Magento Root Folder",
  });

  if (folderUri?.[0]) {
    try {
      // Store the relative path instead of absolute path
      const relativePath = vscode.workspace.asRelativePath(folderUri[0].fsPath);
      await updateConfig(config, "magentoRoot", relativePath);

      // Also set the project as Magento project if not already set
      const isMagentoProject = config.get<string>(
        "isMagentoProject",
        "Please select",
      );
      if (isMagentoProject !== "Yes") {
        await updateConfig(config, "isMagentoProject", "Yes");
      }

      // Show success message with the new path
      showInformationMessage(`✅ Magento root updated to: ${relativePath}`);

      // Suggest reloading the window for changes to take effect
      const reload = await vscode.window.showInformationMessage(
        "Reload the window for all changes to take effect.",
        "Reload Window",
        "Later",
      );

      if (reload === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    } catch (error) {
      showErrorMessage(
        `Failed to update Magento root path: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

// Updates the specified configuration key with the given value.
export function updateConfig(
  config: vscode.WorkspaceConfiguration,
  key: string,
  value: unknown,
): Thenable<void> {
  return config.update(key, value, vscode.ConfigurationTarget.Workspace);
}

/**
 * Gets the effective Magento root path. If the configured path is empty,
 * returns the workspace root as the default.
 * @param workspaceUri The workspace URI to get configuration from
 * @returns string - The effective Magento root path
 */
export function getEffectiveMagentoRoot(
  workspaceUri?: vscode.Uri | null,
): string {
  const config = vscode.workspace.getConfiguration(
    "magentoLogViewer",
    workspaceUri,
  );
  const configuredRoot = config.get<string>("magentoRoot", "");
  const workspaceFolders = vscode.workspace.workspaceFolders;

  // If configured root is not empty, resolve it
  if (configuredRoot && configuredRoot.trim()) {
    // If it's already an absolute path, use it as is
    if (path.isAbsolute(configuredRoot)) {
      return configuredRoot;
    }

    // If it's a relative path, resolve it against the workspace root
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.resolve(workspaceFolders[0].uri.fsPath, configuredRoot);
    }

    // Fallback: return the configured path as is
    return configuredRoot;
  }

  // Otherwise, use workspace root as default
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }

  // Fallback: return empty string if no workspace
  return "";
}
