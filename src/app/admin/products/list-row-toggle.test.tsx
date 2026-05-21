/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const publishMock = vi.fn();
const unpublishMock = vi.fn();

vi.mock('./[id]/edit/storefront-actions', () => ({
  publishProductAction: (...args: unknown[]) => publishMock(...args),
  unpublishProductAction: (...args: unknown[]) => unpublishMock(...args),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ListRowToggle } from './list-row-toggle';

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  publishMock.mockResolvedValue({ ok: true, issues: [] });
  unpublishMock.mockResolvedValue({ ok: true, issues: [] });
});

describe('ListRowToggle (optimistic vitrin Aç/Kapat)', () => {
  it('initial published=false → "Aç" buton render', () => {
    render(wrap(<ListRowToggle productId="p-1" initialPublished={false} />));
    expect(screen.getByRole('button')).toHaveTextContent('Aç');
  });

  it('initial published=true → "✓ Aktif" buton render', () => {
    render(wrap(<ListRowToggle productId="p-1" initialPublished={true} />));
    expect(screen.getByRole('button')).toHaveTextContent('✓ Aktif');
  });

  it('tıklanır → onMutate ANINDA flip + ✓ Aktif görünür', async () => {
    render(wrap(<ListRowToggle productId="p-1" initialPublished={false} />));
    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });
    // onMutate sırasında setPublished(true) anında flip (spinner görünür ama
    // metin yine değişmiş)
    await waitFor(() => {
      expect(publishMock).toHaveBeenCalledWith('p-1');
    });
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute(
        'data-storefront-published',
        '1',
      );
    });
  });

  it('validation fail (issues) → revert + edit yönlendir', async () => {
    publishMock.mockResolvedValue({
      ok: false,
      issues: ['missing_vat_no'],
      message: 'eksik',
    });
    vi.useFakeTimers();
    render(wrap(<ListRowToggle productId="p-1" initialPublished={false} />));
    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });
    // Action sonrası 1.5s sonra router.push
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(pushMock).toHaveBeenCalledWith('/admin/products/p-1/edit');
    // Banner "1 eksik" — issuesMsg state
    expect(screen.getByText(/1 eksik/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('network fail → rollback + bağlantı hatası mesajı', async () => {
    publishMock.mockRejectedValueOnce(new Error('network down'));
    render(wrap(<ListRowToggle productId="p-1" initialPublished={false} />));
    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(screen.getByText(/Bağlantı hatası/)).toBeInTheDocument();
    });
  });

  it('published=true tıklanır → unpublish çağrılır', async () => {
    render(wrap(<ListRowToggle productId="p-1" initialPublished={true} />));
    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(unpublishMock).toHaveBeenCalledWith('p-1');
    });
  });
});
