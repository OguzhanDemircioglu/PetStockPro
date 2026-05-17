import Link from 'next/link';

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href={'/admin/notifications' as never}
      data-notif-bell
      data-unread-count={unreadCount}
      aria-label={`Bildirimler${unreadCount > 0 ? ` (${unreadCount} okunmamış)` : ''}`}
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-paper text-lg hover:bg-cat-soft"
    >
      🔔
      {unreadCount > 0 && (
        <span
          data-notif-badge
          className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-cat px-1 py-0.5 text-center text-[11.5px] font-bold leading-none text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
