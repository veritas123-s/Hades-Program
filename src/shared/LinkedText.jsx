import React from "react";
export default function LinkedText({ text, call }) {
  const raw = String(text || ""),
    tokens = [],
    pattern = /\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)|https:\/\/[^\s<>"']+/g;
  let index = 0;
  for (const match of raw.matchAll(pattern)) {
    tokens.push(raw.slice(index, match.index));
    const candidate = match[2] || match[0],
      url = candidate.replace(/[。，、；！？，;!?)）\]】》]+$/u, "");
    const suffix = candidate.slice(url.length);
    tokens.push(
      <a
        key={match.index}
        href={url}
        rel="noreferrer"
        onClick={(event) => {
          event.preventDefault();
          call("link.open", { url }).catch(()=>{});
        }}
      >
        {match[1] || url}
      </a>,
    );
    if (!match[2]) tokens.push(suffix);
    index = match.index + match[0].length;
  }
  tokens.push(raw.slice(index));
  return <div className="linked-text">{tokens}</div>;
}
