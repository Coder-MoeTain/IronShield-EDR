import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FalconEmptyState from './FalconEmptyState';

describe('FalconEmptyState', () => {
  it('renders title and description with status role', () => {
    render(<FalconEmptyState title="Nothing here" description="Try another filter." />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try another filter.')).toBeInTheDocument();
  });

  it('renders optional icon and children', () => {
    render(
      <FalconEmptyState title="Empty" icon="📭">
        <button type="button">Reset</button>
      </FalconEmptyState>
    );
    expect(screen.getByText('📭')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });
});
