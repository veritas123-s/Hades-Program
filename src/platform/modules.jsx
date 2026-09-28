import React, { Suspense } from "react";
import { createRegistry } from "./registry.mjs";
import { Boundary } from "./Boundary.jsx";
const modules = Object.values(
  import.meta.glob("../modules/*/module.jsx", {
    eager: true,
    import: "default",
  }),
).sort((a, b) => a.order - b.order);
const extensions = Object.values(
  import.meta.glob("../extensions/widgets/*.widget.jsx", {
    eager: true,
    import: "default",
  }),
);
export const registry = createRegistry(modules, extensions);
export const NAV = [...registry.routes.values()]
  .filter((r) => !r.hiddenNav)
  .map((r) => [r.id, r.title, r.icon]);
export function ModuleOutlet({ page, context }) {
  const route = registry.routes.get(page);
  if (!route)
    return (
      <section className="panel">
        <h2>这个页面暂不可用</h2>
        <button className="button" onClick={() => context.setPage("today")}>
          回到今日概览
        </button>
      </section>
    );
  const Page = route.Component;
  return (
    <Boundary key={page} label={route.title}>
      <Suspense
        fallback={
          <div className="panel" role="status">
            正在打开{route.title}…
          </div>
        }
      >
        <Page {...context} />
      </Suspense>
    </Boundary>
  );
}
