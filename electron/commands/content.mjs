import {
  changeList,
  eventInput,
  courseKey,
  contentInput,
} from "../../src/domain/content.mjs";
export default async function execute(action, p, { store }) {
  store.change((s) => {
    if (action.startsWith("list.")) changeList(s, action, p);
    else if (action === "event.save") {
      const old = s.events.find((x) => x.id === p.id),
        event = eventInput(p, old);
      if (old) Object.assign(old, event);
      else s.events.push(event);
    } else if (action === "event.delete" || action === "event.restore") {
      const event = s.events.find((x) => x.id === p.id);
      if (!event) throw Error("日程不存在");
      event.deletedAt = action === "event.delete" ? Date.now() : null;
    } else if (action === "course.delete") {
      const course = s.courses.find((c) => courseKey(c) === p.key);
      if (!course) throw Error("课程不存在");
      const old = s.courseTrash.find((x) => x.key === p.key);
      if (old) old.deletedAt = Date.now();
      else s.courseTrash.push({ key: p.key, course, deletedAt: Date.now() });
    } else if (action === "course.restore") {
      const old = s.courseTrash.find((x) => x.key === p.key);
      if (!old) throw Error("课程不存在");
      if (!s.courses.some((c) => courseKey(c) === p.key))
        s.courses.push(old.course);
      s.courseTrash = s.courseTrash.filter((x) => x.key !== p.key);
    } else if (action === "scores.clear") s.scores = null;
    contentInput(s, s);
  });
}
