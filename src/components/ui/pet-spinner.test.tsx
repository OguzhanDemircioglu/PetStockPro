/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PetSpinner } from './pet-spinner';

describe('PetSpinner', () => {
  it('sm size — 12px border circle + sr-only label', () => {
    render(<PetSpinner size="sm" label="Yüklüyor" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('data-spinner-size', 'sm');
    expect(screen.getByText('Yüklüyor')).toHaveClass('sr-only');
    // Inner span animate-spin
    const inner = status.querySelector('.animate-spin');
    expect(inner).toBeInTheDocument();
  });

  it('md size — paw SVG + animate-spin', () => {
    const { container } = render(<PetSpinner size="md" tone="cart" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-spinner-size', 'md');
    expect(status).toHaveAttribute('data-spinner-tone', 'cart');
    const svg = container.querySelector('svg.animate-spin');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('lg size — animate-paw-pulse + showLabel ile visible label', () => {
    const { container } = render(
      <PetSpinner size="lg" showLabel label="Vitrin yükleniyor" />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-spinner-size', 'lg');
    const svg = container.querySelector('svg.animate-paw-pulse');
    expect(svg).toBeInTheDocument();
    // showLabel=true + lg → visible label (sr-only DEĞİL)
    const label = screen.getByText('Vitrin yükleniyor');
    expect(label).not.toHaveClass('sr-only');
  });

  it('inline prop → display:inline-block class', () => {
    render(<PetSpinner size="sm" inline />);
    const status = screen.getByRole('status');
    expect(status.className).toContain('inline-block');
    expect(status.className).not.toContain('inline-flex');
  });

  it('default — sr-only label görünmez ama mevcut (a11y)', () => {
    render(<PetSpinner />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    // Default label
    const label = screen.getByText('Yükleniyor…');
    expect(label).toHaveClass('sr-only');
  });

  it('tone="arrow" → svg color var(--arrow)', () => {
    const { container } = render(<PetSpinner size="md" tone="arrow" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ color: 'var(--arrow)' });
  });
});
