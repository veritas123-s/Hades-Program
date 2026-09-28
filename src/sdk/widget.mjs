// Build-time extension helper. Validation happens at registry registration so a
// malformed declaration can be skipped without taking down built-in modules.
export function defineWidget(definition) {
  return {
    apiVersion: 1,
    stateVersion: 1,
    version: "1.0.0",
    data: [],
    commands: [],
    uiActions: [],
    defaults: {},
    defaultSize: "half",
    ...definition,
  };
}
