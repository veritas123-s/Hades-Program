import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Code2, ExternalLink, X } from "lucide-react";

function cells(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function MarkdownDocument({ text }) {
  const blocks = useMemo(() => {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n");
    const output = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }
      if (line.startsWith("```")) {
        const language = line.slice(3).trim();
        const content = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```"))
          content.push(lines[index++]);
        index += 1;
        output.push({ type: "code", language, content: content.join("\n") });
        continue;
      }
      const heading = /^(#{1,4})\s+(.+)$/.exec(line);
      if (heading) {
        output.push({
          type: "heading",
          level: heading[1].length,
          content: heading[2],
        });
        index += 1;
        continue;
      }
      if (
        line.trim().startsWith("|") &&
        /^\s*\|?\s*:?-+/.test(lines[index + 1] || "")
      ) {
        const header = cells(line);
        index += 2;
        const rows = [];
        while (index < lines.length && lines[index].trim().startsWith("|"))
          rows.push(cells(lines[index++]));
        output.push({ type: "table", header, rows });
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index]))
          items.push(lines[index++].replace(/^\s*[-*]\s+/, ""));
        output.push({ type: "list", ordered: false, items });
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index]))
          items.push(lines[index++].replace(/^\s*\d+\.\s+/, ""));
        output.push({ type: "list", ordered: true, items });
        continue;
      }
      const paragraph = [line.trim()];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,4})\s+/.test(lines[index]) &&
        !/^\s*[-*]\s+/.test(lines[index]) &&
        !/^\s*\d+\.\s+/.test(lines[index]) &&
        !lines[index].startsWith("```") &&
        !lines[index].trim().startsWith("|")
      )
        paragraph.push(lines[index++].trim());
      output.push({ type: "paragraph", content: paragraph.join(" ") });
    }
    return output;
  }, [text]);
  return (
    <article className="manual-document">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = `h${block.level}`;
          return <Tag key={index}>{block.content}</Tag>;
        }
        if (block.type === "code")
          return (
            <pre key={index} data-language={block.language}>
              <code>{block.content}</code>
            </pre>
          );
        if (block.type === "table")
          return (
            <div className="manual-table-wrap" key={index}>
              <table>
                <thead>
                  <tr>
                    {block.header.map((cell, i) => (
                      <th key={i}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index}>
              {block.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </Tag>
          );
        }
        return <p key={index}>{block.content}</p>;
      })}
    </article>
  );
}

export default function ManualModal({ kind, call, onClose }) {
  const [selected, setSelected] = useState(kind || "user");
  const [document, setDocument] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setDocument(null);
    setError("");
    call("help.read", { kind: selected })
      .then((result) => live && setDocument(result))
      .catch((cause) => live && setError(cause.message));
    return () => {
      live = false;
    };
  }, [call, selected]);
  useEffect(() => {
    const escape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop manual-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Hades 手册"
    >
      <section className="manual-modal">
        <header>
          <div>
            <span className="eyebrow">Hades 帮助中心</span>
            <h2>{selected === "user" ? "使用说明" : "开发者手册"}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭手册"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="manual-tabs">
          <button
            className={selected === "user" ? "active" : ""}
            onClick={() => setSelected("user")}
          >
            <BookOpen size={17} />
            使用说明
          </button>
          <button
            className={selected === "developer" ? "active" : ""}
            onClick={() => setSelected("developer")}
          >
            <Code2 size={17} />
            开发者手册
          </button>
          <button
            className="manual-external"
            onClick={() => call("help.open", { kind: selected })}
          >
            <ExternalLink size={16} />
            在独立窗口打开
          </button>
        </div>
        <div className="manual-scroll">
          {error && <p className="error">{error}</p>}
          {!document && !error && <p role="status">正在载入手册…</p>}
          {document && <MarkdownDocument text={document.text} />}
        </div>
      </section>
    </div>
  );
}
