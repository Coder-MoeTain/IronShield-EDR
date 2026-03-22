import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FalconPagination from './FalconPagination';

describe('FalconPagination', () => {
  it('renders range and disables previous on first page', () => {
    render(
      <FalconPagination
        offset={0}
        limit={50}
        total={120}
        pageItemCount={50}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByText('1–50 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('renders page size when onLimitChange provided', () => {
    render(
      <FalconPagination
        offset={0}
        limit={25}
        total={80}
        pageItemCount={25}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/rows per page/i)).toBeInTheDocument();
  });
});
