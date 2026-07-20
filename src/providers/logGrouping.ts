/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

import * as vscode from "vscode";
import { LogItem } from "../logItem";
import { getIconForLogLevel, formatTimestamp } from "../helpers/logParser";
import { assignTopic } from "../helpers/topics";

export interface LogEntry {
  message: string;
  line: string;
  lineNumber: number;
}

export function groupLogEntries(
  groupByMessage: boolean,
  matchesSearchTerm: (text: string) => boolean,
  lines: string[],
  filePath: string,
): LogItem[] {
  const groupedByType = new Map<string, LogEntry[]>();

  lines.forEach((line, index) => {
    const match = line.match(/\.([A-Za-z]+):/);
    if (match) {
      const level = match[1].toUpperCase();
      const message = line.replace(
        /^\[.*?\]\s*(?:[A-Za-z0-9_]+)?\.[A-Za-z]+:\s*/,
        "",
      );

      if (matchesSearchTerm(line) || matchesSearchTerm(message)) {
        const entries = groupedByType.get(level) || [];
        entries.push({ message, line, lineNumber: index });
        groupedByType.set(level, entries);
      }
    }
  });

  return Array.from(groupedByType.entries())
    .map(([level, entries]) => {
      if (groupByMessage) {
        const groupedByTopic = groupByTopics(entries);

        const topicGroups = Array.from(groupedByTopic.entries())
          .map(([topic, topicEntries]) => {
            const logEntries = topicEntries
              .map((entry) => createLogEntryItem(entry, filePath))
              .sort((a, b) => {
                const aLine = parseInt(
                  a.label.match(/Line (\d+)/)?.[1] || "0",
                );
                const bLine = parseInt(
                  b.label.match(/Line (\d+)/)?.[1] || "0",
                );
                return aLine - bLine;
              });

            if (topicEntries.length > 0) {
              const topicCount = topicEntries.length;
              const topicLabel = `${topic} (${topicCount})`;
              return new LogItem(
                topicLabel,
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                logEntries,
              );
            }
            return null;
          })
          .filter((item): item is LogItem => item !== null)
          .sort((a, b) => {
            if (a.label.startsWith("Other")) {
              return 1;
            }
            if (b.label.startsWith("Other")) {
              return -1;
            }
            return a.label.localeCompare(b.label);
          });

        if (topicGroups.length > 0) {
          const logFile = new LogItem(
            `${level} (${entries.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            topicGroups,
          );
          logFile.iconPath = getIconForLogLevel(level);
          return logFile;
        }
        return null;
      } else {
        const filteredEntries = entries.filter(
          (entry) =>
            matchesSearchTerm(entry.message) ||
            matchesSearchTerm(entry.line),
        );

        if (filteredEntries.length > 0) {
          const logFile = new LogItem(
            `${level} (${filteredEntries.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            filteredEntries
              .map((entry) => createLogEntryItem(entry, filePath))
              .sort((a, b) => a.label.localeCompare(b.label)),
          );
          logFile.iconPath = getIconForLogLevel(level);
          return logFile;
        }
        return null;
      }
    })
    .filter((item): item is LogItem => item !== null)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function groupByTopics(entries: LogEntry[]): Map<string, LogEntry[]> {
  const groupedByTopic = new Map<string, LogEntry[]>();

  for (const entry of entries) {
    const topic = assignTopic(entry.message);
    const topicEntries = groupedByTopic.get(topic) || [];
    topicEntries.push(entry);
    groupedByTopic.set(topic, topicEntries);
  }

  return groupedByTopic;
}

function createLogEntryItem(entry: LogEntry, filePath: string): LogItem {
  const lineNumber = (entry.lineNumber + 1).toString().padStart(2, "0");
  const formattedLine = formatTimestamp(entry.line);
  return new LogItem(
    `Line ${lineNumber}:  ${formattedLine}`,
    vscode.TreeItemCollapsibleState.None,
    {
      command: "magento-log-viewer.openFileAtLine",
      title: "Open Log File at Line",
      arguments: [filePath, entry.lineNumber],
    },
    undefined,
    undefined,
    "logEntry",
    entry.line,
  );
}
