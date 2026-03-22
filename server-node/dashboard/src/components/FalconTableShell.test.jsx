import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FalconTableShell from './FalconTableShell';

describe('FalconTableShell', () => {
  it('renders toolbar, main, and footer', () => {
    render(
      <FalconTableShell
        toolbar={<span data-testid="tb">Filters</span>}
        footer={<span data-testid="ft">Page 1</span>}
      >
        <table data-testid="tbl">
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
      </FalconTableShell>
    );
    expect(screen.getByTestId('tb')).toBeInTheDocument();
    expect(screen.getByTestId('tbl')).toBeInTheDocument();
    expect(screen.getByTestId('ft')).toBeInTheDocument();
  });
});
