import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import the caching functions
import { getCachedFileContent, clearFileContentCache, invalidateFileCache } from '../helpers';

suite('File Caching Test Suite', () => {
    // Create a temporary directory for test files
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magento-cache-test-'));
    const testContent = 'Initial test content for caching';

    // Helper function to create a unique test file for each test
    function createTestFile(suffix: string = ''): string {
        const testFilePath = path.join(tempDir, `test-cache${suffix}.log`);
        fs.writeFileSync(testFilePath, testContent);
        return testFilePath;
    }

    // Set up and tear down
    suiteSetup(() => {
        // Clear cache before starting tests
        clearFileContentCache();
    });

    setup(() => {
        // Clear cache before each test
        clearFileContentCache();
    });

    suiteTeardown(() => {
        // Clean up test files after tests
        try {
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(tempDir, file));
            });
            fs.rmdirSync(tempDir);
        } catch (err) {
            console.error('Failed to clean up test files:', err);
        }
        // Clear cache after tests
        clearFileContentCache();
    });

    test('getCachedFileContent should read file content correctly', () => {
        const testFilePath = createTestFile('-read');
        const content = getCachedFileContent(testFilePath);
        assert.strictEqual(content, testContent, 'Should read file content correctly');
    });

    test('getCachedFileContent should return cached content on second call', async () => {
        const testFilePath = createTestFile('-cached');

        // First call - should read from file
        const firstCall = getCachedFileContent(testFilePath);
        assert.strictEqual(firstCall, testContent, 'First call should read file content');

        // Wait a bit to ensure different modification time
        await new Promise(resolve => setTimeout(resolve, 100));

        // Modify file content directly (simulating external change)
        const modifiedContent = 'Modified content';
        fs.writeFileSync(testFilePath, modifiedContent);

        // Second call - should return new content because mtime changed
        const secondCall = getCachedFileContent(testFilePath);
        assert.strictEqual(secondCall, modifiedContent, 'Should return updated content when file is modified');
    });

    test('clearFileContentCache should clear all cached content', () => {
        const testFilePath = createTestFile('-clear');

        // Cache some content
        getCachedFileContent(testFilePath);

        // Clear cache
        clearFileContentCache();

        // Modify file
        const newContent = 'Content after cache clear';
        fs.writeFileSync(testFilePath, newContent);

        // Should read fresh content
        const content = getCachedFileContent(testFilePath);
        assert.strictEqual(content, newContent, 'Should read fresh content after cache clear');
    });

    test('invalidateFileCache should invalidate specific file cache', () => {
        const testFilePath = createTestFile('-invalidate');

        // Cache the file
        getCachedFileContent(testFilePath);

        // Invalidate specific file
        invalidateFileCache(testFilePath);

        // Modify file
        const newContent = 'Content after specific invalidation';
        fs.writeFileSync(testFilePath, newContent);

        // Should read fresh content
        const content = getCachedFileContent(testFilePath);
        assert.strictEqual(content, newContent, 'Should read fresh content after specific file cache invalidation');
    });

    test('getCachedFileContent should handle large files correctly', () => {
        // Create a large test file (over 5MB)
        const largeFilePath = path.join(tempDir, 'large-test.log');
        const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB of content

        fs.writeFileSync(largeFilePath, largeContent);

        // Should still read content but not cache it
        const content = getCachedFileContent(largeFilePath);
        assert.strictEqual(content, largeContent, 'Should read large file content correctly');

        // Clean up
        fs.unlinkSync(largeFilePath);
    });

    test('getCachedFileContent should handle non-existent files gracefully', () => {
        const nonExistentPath = path.join(tempDir, 'non-existent.log');
        const content = getCachedFileContent(nonExistentPath);
        assert.strictEqual(content, null, 'Should return null for non-existent files');
    });

    test('Cache should respect file modification time', async () => {
        const testFilePath = createTestFile('-mtime');

        // Get initial content and cache it
        const initialContent = getCachedFileContent(testFilePath);
        assert.strictEqual(initialContent, testContent);

        // Wait a bit to ensure different modification time
        await new Promise(resolve => setTimeout(resolve, 100));

        // Modify the file with new content
        const updatedContent = 'Updated content with new timestamp';
        fs.writeFileSync(testFilePath, updatedContent);

        // Should return updated content due to newer modification time
        const newContent = getCachedFileContent(testFilePath);
        assert.strictEqual(newContent, updatedContent, 'Should return updated content when file mtime is newer');
    });

    test('Cache should return cached content when file has not changed', () => {
        const testFilePath = createTestFile('-unchanged');

        // Cache the file first
        const firstCall = getCachedFileContent(testFilePath);
        assert.strictEqual(firstCall, testContent);

        // Call again without modifying the file - should return cached content
        const secondCall = getCachedFileContent(testFilePath);
        assert.strictEqual(secondCall, testContent, 'Should return same content when file has not changed');
    });
});
