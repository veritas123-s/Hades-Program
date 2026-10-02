import React, { createContext, useContext, useState, useId } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
const PanelContext = createContext(null);
export function PanelProvider({ children, page }) {
  const [folded, setFolded] = useState({});
  return (
    <PanelContext.Provider value={{ folded, setFolded, page }}>
      {children}
    </PanelContext.Provider>
  );
}
function heading(children) {
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child)) continue;
    if (typeof child.type === "string" && /^h[123]$/.test(child.type))
      return text(child.props.children);
    const found = heading(child.props.children);
    if (found) return found;
  }
  return "";
}
function text(children) {
  return React.Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? child
        : React.isValidElement(child)
          ? text(child.props.children)
          : "",
    )
    .join("")
    .trim();
}
export default function Panel({
  children,
  className = "",
  title,
  defaultCollapsed = false,
  ...props
}) {
  const context = useContext(PanelContext),
    [local, setLocal] = useState(defaultCollapsed),
    id = useId();
  const enabled =
    /(?:^|\s)(?:panel|quadrant|focus-invite|agenda-hero)(?:\s|$)/.test(
      className,
    );
  if (!enabled)
    return (
      <section {...props} className={className}>
        {children}
      </section>
    );
  const label = title || heading(children) || props["aria-label"] || "面板";
  const key = `${context?.page || ""}:${title || props["data-widget"] || label}`;
  const folded = context ? (context.folded[key] ?? defaultCollapsed) : local;
  const toggle = () =>
    context
      ? context.setFolded((current) => ({ ...current, [key]: !folded }))
      : setLocal(!folded);
  return (
    <section
      {...props}
      className={`${className} foldable-panel ${folded ? "panel-folded" : ""}`}
    >
      <div className="panel-fold-bar">
        {folded && <strong>{label}</strong>}
        <button
          className="icon-button panel-fold-toggle"
          type="button"
          aria-label={`${folded ? "展开" : "收起"}${label}`}
          aria-expanded={!folded}
          aria-controls={id}
          onClick={toggle}
        >
          {folded ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
        </button>
      </div>
      <div id={id} className="panel-body" hidden={folded}>
        {children}
      </div>
    </section>
  );
}
