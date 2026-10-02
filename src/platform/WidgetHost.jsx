import Panel from "../shared/Panel.jsx";
import React from "react";
import { Settings2 } from "lucide-react";
import { Boundary } from "./Boundary.jsx";
import { registry } from "./modules.jsx";
import { CustomWidget } from "./CustomWidget.jsx";
import { customWidgetIds } from "./widget-recipes.mjs";
import {
  widgetLayout,
  widgetServices,
  migrateWidgetData,
} from "./registry.mjs";
export function WidgetContent({ definition, state, actions, call }) {
  const record = migrateWidgetData(
    definition,
    state.workspace.widgetData[definition.id],
  );
  const services = widgetServices(definition, state, { ...actions, call });
  const Component = definition.Component;
  return <Component {...services} config={record.data} />;
}
export function WidgetBoard({ state, call, actions }) {
  const ids = state.workspace.widgets.order
    .filter(
      (id) =>
        (registry.widgets.has(id) ||
          customWidgetIds(state.workspace).includes(id)) &&
        !state.workspace.widgets.hidden.includes(id) &&
        !state.workspace.widgetData[id]?.data.deletedAt,
    )
    .filter(
      (id) =>
        !["courses", "priority"].includes(id) ||
        state.workspace.widgetData[id]?.data.explicitlyAdded,
    );
  return (
    <>
      <div className="widget-board-heading">
        <div>
          <p className="eyebrow">我的工作台</p>
          <h2>小组件</h2>
        </div>
        <button
          className="button"
          onClick={() => actions.navigate("workbench")}
        >
          <Settings2 size={15} />
          管理小组件
        </button>
      </div>
      <div className="widget-board">
        {ids.map((id) => {
          const definition = registry.widgets.get(id) || {
            id,
            title: state.workspace.widgetData[id].data.title,
            defaultSize: "half",
          };
          return (
            <div
              className={`widget-slot size-${state.workspace.widgets.sizes[id] || definition.defaultSize || "half"}`}
              data-widget={id}
              key={id}
            >
              <Boundary label={definition.title}>
                {id.startsWith("custom-") ? (
                  <CustomWidget id={id} state={state} call={call} />
                ) : (
                  <WidgetContent
                    definition={definition}
                    state={state}
                    actions={actions}
                    call={call}
                  />
                )}
              </Boundary>
            </div>
          );
        })}
      </div>
      {!ids.length && (
        <Panel className="panel empty">
          <h3>为今天留一块空白</h3>
          <p>从小组件库添加课程、专注或随手记。</p>
          <button
            className="button"
            onClick={() => actions.navigate("workbench")}
          >
            添加小组件
          </button>
        </Panel>
      )}
    </>
  );
}
