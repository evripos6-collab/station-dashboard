// Station descriptions on Network are Markdown. This covers the subset that
// actually appears in them; anything else is left as written rather than
// half-rendered. Cesium's info box runs without allow-scripts, and only the
// tags below are emitted, so the output stays inert.

function inline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*(\S|\S[^*\n]*\S)\*/g, "$1<i>$2</i>")
    .replace(/(^|[\s(])_(\S|\S[^_\n]*\S)_/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function tableRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
}

const isTable = line => /^\s*\|/.test(line);
const isDivider = cells => cells.every(cell => /^:?-{2,}:?$/.test(cell));

export function renderMarkdown(source) {
  if (!source) return "";

  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let list = false;
  let table = false;

  const closeList = () => { if (list) { out.push("</ul>"); list = false; } };
  const closeTable = () => { if (table) { out.push("</table>"); table = false; } };

  for (const line of lines) {
    if (isTable(line)) {
      const cells = tableRow(line);
      if (isDivider(cells)) continue;
      closeList();
      if (!table) { out.push("<table>"); table = true; }
      out.push("<tr>" + cells.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>");
      continue;
    }
    closeTable();

    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      out.push(`<b>${inline(heading[2])}</b><br>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      if (!list) { out.push("<ul>"); list = true; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    closeList();

    if (/^\s*([-*_]\s*){3,}\s*$/.test(line)) { out.push("<hr>"); continue; }
    if (!line.trim()) { out.push("<br>"); continue; }

    out.push(`${inline(line)}<br>`);
  }

  closeList();
  closeTable();
  return out.join("\n");
}
