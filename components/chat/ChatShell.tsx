"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Responsive inbox frame. Phone: the list OR the open thread (thread is a
 * full-screen overlay below the site header and the "← Back to chats" row —
 * 4rem + 2.375rem, see BackButton). Desktop: list on the left, thread on the
 * right, like a messaging desktop app; its height leaves room for the header,
 * its own top margin and the floating bottom nav — plus the back row, which
 * only a thread shows — so the page itself never scrolls.
 */
export function ChatShell({ list, children }: { list: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const inThread = pathname !== "/chat";

  return (
    <div className={`sm:px-6 lg:mt-4 lg:grid ${inThread ? "lg:h-[calc(100dvh-14.5rem)]" : "lg:h-[calc(100dvh-12.125rem)]"} lg:min-h-[30rem] lg:grid-cols-[22rem_minmax(0,1fr)] lg:overflow-hidden lg:rounded-3xl lg:border lg:border-hairline lg:bg-surface lg:shadow-sm`}>
      <aside
        className={`${inThread ? "hidden lg:flex" : "flex"} min-h-0 flex-col lg:overflow-y-auto lg:border-r lg:border-hairline`}
      >
        {list}
      </aside>
      <section
        className={`${
          inThread
            ? "fixed inset-x-0 bottom-0 top-[6.375rem] z-30 flex bg-paper lg:static lg:z-auto lg:bg-transparent"
            : "hidden lg:flex"
        } min-h-0 flex-col`}
      >
        {children}
      </section>
    </div>
  );
}
