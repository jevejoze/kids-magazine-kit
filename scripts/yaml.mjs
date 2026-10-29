// YAML 子集解析器：只认 magazine.yaml 用得到的写法
//   map（key: value）、list（- x 或 [a, b]）、标量（字符串、数字、true/false、null、带引号的字符串）、# 注释
// 锚点、多行块（| >）、行内 map（{a: 1}）、多文档、制表符缩进一律报错，错误带行号
export class YamlError extends Error {
  constructor(line, message) { super(`第 ${line} 行：${message}`); this.line = line; }
}

const UNSUPPORTED = [
  [/^[&*]/, "不支持锚点和别名（& *）"],
  [/^[|>][+-]?\d*$/, "不支持多行块（| >），把内容写在一行里"],
  [/^\{/, "不支持行内 map（{ }），改成缩进写法"],
  [/^!/, "不支持类型标签（!）"],
];

function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trimEnd();
  }
  return text.trimEnd();
}

function scalar(raw, line) {
  const s = raw.trim();
  for (const [re, msg] of UNSUPPORTED) if (re.test(s)) throw new YamlError(line, msg);
  if (s.startsWith('"')) {
    if (!/^"(?:[^"\\]|\\.)*"$/.test(s)) throw new YamlError(line, `引号没有配对：${s}`);
    return JSON.parse(s);
  }
  if (s.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(s)) throw new YamlError(line, `引号没有配对：${s}`);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.startsWith("[")) return flowList(s, line);
  if (s === "" || s === "~" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function flowList(s, line) {
  if (!s.endsWith("]")) throw new YamlError(line, `方括号没有配对：${s}`);
  const body = s.slice(1, -1).trim();
  if (!body) return [];
  const items = [];
  let quote = null, start = 0;
  for (let i = 0; i <= body.length; i++) {
    const c = body[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") throw new YamlError(line, "行内列表里不支持嵌套，改成缩进写法");
    else if (c === "," || i === body.length) {
      const item = body.slice(start, i).trim();
      if (!item) throw new YamlError(line, `列表里有空项：${s}`);
      items.push(scalar(item, line));
      start = i + 1;
    }
  }
  return items;
}

// key: value 拆开；key 可以带引号
function splitKey(text, line) {
  const m = text.match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#:][^:]*?)\s*:(?:\s+(.*))?$/);
  if (!m) return null;
  const key = /^["']/.test(m[1]) ? scalar(m[1], line) : m[1];
  return { key: String(key), rest: m[2] ?? "" };
}

export function parseYaml(source) {
  const lines = [];
  source.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    if (/^\s*\t/.test(raw) || /^ *\t/.test(raw)) throw new YamlError(n, "缩进里有制表符，只能用空格");
    const text = stripComment(raw);
    if (!text.trim()) return;
    if (/^(---|\.\.\.)(\s|$)/.test(text)) throw new YamlError(n, "不支持多文档（--- ...），一个文件只写一份配置");
    if (/^%/.test(text)) throw new YamlError(n, "不支持指令（%）");
    lines.push({ n, indent: text.match(/^ */)[0].length, text: text.trim() });
  });
  if (!lines.length) return {};
  let pos = 0;

  function block(indent) {
    const first = lines[pos];
    return first.text === "-" || first.text.startsWith("- ") ? list(indent) : map(indent);
  }

  // 值写在下一行（更深的缩进）还是同一行
  function value(rest, parentIndent, line) {
    if (rest.trim()) return scalar(rest, line);
    const next = lines[pos];
    if (next && next.indent > parentIndent) return block(next.indent);
    // list 可以和父 key 同一缩进
    if (next && next.indent === parentIndent && (next.text === "-" || next.text.startsWith("- "))) return list(parentIndent);
    return null;
  }

  function map(indent) {
    const out = {};
    while (pos < lines.length) {
      const l = lines[pos];
      if (l.indent < indent) break;
      if (l.indent > indent) throw new YamlError(l.n, "缩进不对：比上一行多缩进了");
      if (l.text === "-" || l.text.startsWith("- ")) break;
      const kv = splitKey(l.text, l.n);
      if (!kv) throw new YamlError(l.n, `应该是"名字: 值"：${l.text}`);
      if (Object.hasOwn(out, kv.key)) throw new YamlError(l.n, `重复的名字：${kv.key}`);
      pos++;
      out[kv.key] = value(kv.rest, indent, l.n);
    }
    return out;
  }

  function list(indent) {
    const out = [];
    while (pos < lines.length) {
      const l = lines[pos];
      if (l.indent < indent) break;
      if (l.indent > indent) throw new YamlError(l.n, "缩进不对：比上一行多缩进了");
      if (!(l.text === "-" || l.text.startsWith("- "))) break;
      const rest = l.text.slice(1).trimStart();
      const itemIndent = indent + (l.text.length - rest.length);
      const kv = rest && !/^["'\[]/.test(rest) ? splitKey(rest, l.n) : null;
      if (kv) {
        // - key: value，后面同缩进的行接着属于这个 map
        lines[pos] = { ...l, indent: itemIndent, text: rest };
        out.push(map(itemIndent));
      } else {
        pos++;
        out.push(value(rest, indent, l.n));
      }
    }
    return out;
  }

  const root = block(lines[0].indent);
  if (pos < lines.length) throw new YamlError(lines[pos].n, "缩进不对：和上面对不齐");
  return root;
}
