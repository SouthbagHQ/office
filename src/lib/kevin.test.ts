import { describe, expect, it } from 'vitest';
import { normalizeKevin } from './kevin';

describe('normalizeKevin', () => {
  it('capitalizes every spelling of Kevin', () => {
    expect(normalizeKevin('kevin KEVIN kEvIn kevinship')).toBe('Kevin Kevin Kevin Kevinship');
  });
});
