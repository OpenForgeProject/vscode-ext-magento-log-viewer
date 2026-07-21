/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import { LogItem } from "../logItem";

export abstract class BaseLogProvider
  implements vscode.TreeDataProvider<LogItem>, vscode.Disposable
{
  protected _onDidChangeTreeData: vscode.EventEmitter<
    LogItem | undefined | void
  > = new vscode.EventEmitter<LogItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<LogItem | undefined | void> =
    this._onDidChangeTreeData.event;
  protected groupByMessage: boolean;
  protected disposables: vscode.Disposable[] = [];
  protected isInitialized: boolean = false;
  public searchTerm: string = "";
  public searchCaseSensitive: boolean = false;
  public searchUseRegex: boolean = false;
  protected cachedSearchRegex: RegExp | null = null;
  protected lastSearchTerm: string = "";
  protected lastSearchFlags: string = "";

  constructor(protected workspaceRoot: string) {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri || null;
    const config = vscode.workspace.getConfiguration(
      "magentoLogViewer",
      workspaceUri,
    );
    this.groupByMessage = config.get<boolean>("groupByMessage", true);
    this.searchCaseSensitive = config.get<boolean>(
      "searchCaseSensitive",
      false,
    );
    this.searchUseRegex = config.get<boolean>("searchUseRegex", false);
  }

  protected async initializeAsync(): Promise<void> {
    try {
      // Wait a bit for VS Code indexing to settle
      await new Promise((resolve) => setTimeout(resolve, 300));
      this.onInitializationComplete();
      this.isInitialized = true;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error(
        `Error during ${this.constructor.name} initialization:`,
        error,
      );
      this.isInitialized = true; // Set to true anyway to prevent blocking
      this._onDidChangeTreeData.fire();
    }
  }

  protected onInitializationComplete(): void {
    // Override in subclass if needed
  }

  abstract updateRefreshButtonVisibility(): void;

  public refresh(specificFilePath?: string): void {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage(
        "No workspace root found. Please open a Magento project.",
      );
      return;
    }
    this._onDidChangeTreeData.fire();
  }

  public matchesSearchTerm(text: string): boolean {
    if (!this.searchTerm) {
      return true; // No search term, show all
    }

    try {
      if (this.searchUseRegex) {
        const flags = this.searchCaseSensitive ? "g" : "gi";

        // Cache regex compilation
        if (
          !this.cachedSearchRegex ||
          this.lastSearchTerm !== this.searchTerm ||
          this.lastSearchFlags !== flags
        ) {
          this.cachedSearchRegex = new RegExp(this.searchTerm, flags);
          this.lastSearchTerm = this.searchTerm;
          this.lastSearchFlags = flags;
        }

        return this.cachedSearchRegex.test(text);
      } else {
        const searchText = this.searchCaseSensitive ? text : text.toLowerCase();
        const searchTerm = this.searchCaseSensitive
          ? this.searchTerm
          : this.searchTerm.toLowerCase();
        return searchText.includes(searchTerm);
      }
    } catch (error) {
      // Invalid regex, fall back to simple string search
      this.cachedSearchRegex = null;
      const searchText = this.searchCaseSensitive ? text : text.toLowerCase();
      const searchTerm = this.searchCaseSensitive
        ? this.searchTerm
        : this.searchTerm.toLowerCase();
      return searchText.includes(searchTerm);
    }
  }

  public clearSearch(): void {
    this.searchTerm = "";
    this.cachedSearchRegex = null;
    this.lastSearchTerm = "";
    this.lastSearchFlags = "";
    this.updateRefreshButtonVisibility();
    this.refresh();
    vscode.window.showInformationMessage("Search cleared");
  }

  abstract getTreeItem(element: LogItem): vscode.TreeItem;
  abstract getChildren(element?: LogItem): Thenable<LogItem[]>;

  dispose() {
    this._onDidChangeTreeData.dispose();
    this.cachedSearchRegex = null;
    this.lastSearchTerm = "";
    this.lastSearchFlags = "";
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
