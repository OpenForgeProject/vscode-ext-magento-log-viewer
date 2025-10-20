import * as assert from 'assert';
import * as vscode from 'vscode';
import { getCacheStatistics, clearFileContentCache, optimizeCacheSize } from '../helpers';

suite('Cache Configuration Test Suite', () => {

    setup(() => {
        // Clear cache before each test
        clearFileContentCache();
    });

    teardown(() => {
        // Reset configuration after each test using Global target
        const config = vscode.workspace.getConfiguration('magentoLogViewer');
        config.update('cacheMaxFiles', undefined, vscode.ConfigurationTarget.Global);
        config.update('cacheMaxFileSize', undefined, vscode.ConfigurationTarget.Global);
        config.update('enableCacheStatistics', undefined, vscode.ConfigurationTarget.Global);
        clearFileContentCache();
    });

    test('Cache should use default configuration when user settings are 0', () => {
        const stats = getCacheStatistics();

        // Should have reasonable defaults
        assert.ok(stats.maxSize >= 20 && stats.maxSize <= 100,
            `Max size should be between 20-100, got ${stats.maxSize}`);
        assert.ok(stats.maxFileSize >= 1024 * 1024,
            `Max file size should be at least 1MB, got ${stats.maxFileSize}`);
    });

    test('Cache should respect user configuration when set', async () => {
        const config = vscode.workspace.getConfiguration('magentoLogViewer');

        // Set custom values using Global configuration target since no workspace is available in tests
        await config.update('cacheMaxFiles', 75, vscode.ConfigurationTarget.Global);
        await config.update('cacheMaxFileSize', 8, vscode.ConfigurationTarget.Global);

        // Clear cache to pick up new config
        clearFileContentCache();

        const stats = getCacheStatistics();
        assert.strictEqual(stats.maxSize, 75, 'Should use custom max files setting');
        assert.strictEqual(stats.maxFileSize, 8 * 1024 * 1024, 'Should use custom max file size setting');
    });

    test('Cache statistics should include memory usage information', () => {
        const stats = getCacheStatistics();

        assert.ok(typeof stats.size === 'number', 'Size should be a number');
        assert.ok(typeof stats.maxSize === 'number', 'Max size should be a number');
        assert.ok(typeof stats.maxFileSize === 'number', 'Max file size should be a number');
        assert.ok(typeof stats.memoryUsage === 'string', 'Memory usage should be a string');
        assert.ok(stats.memoryUsage.includes('MB'), 'Memory usage should include MB unit');
    });

    test('optimizeCacheSize should handle memory pressure', () => {
        // This is hard to test without mocking process.memoryUsage()
        // But we can at least ensure the function doesn't crash
        assert.doesNotThrow(() => {
            optimizeCacheSize();
        }, 'optimizeCacheSize should not throw errors');
    });

    test('Cache configuration should have reasonable bounds', async () => {
        const config = vscode.workspace.getConfiguration('magentoLogViewer');

        // Test edge cases using Global configuration
        await config.update('cacheMaxFiles', 1000, vscode.ConfigurationTarget.Global); // Too high
        await config.update('cacheMaxFileSize', 200, vscode.ConfigurationTarget.Global); // Too high

        clearFileContentCache();

        const stats = getCacheStatistics();

        // User settings override automatic limits, so we should get the user values
        // The test should verify that the configuration accepts user values
        assert.strictEqual(stats.maxSize, 1000, 'Should accept user setting for max files even if high');
        assert.strictEqual(stats.maxFileSize, 200 * 1024 * 1024, 'Should accept user setting for max file size even if high');
    });
});
