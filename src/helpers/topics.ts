/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (c) 2024-2026 OpenForge Project Contributors
 */

// Precompiled fallback patterns for topic grouping.
// This is a performance-sensitive path: each log entry is tested against these patterns.
const fallbackPatterns = [
  { pattern: /database|sql|transaction/i, topic: "Database" },
  { pattern: /cache|redis|varnish/i, topic: "Cache" },
  { pattern: /session/i, topic: "Session" },
  { pattern: /payment/i, topic: "Payment" },
  { pattern: /checkout/i, topic: "Checkout" },
  { pattern: /catalog/i, topic: "Catalog" },
  { pattern: /customer/i, topic: "Customer" },
  { pattern: /order/i, topic: "Order" },
  { pattern: /shipping/i, topic: "Shipping" },
  { pattern: /tax/i, topic: "Tax" },
  { pattern: /inventory/i, topic: "Inventory" },
  { pattern: /indexer/i, topic: "Indexer" },
  { pattern: /cron/i, topic: "Cron" },
  { pattern: /email|newsletter/i, topic: "Email" },
  { pattern: /search|algolia|elasticsearch/i, topic: "Search" },
  { pattern: /api|graphql|rest|soap/i, topic: "API" },
  { pattern: /admin/i, topic: "Admin" },
  { pattern: /frontend|backend/i, topic: "Frontend/Backend" },
  {
    pattern: /theme|layout|template|block|widget/i,
    topic: "Theme/Layout",
  },
  { pattern: /module|plugin|observer|event/i, topic: "Module/Plugin" },
  { pattern: /url|rewrite/i, topic: "URL" },
  { pattern: /media|image|upload/i, topic: "Media" },
  { pattern: /import|export/i, topic: "Import/Export" },
  { pattern: /translation|locale/i, topic: "Translation" },
  { pattern: /store|website|scope/i, topic: "Store" },
  { pattern: /config/i, topic: "Configuration" },
  { pattern: /memory|timeout|performance/i, topic: "Performance" },
  {
    pattern:
      /security|authentication|authorization|permission|access|login|logout/i,
    topic: "Security",
  },
];

/**
 * Assigns a topic to a log message.
 * First checks for an explicit "Topic:" prefix, then falls back to keyword matching.
 */
export function assignTopic(message: string): string {
  // First priority: explicit topic prefix like "[Topic]:"
  const dynamicTopicMatch = message.match(/^([^:]+):/);
  if (dynamicTopicMatch) {
    return dynamicTopicMatch[1].trim();
  }

  // Fallback: keyword-based topic detection
  for (const { pattern, topic } of fallbackPatterns) {
    if (pattern.test(message)) {
      return topic;
    }
  }

  return "Other";
}
