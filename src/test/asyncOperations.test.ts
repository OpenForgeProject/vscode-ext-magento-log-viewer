import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pathExists, pathExistsAsync, getCachedFileContentAsync, getCachedFileContent } from '../helpers';

suite('Async File Operations Test Suite', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magento-async-test-'));
    let testFilePath: string;

    setup(() => {
        // Create a test file for each test
        testFilePath = path.join(tempDir, 'async-test.log');
        fs.writeFileSync(testFilePath, 'Test content for async operations');
    });

    teardown(() => {
        // Clean up test file after each test
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    suiteTeardown(() => {
        // Clean up temp directory
        try {
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                files.forEach(file => {
                    fs.unlinkSync(path.join(tempDir, file));
                });
                fs.rmdirSync(tempDir);
            }
        } catch (err) {
            console.error('Failed to clean up test directory:', err);
        }
    });

    test('pathExistsAsync should work correctly for existing files', async () => {
        const exists = await pathExistsAsync(testFilePath);
        assert.strictEqual(exists, true, 'Should return true for existing file');
    });

    test('pathExistsAsync should work correctly for non-existing files', async () => {
        const nonExistentPath = path.join(tempDir, 'non-existent.log');
        const exists = await pathExistsAsync(nonExistentPath);
        assert.strictEqual(exists, false, 'Should return false for non-existing file');
    });

    test('pathExists and pathExistsAsync should return same results', async () => {
        const syncResult = pathExists(testFilePath);
        const asyncResult = await pathExistsAsync(testFilePath);
        assert.strictEqual(syncResult, asyncResult, 'Sync and async should return same result');

        const nonExistentPath = path.join(tempDir, 'non-existent.log');
        const syncResultFalse = pathExists(nonExistentPath);
        const asyncResultFalse = await pathExistsAsync(nonExistentPath);
        assert.strictEqual(syncResultFalse, asyncResultFalse, 'Sync and async should return same result for non-existing file');
    });

    test('getCachedFileContentAsync should read file content correctly', async () => {
        const content = await getCachedFileContentAsync(testFilePath);
        assert.strictEqual(content, 'Test content for async operations', 'Should read file content correctly');
    });

    test('getCachedFileContentAsync should handle non-existent files gracefully', async () => {
        const nonExistentPath = path.join(tempDir, 'non-existent.log');
        const content = await getCachedFileContentAsync(nonExistentPath);
        assert.strictEqual(content, null, 'Should return null for non-existent files');
    });

    test('getCachedFileContentAsync should handle large files with streaming', async () => {
        // Create a large test file (>50MB)
        const largeFilePath = path.join(tempDir, 'large-async-test.log');
        const largeContent = 'x'.repeat(51 * 1024 * 1024); // 51MB of content

        fs.writeFileSync(largeFilePath, largeContent);

        try {
            const content = await getCachedFileContentAsync(largeFilePath);
            assert.strictEqual(content, largeContent, 'Should read large file content correctly using streaming');
        } finally {
            // Clean up large file
            if (fs.existsSync(largeFilePath)) {
                fs.unlinkSync(largeFilePath);
            }
        }
    });

    test('getCachedFileContentAsync should cache content correctly', async () => {
        // First call - should read from file
        const firstCall = await getCachedFileContentAsync(testFilePath);
        assert.strictEqual(firstCall, 'Test content for async operations', 'First call should read file content');

        // Second call without file modification - should return cached content
        const secondCall = await getCachedFileContentAsync(testFilePath);
        assert.strictEqual(secondCall, 'Test content for async operations', 'Second call should return cached content');
    });

    test('getCachedFileContentAsync performance should be reasonable', async () => {
        const startTime = Date.now();

        // Read the same file multiple times
        for (let i = 0; i < 10; i++) {
            await getCachedFileContentAsync(testFilePath);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete quickly due to caching
        assert.ok(duration < 1000, `Multiple async reads should complete quickly, took ${duration}ms`);
    });

    test('Async and sync getCachedFileContent should return same results', async () => {
        const syncContent = getCachedFileContent(testFilePath);
        const asyncContent = await getCachedFileContentAsync(testFilePath);

        assert.strictEqual(syncContent, asyncContent, 'Sync and async content reading should return same results');
    });
});
