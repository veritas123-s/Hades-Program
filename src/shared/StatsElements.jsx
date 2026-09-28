import React from "react";

import { dayKey, addDays, monday } from "../domain.mjs";

export function Stat({ label, value, unit, icon: Icon, foot, progress }) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>{foot}</p>
      {progress !== undefined && (
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
export function WeekChart({ totals }) {
  const start = monday(dayKey()),
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    max = Math.max(60, ...days.map((d) => (totals[d] || 0) / 60000));
  return (
    <div className="week-chart">
      {days.map((d, i) => (
        <div key={d} className={d === dayKey() ? "current" : ""}>
          <small>
            {Math.round((totals[d] || 0) / 60000)}
            <em>m</em>
          </small>
          <div className="bar-track">
            <i
              style={{
                height: `${Math.max(2, ((totals[d] || 0) / 60000 / max) * 100)}%`,
              }}
            />
          </div>
          <span>周{"一二三四五六日"[i]}</span>
        </div>
      ))}
    </div>
  );
}
