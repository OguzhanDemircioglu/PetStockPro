/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const markAsReadMock = vi.fn();
const markAllAsReadMock = vi.fn();

vi.mock('./actions', () => ({
  markAsReadAction: (...args: unknown[]) => markAsReadMock(...args),
  markAllAsReadAction: (...args: unknown[]) => markAllAsReadMock(...args),
}));

import { NotificationsList } from './notifications-list';
import type { NotificationRow } from '@/lib/notifications/manage';

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const NOW = new Date('2026-05-21T10:00:00Z');

function row(
  id: string,
  isRead = false,
  overrides: Partial<NotificationRow> = {},
): NotificationRow {
  return {
    id,
    type: 'low_stock_critical',
    channel: 'screen',
    content: { title: `Bildirim ${id}`, body: 'detay' },
    readAt: isRead ? NOW : null,
    createdAt: NOW,
    ...overrides,
  } as NotificationRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  markAsReadMock.mockResolvedValue(undefined);
  markAllAsReadMock.mockResolvedValue(undefined);
});

describe('NotificationsList', () => {
  it('initialItems render edilir + unread count başlık', () => {
    render(
      wrap(
        <NotificationsList
          initialItems={[row('1'), row('2'), row('3', true)]}
          unreadOnly={false}
          typeEmoji={{}}
          typeLabel={{}}
        />,
      ),
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/2 okunmamış/)).toBeInTheDocument();
  });

  it('tek satır mark-read → onMutate sonrası unread badge YOK', async () => {
    render(
      wrap(
        <NotificationsList
          initialItems={[row('1'), row('2')]}
          unreadOnly={false}
          typeEmoji={{}}
          typeLabel={{}}
        />,
      ),
    );
    const buttons = screen.getAllByLabelText('Okundu işaretle');
    expect(buttons).toHaveLength(2);

    await act(async () => {
      fireEvent.click(buttons[0]!);
    });

    await waitFor(() => {
      expect(markAsReadMock).toHaveBeenCalledWith('1');
    });

    // Optimistic: 1 satır artık okundu, "YENİ" badge sayısı 1'e iner
    await waitFor(() => {
      const yeniBadges = screen.queryAllByText('YENİ');
      expect(yeniBadges).toHaveLength(1);
    });
  });

  it('mark-read fail → state rollback + alert', async () => {
    markAsReadMock.mockRejectedValueOnce(new Error('DB down'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      wrap(
        <NotificationsList
          initialItems={[row('1'), row('2')]}
          unreadOnly={false}
          typeEmoji={{}}
          typeLabel={{}}
        />,
      ),
    );
    const buttons = screen.getAllByLabelText('Okundu işaretle');
    await act(async () => {
      fireEvent.click(buttons[0]!);
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    // 2 satır hâlâ YENİ
    await waitFor(() => {
      expect(screen.queryAllByText('YENİ')).toHaveLength(2);
    });
    alertSpy.mockRestore();
  });

  it('bulk Tümünü okundu → tüm satırlar mark + count 0', async () => {
    render(
      wrap(
        <NotificationsList
          initialItems={[row('1'), row('2'), row('3')]}
          unreadOnly={false}
          typeEmoji={{}}
          typeLabel={{}}
        />,
      ),
    );
    const bulkBtn = screen.getByText(/Tümünü okundu işaretle/);
    await act(async () => {
      fireEvent.click(bulkBtn);
    });
    await waitFor(() => {
      expect(markAllAsReadMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryAllByText('YENİ')).toHaveLength(0);
    });
  });

  it('unreadOnly mode → okundu işaretlenenler listeden anında çıkar', async () => {
    render(
      wrap(
        <NotificationsList
          initialItems={[row('1'), row('2')]}
          unreadOnly={true}
          typeEmoji={{}}
          typeLabel={{}}
        />,
      ),
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    const buttons = screen.getAllByLabelText('Okundu işaretle');
    await act(async () => {
      fireEvent.click(buttons[0]!);
    });
    await waitFor(() => {
      expect(screen.queryAllByRole('listitem')).toHaveLength(1);
    });
  });

  it('boş liste → empty state', () => {
    render(
      wrap(
        <NotificationsList
          initialItems={[]}
          unreadOnly={false}
          typeEmoji={{}}
          typeLabel={{}}
        />,
      ),
    );
    expect(screen.getByText(/Henüz bildirim yok/)).toBeInTheDocument();
  });
});
