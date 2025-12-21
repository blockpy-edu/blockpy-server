import { expect, afterEach } from 'vitest';
import { cleanup } from '@solidjs/testing-library';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
