import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocsBreadcrumbs } from "~/components/docs-breadcrumbs";
import { DocsNav } from "~/components/docs-nav";
import { DocsOutline } from "~/components/docs-outline";
import { buildDocsNavTree, getDoc, getDocs } from "~/docs";

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
});

function DocsLayout() {
  const location = useLocation();
  const tree = useMemo(() => buildDocsNavTree(getDocs()), []);

  const slug = location.pathname === "/docs" ? "" : location.pathname.slice("/docs/".length);
  const doc = getDoc(slug);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const sidebarRef = useRef<HTMLDivElement>(null);
  useAutoHideScrollbar(sidebarRef);

  return (
    <div className="docs-layout min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.webp" alt="Boppa" width={32} height={32} className="w-8 h-8" />
            <span className="text-lg font-medium">Boppa</span>
          </Link>
          <button
            type="button"
            onClick={toggleMobileNav}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            className="-mr-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileNavOpen && (
          <nav className="border-t border-border px-4 py-4 max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <DocsNav nodes={tree} mobile onNavigate={closeMobileNav} />
          </nav>
        )}
      </header>

      <div className="max-w-[90rem] mx-auto flex items-start">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block sticky top-0 h-screen w-60 shrink-0 border-r border-border">
          <div
            ref={sidebarRef}
            className="docs-scrollbar autohide-scrollbar h-full overflow-y-auto overflow-x-hidden"
          >
            <div className="p-6">
              <Link to="/" className="flex items-center gap-3 mb-8">
                <img src="/logo.webp" alt="Boppa" width={32} height={32} className="w-8 h-8" />
                <span className="text-lg font-medium">Boppa</span>
              </Link>
              <DocsNav nodes={tree} />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 md:px-12 py-8 md:py-12">
          <div className="max-w-prose mx-auto">
            {doc && <DocsBreadcrumbs doc={doc} tree={tree} />}
            <Outlet />
          </div>
        </main>

        {/* Right outline */}
        <aside className="hidden xl:block sticky top-0 h-screen w-60 shrink-0 px-2 overflow-y-auto">
          {doc && <DocsOutline headings={doc.headings} />}
        </aside>
      </div>
    </div>
  );
}

// Shows the element's scrollbar while it scrolls or the pointer is over it, and
// hides it hideDelay ms after both stop. Pairs with .autohide-scrollbar in styles.css.
function useAutoHideScrollbar(ref: React.RefObject<HTMLElement | null>, hideDelay = 1000) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let hovering = false;

    const show = () => {
      clearTimeout(timeout);
      el.setAttribute("data-scrollbar-active", "");
    };
    const scheduleHide = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => el.removeAttribute("data-scrollbar-active"), hideDelay);
    };
    const setHovering = (value: boolean) => {
      if (value === hovering) return;
      hovering = value;
      if (hovering) show();
      else scheduleHide();
    };

    const onScroll = () => {
      show();
      if (!hovering) scheduleHide();
    };
    const onPointerMove = (e: PointerEvent) => {
      const scrollbarWidth = el.offsetWidth - el.clientWidth;
      setHovering(scrollbarWidth > 0 && e.clientX >= el.getBoundingClientRect().right - scrollbarWidth);
    };
    const onPointerLeave = () => setHovering(false);

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", onPointerLeave);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      clearTimeout(timeout);
    };
  }, [ref, hideDelay]);
}
