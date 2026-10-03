import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { once } from "node:events";
import { ImapFlow } from "imapflow";
import { MailService } from "../electron/mail-service.mjs";

test("真实ImapFlow在合成IMAP服务器使用EXAMINE与BODY.PEEK，未发送写命令", async () => {
  const transcript = [];
  const source = Buffer.from(
    "From: campus@example.invalid\r\nSubject: Synthetic mail\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n合成邮件正文",
  );
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("* OK [CAPABILITY IMAP4rev1] Synthetic IMAP\r\n");
    let buffer = "";
    socket.on("data", (bytes) => {
      buffer += bytes.toString();
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n"),
          line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const [tag, ...parts] = line.split(" ");
        const command = parts.join(" ");
        transcript.push(
          command.replace(/LOGIN .*/i, "LOGIN [synthetic credentials omitted]"),
        );
        if (command.startsWith("CAPABILITY"))
          socket.write("* CAPABILITY IMAP4rev1\r\n");
        else if (command.startsWith("LIST"))
          socket.write('* LIST (\\HasNoChildren) "/" "INBOX"\r\n');
        else if (command.startsWith("EXAMINE")) {
          socket.write(
            "* FLAGS (\\Seen)\r\n* 1 EXISTS\r\n* 0 RECENT\r\n* OK [UIDVALIDITY 123] stable\r\n* OK [UIDNEXT 2] next\r\n",
          );
          socket.write(`${tag} OK [READ-ONLY] EXAMINE completed\r\n`);
          continue;
        } else if (command.startsWith("STATUS"))
          socket.write('* STATUS "INBOX" (MESSAGES 1 UNSEEN 1)\r\n');
        else if (/^(?:UID )?FETCH/.test(command)) {
          if (/BODY\.PEEK/.test(command)) {
            socket.write(`* 1 FETCH (UID 1 BODY[]<0> {${source.length}}\r\n`);
            socket.write(source);
            socket.write(")\r\n");
          } else if (command.includes("ENVELOPE")) {
            socket.write(
              `* 1 FETCH (UID 1 FLAGS () RFC822.SIZE ${source.length} ENVELOPE ("04 Oct 2026 00:00:00 +0800" "Synthetic mail" ((NIL NIL "campus" "example.invalid")) NIL NIL NIL NIL NIL NIL "<synthetic@example.invalid>"))\r\n`,
            );
          } else
            socket.write(`* 1 FETCH (UID 1 RFC822.SIZE ${source.length})\r\n`);
        }
        socket.write(`${tag} OK completed\r\n`);
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const mail = new MailService({
    owner: () => "synthetic",
    clientFactory: (options) =>
      new ImapFlow({
        ...options,
        host: "127.0.0.1",
        port: server.address().port,
        secure: false,
        doSTARTTLS: false,
      }),
  });
  try {
    const state = await mail.connect({
      username: "synthetic",
      password: "synthetic-only",
    });
    assert.equal(state.items.length, 1);
    const message = await mail.read({ uid: 1, validity: "123" });
    assert.match(message.text, /合成邮件正文/);
    assert(transcript.some((x) => x.startsWith("EXAMINE")));
    assert(transcript.some((x) => x.includes("BODY.PEEK[]")));
    assert(
      !transcript.some((x) =>
        /^(?:UID )?(?:STORE|SELECT|APPEND|EXPUNGE|COPY|MOVE|DELETE)\b/.test(x),
      ),
    );
  } finally {
    mail.disconnect();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});
