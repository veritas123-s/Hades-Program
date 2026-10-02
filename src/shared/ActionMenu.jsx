import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
export default function ActionMenu({ children, label = "更多操作" }) {
  const trigger = useRef(null),
    menu = useRef(null);
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 0, top: 0 });
  const close = (focus = false) => {
    trigger.current?.removeAttribute("open");
    setOpen(false);
    if (focus) trigger.current?.querySelector("summary").focus();
  };
  useEffect(() => {
    const outside = (event) => {
      if (
        !trigger.current?.contains(event.target) &&
        !menu.current?.contains(event.target)
      )
        close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const rect = trigger.current.getBoundingClientRect(),
      width = menu.current.offsetWidth,
      height = menu.current.offsetHeight;
    setPosition({
      left: Math.max(8, Math.min(innerWidth - width - 8, rect.right - width)),
      top:
        innerHeight - rect.bottom > height + 12
          ? rect.bottom + 6
          : Math.max(8, rect.top - height - 6),
    });
    menu.current.querySelector("button")?.focus();
  }, [open]);
  const escape = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  };
  return (
    <>
      <details
        className="action-menu"
        ref={trigger}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        onKeyDown={escape}
      >
        <summary aria-label={label} title={label}>
          <MoreHorizontal size={18} />
        </summary>
      </details>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="action-menu-content action-menu-floating"
            role="group"
            aria-label={label}
            style={position}
            onKeyDown={escape}
            onClick={(event) => {
              if (event.target.closest("button")) close(true);
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
