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

  const layoutRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLElement>(null);
  const outlineFits = useOutlineFits(layoutRef, mainRef, proseRef, outlineRef);

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

      <div ref={layoutRef} className="relative max-w-[90rem] mx-auto flex items-start">
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
        <main ref={mainRef} className="flex-1 min-w-0 px-6 md:px-12 py-8 md:py-12">
          <div ref={proseRef} className="max-w-prose mx-auto">
            {doc && <DocsBreadcrumbs doc={doc} tree={tree} />}
            <Outlet />
          </div>
        </main>

        {/* Right outline. Grows past w-60 to fit unbreakable headings, taking the space from
            the gaps around the article; once the article's padding is all that's left it
            moves out of the flow and hides, still measurable for when it fits again. */}
        <aside
          ref={outlineRef}
          className={
            "hidden w-min min-w-60 shrink-0 px-2 " +
            (outlineFits === null
              ? "xl:block sticky top-0"
              : outlineFits
                ? "lg:block sticky top-0"
                : "lg:block absolute top-0 right-0 invisible")
          }
        >
          {doc && <DocsOutline headings={doc.headings} />}
        </aside>
      </div>
    </div>
  );
}

// Whether the outline fits beside the article at its full width plus the main column's
// padding. null until measured, so server render falls back to the xl breakpoint.
function useOutlineFits(
  layoutRef: React.RefObject<HTMLElement | null>,
  mainRef: React.RefObject<HTMLElement | null>,
  proseRef: React.RefObject<HTMLElement | null>,
  outlineRef: React.RefObject<HTMLElement | null>,
) {
  const [fits, setFits] = useState<boolean | null>(null);

  useEffect(() => {
    const layout = layoutRef.current;
    const main = mainRef.current;
    const prose = proseRef.current;
    const outline = outlineRef.current;
    if (!layout || !main || !prose || !outline) return;

    const update = () => {
      const mainStyle = getComputedStyle(main);
      const mainPadding = parseFloat(mainStyle.paddingLeft) + parseFloat(mainStyle.paddingRight);
      const proseWidth = parseFloat(getComputedStyle(prose).maxWidth);
      // Width shared by main and the outline; a hidden outline is out of flow and takes none
      const inFlow = getComputedStyle(outline).position !== "absolute";
      const shared = main.offsetWidth + (inFlow ? outline.offsetWidth : 0);
      // offsetWidth is 0 while display: none (below lg, or below xl before the first measure)
      setFits(outline.offsetWidth > 0 && shared - outline.offsetWidth >= proseWidth + mainPadding);
    };

    const observer = new ResizeObserver(update);
    observer.observe(layout);
    observer.observe(outline);
    return () => observer.disconnect();
  }, [layoutRef, mainRef, proseRef, outlineRef]);

  return fits;
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
