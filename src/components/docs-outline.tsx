import { Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { type DocHeading } from "~/docs";

const ACTIVE_LINE_TOP = 32;
const CLICK_SCROLL_SETTLE_MS = 150;

interface DocsOutlineProps {
  headings: DocHeading[];
}

function clsx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function findActiveHeading(elements: HTMLElement[]): HTMLElement {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const remainingScroll = maxScroll - window.scrollY;
  const lastTopAtPageEnd = elements[elements.length - 1].getBoundingClientRect().top - remainingScroll;
  const unreachable = Math.max(0, lastTopAtPageEnd - ACTIVE_LINE_TOP);
  const range = Math.min(unreachable, maxScroll);
  const progress = range > 0 ? Math.min(1, Math.max(0, 1 - remainingScroll / range)) : 0;
  const activeLine = ACTIVE_LINE_TOP + unreachable * progress;

  let active = elements[0];
  for (const element of elements) {
    if (element.getBoundingClientRect().top > activeLine) break;
    active = element;
  }
  return active;
}

function OutlineLink({
  heading,
  active,
  onActivate,
}: {
  heading: DocHeading;
  active: boolean;
  onActivate: (id: string) => void;
}) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onActivate(heading.id);
    if (decodeURIComponent(window.location.hash.slice(1)) === heading.id) {
      event.preventDefault();
      document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Link
      to="."
      hash={heading.id}
      replace
      hashScrollIntoView={{ behavior: "smooth" }}
      onClick={handleClick}
      className={clsx(
        "block py-1 transition-colors border-l-2 -ml-px",
        heading.depth === 2 && "pl-3",
        heading.depth === 3 && "pl-6",
        heading.depth >= 4 && "pl-9",
        active
          ? "text-foreground border-primary"
          : "text-muted-foreground hover:text-foreground border-transparent",
      )}
    >
      {heading.text}
    </Link>
  );
}

export function DocsOutline({ headings }: DocsOutlineProps) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(() =>
    headings.length > 0 ? headings[0].id : null,
  );
  const clickPin = useRef<{ settled: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);

  const settlePinLater = useCallback(() => {
    const pin = clickPin.current;
    if (!pin) return;
    clearTimeout(pin.timer);
    pin.timer = setTimeout(() => {
      pin.settled = true;
    }, CLICK_SCROLL_SETTLE_MS);
  }, []);

  const activateFromClick = useCallback(
    (id: string) => {
      clearTimeout(clickPin.current?.timer);
      clickPin.current = { settled: false };
      settlePinLater();
      setActiveId(id);
    },
    [settlePinLater],
  );

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (clickPin.current) return;
      const elements = headings.flatMap((heading) => {
        const element = document.getElementById(heading.id);
        return element ? [element] : [];
      });
      setActiveId(elements.length > 0 ? findActiveHeading(elements).id : (headings[0]?.id ?? null));
    };
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onScroll = () => {
      if (clickPin.current?.settled) clickPin.current = null;
      else settlePinLater();
      scheduleUpdate();
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    const unsubscribe = router.subscribe("onRendered", scheduleUpdate);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleUpdate);
      clearTimeout(clickPin.current?.timer);
      clickPin.current = null;
    };
  }, [headings, router, settlePinLater]);

  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      className="py-8 pr-4"
    >
      <div className="text-xs font-medium text-muted-foreground mb-3 px-3">On this page</div>
      <ul className="space-y-1 border-l border-border">
        {headings.map((heading) => (
          <li key={heading.id} className="text-sm">
            <OutlineLink
              heading={heading}
              active={activeId === heading.id}
              onActivate={activateFromClick}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
