import React, { useLayoutEffect, useRef } from "react";

export default function ResponsiveViewport({ className, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const measure = () => {
      const style = getComputedStyle(node);
      const width =
        node.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const height =
        node.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      const scale = Math.min(
        1.18,
        Math.max(0.92, Math.min(width / 1120, height / 680)),
      );
      node
        .closest(".app-shell")
        .style.setProperty("--layout-scale", scale.toFixed(3));
      node.style.setProperty("--workspace-width", `${Math.round(width)}px`);
      node.style.setProperty("--workspace-height", `${Math.round(height)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  );
}
