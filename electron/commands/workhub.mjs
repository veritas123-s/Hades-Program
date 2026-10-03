import { changeHub } from "../../src/domain/workhub.mjs";
export default async function execute(action, payload, { store }) {
  store.change((state) => changeHub(state, action, payload));
}
