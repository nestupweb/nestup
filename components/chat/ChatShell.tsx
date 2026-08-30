"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Responsive inbox frame. Phone: the list OR the open thread (thread is a
 * full-screen overlay below the site header). Desktop: list on the left, thread
 * on the right, like a messaging desktop app; its height leaves room for the
 * header, the layout's pt-6 under it, its own top margin and the floating bottom
 * nav so the page itself never scrolls. Chat pages show no "← Back to …" row.
 */
export function ChatShell({ list, children }: { list: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const inThread = pathname !== "/chat";

  return (
    <div className="sm:px-6 lg:mt-4 lg:grid lg:h-[calc(100dvh-13.625rem)] lg:min-h-[30rem] lg:grid-cols-[22rem_minmax(0,1fr)] lg:overflow-hidden lg:rounded-3xl lg:border lg:border-hairline lg:bg-surface lg:shadow-sm">
      <aside
        className={`${inThread ? "hidden lg:flex" : "flex"} min-h-0 flex-col lg:overflow-y-auto lg:border-r lg:border-hairline`}
      >
        {list}
      </aside>
      <section
        className={`${
          inThread
            ? "fixed inset-x-0 bottom-0 top-16 z-30 flex bg-paper lg:static lg:z-auto lg:bg-transparent"
            : "hidden lg:flex"
        } min-h-0 flex-col`}
      >
        {children}
      </section>
    </div>
  );
}
