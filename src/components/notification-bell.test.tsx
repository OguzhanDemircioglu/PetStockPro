/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { NotificationBell } from './notification-bell';
import { notificationKeys } from '@/lib/queries/keys';

function wrap(ui: ReactNode, client = makeClient()) {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
}

afterEach(() => {
  cleanup();
});

describe('NotificationBell', () => {
  it('serverCount=0 → badge yok, aria-label sade', () => {
    wrap(<NotificationBell unreadCount={0} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-label')).toBe('Bildirimler');
    expect(link.querySelector('[data-notif-badge]')).toBeNull();
  });

  it('serverCount=3 → badge "3" + aria-label sayılı', () => {
    wrap(<NotificationBell unreadCount={3} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-label')).toBe('Bildirimler (3 okunmamış)');
    const badge = link.querySelector('[data-notif-badge]');
    expect(badge?.textContent).toBe('3');
  });

  it('serverCount=120 → "99+" gösterilir', () => {
    wrap(<NotificationBell unreadCount={120} />);
    const badge = screen.getByRole('link').querySelector('[data-notif-badge]');
    expect(badge?.textContent).toBe('99+');
  });

  it('setQueryData ile cache güncellenince badge anında flip eder', async () => {
    const { client } = wrap(<NotificationBell unreadCount={2} />);
    expect(screen.getByRole('link').querySelector('[data-notif-badge]')?.textContent).toBe('2');

    await act(async () => {
      client.setQueryData<number>(notificationKeys.unreadCount(), 0);
    });

    const badge = screen.getByRole('link').querySelector('[data-notif-badge]');
    expect(badge).toBeNull();
    expect(screen.getByRole('link').getAttribute('aria-label')).toBe('Bildirimler');
  });

  it('setQueryData ile sayı artarsa badge tekrar görünür', async () => {
    const { client } = wrap(<NotificationBell unreadCount={0} />);
    expect(screen.getByRole('link').querySelector('[data-notif-badge]')).toBeNull();

    await act(async () => {
      client.setQueryData<number>(notificationKeys.unreadCount(), 5);
    });

    const badge = screen.getByRole('link').querySelector('[data-notif-badge]');
    expect(badge?.textContent).toBe('5');
  });

  it('prop yeniden render edilince cache prop ile seed olur', async () => {
    const client = makeClient();
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <NotificationBell unreadCount={3} />
      </QueryClientProvider>,
    );
    expect(client.getQueryData<number>(notificationKeys.unreadCount())).toBe(3);

    await act(async () => {
      rerender(
        <QueryClientProvider client={client}>
          <NotificationBell unreadCount={1} />
        </QueryClientProvider>,
      );
    });

    expect(client.getQueryData<number>(notificationKeys.unreadCount())).toBe(1);
    const badge = screen.getByRole('link').querySelector('[data-notif-badge]');
    expect(badge?.textContent).toBe('1');
  });
});
