import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ignore from "ignore";
import ts from "typescript";

const SKIP_DIRS = new Set([
  "node_modules", "vendor", "dist", "build", "target", "_site", "coverage",
  "__pycache__", "venv", "env",
]);
const EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
  ".html", ".htm", ".css", ".scss", ".sass", ".less", ".vue", ".svelte",
  ".py", ".rs", ".c", ".h", ".cc", ".cpp", ".hpp", ".cxx",
  ".go", ".java", ".kt", ".rb", ".php", ".swift", ".cs", ".sh",
  ".json", ".toml", ".yaml", ".yml", ".md", ".mdx", ".txt", ".sql",
]);
const COLORS = ["#c64639", "#33619f", "#468a4a", "#b0862a", "#6f4ea6", "#ad6a33", "#2e7678", "#a95478"];
const JS = /\.[cm]?[jt]sx?$/i;
const slash = (value) => value.split(path.sep).join("/");

export function classifyScanError(error) {
  const message = error?.message ? String(error.message) : String(error ?? "");
  if (/Enter a local repository path|maxFiles must/i.test(message)) return "invalid-input";
  if (error?.code === "EACCES" || error?.code === "EPERM") return "permission";
  if (error?.code === "ELOOP") return "path-loop";
  if (error?.code === "ENOENT" || /must be a directory/i.test(message)) return "path-not-found";
  return "error";
}

export async function scanRepository(input, { maxFiles = 600, maxFileBytes = 512 * 1024 } = {}) {
  if (typeof input !== "string" || !input.trim()) throw new Error("Enter a local repository path.");
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 2000) {
    throw new Error("maxFiles must be an integer between 1 and 2000.");
  }
  const expanded = input === "~" ? os.homedir() : input.startsWith("~/") ? path.join(os.homedir(), input.slice(2)) : input;
  const root = await realpath(path.resolve(expanded));
  if (!(await stat(root)).isDirectory()) throw new Error("The repository path must be a directory.");

  const files = new Map();
  const warnings = [];
  const warnedReferences = new Set();
  let omittedFiles = 0;
  let readBytes = 0;
  let visited = 0;
  let stopped = false;
  async function walk(directory, inherited) {
    let rules = inherited;
    try {
      const text = await readFile(path.join(directory, ".gitignore"), "utf8");
      rules = [...inherited, { base: directory, matcher: ignore().add(text) }];
    } catch (error) {
      if (error.code !== "ENOENT") warnings.push(`Cannot read ${slash(path.relative(root, directory)) || "."}/.gitignore: ${error.code || error.message}`);
    }
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (directory === root) throw error;
      warnings.push(`Cannot read directory ${slash(path.relative(root, directory))}: ${error.code || error.message}`);
      return;
    }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (++visited > 50000) { stopped = true; return; }
      const absolute = path.join(directory, entry.name);
      const id = slash(path.relative(root, absolute));
      if (entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".") && entry.name !== ".github") continue;
      let ignored = false;
      for (const { base, matcher } of rules) {
        const result = matcher.test(slash(path.relative(base, absolute)) + (entry.isDirectory() ? "/" : ""));
        if (result.ignored) ignored = true;
        else if (result.unignored) ignored = false;
      }
      if (ignored) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(absolute, rules);
        if (stopped) return;
        continue;
      }
      if (!entry.isFile() || entry.name === "repository-map.json" || entry.name === "import-manifest.json") continue;
      if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !/^(Dockerfile|Makefile|CMakeLists.txt|LICENSE)$/.test(entry.name)) continue;
      if (files.size >= maxFiles) { omittedFiles++; continue; }
      try {
        const info = await stat(absolute);
        if (info.size > maxFileBytes || readBytes + info.size > 24 * 1024 * 1024) { omittedFiles++; continue; }
        const buffer = await readFile(absolute);
        if (buffer.includes(0)) { omittedFiles++; continue; }
        readBytes += buffer.length;
        files.set(id, { text: buffer.toString("utf8"), bytes: buffer.length });
      } catch (error) {
        warnings.push(`Cannot read ${id}: ${error.code || error.message}`);
      }
    }
  }
  await walk(root, []);
  if (omittedFiles) warnings.push(`${omittedFiles} eligible files omitted by the ${maxFiles}-file, ${maxFileBytes}-byte per-file, or 24 MiB total limit.`);
  if (stopped) warnings.push("Traversal stopped at 50,000 directory entries; this map is partial.");

  const edgeMap = new Map();
  const unresolved = new Set();
  const directories = new Set([root]);
  for (const id of files.keys()) {
    let directory = path.dirname(path.join(root, id));
    while (directory.startsWith(root)) {
      directories.add(directory);
      if (directory === root) break;
      directory = path.dirname(directory);
    }
  }
  const exists = (absolute) => files.has(slash(path.relative(root, absolute)));
  function connect(source, target, kind) {
    const id = path.posix.normalize(target);
    if (id !== source && files.has(id)) edgeMap.set(`${source}\0${id}`, { source, target: id, kind });
    return files.has(id);
  }
  function resolveReference(source, specifier, kind, { fromRoot = false } = {}) {
    if (!specifier || /^(?:[a-z]+:|\/\/|#)/i.test(specifier)) return;
    let spec;
    try { spec = decodeURIComponent(specifier.split(/[?#]/)[0]); } catch {
      if (!warnedReferences.has(source)) {
        warnedReferences.add(source);
        warnings.push(`Undecodable reference specifier in ${source}; that reference is not drawn.`);
      }
      return;
    }
    const base = path.posix.normalize(path.posix.join(fromRoot || spec.startsWith("/") ? "" : path.posix.dirname(source), spec.replace(/^\//, "")));
    for (const suffix of ["", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".css", ".scss", ".py", ".rs", "/index.js", "/index.ts", "/index.tsx", "/__init__.py", "/mod.rs"]) {
      if (connect(source, base + suffix, kind)) return true;
    }
    if (specifier.startsWith(".")) unresolved.add(`${source}: ${specifier}`);
    return false;
  }

  const optionCache = new Map();
  function compilerOptions(id) {
    let directory = path.posix.dirname(id);
    const key = directory;
    if (optionCache.has(key)) return optionCache.get(key);
    let options = { allowJs: true, jsx: ts.JsxEmit.Preserve, moduleResolution: ts.ModuleResolutionKind.Bundler };
    while (true) {
      const configId = path.posix.join(directory, "tsconfig.json");
      const jsConfigId = path.posix.join(directory, "jsconfig.json");
      const configFile = files.get(configId) || files.get(jsConfigId);
      if (configFile) {
        const parsed = ts.parseConfigFileTextToJson(configId, configFile.text);
        if (parsed.error) warnings.push(`Cannot parse ${configId}; using default module resolution.`);
        else {
          const converted = ts.convertCompilerOptionsFromJson(parsed.config.compilerOptions || {}, path.join(root, directory));
          options = { ...options, ...converted.options };
          if (parsed.config.extends) warnings.push(`${configId}: inherited compiler options are not expanded; some aliases may be unresolved.`);
        }
        break;
      }
      if (directory === ".") break;
      directory = path.posix.dirname(directory);
    }
    optionCache.set(key, options);
    return options;
  }
  function javascript(source, text) {
    const ast = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(source) ? ts.ScriptKind.TSX : /\.jsx$/.test(source) ? ts.ScriptKind.JSX : /\.[cm]?ts$/.test(source) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    if (ast.parseDiagnostics.length) warnings.push(`${source}: syntax could not be fully parsed; references may be incomplete.`);
    const options = compilerOptions(source);
    function add(specifier) {
      const result = ts.resolveModuleName(specifier, path.join(root, source), options, {
        fileExists: exists,
        readFile: () => undefined,
        directoryExists: (directory) => directories.has(path.normalize(directory)),
        getCurrentDirectory: () => root,
      }).resolvedModule;
      if (result) connect(source, slash(path.relative(root, result.resolvedFileName)), "import");
      else if (specifier.startsWith(".")) resolveReference(source, specifier, "import");
    }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) add(node.moduleSpecifier.text);
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) add(node.moduleReference.expression.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) add(node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const [id, { text }] of files) {
    const extension = path.posix.extname(id).toLowerCase();
    if (JS.test(id)) javascript(id, text);
    if ([".html", ".htm", ".vue", ".svelte"].includes(extension)) {
      const markup = text.replace(/<!--[\s\S]*?-->/g, "");
      for (const match of markup.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) resolveReference(id, match[1], "reference");
      for (const match of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (!/\btype\s*=\s*["'](?:application\/ld\+json|application\/json|importmap)["']/i.test(match[1])) javascript(id, match[2]);
      }
    }
    if ([".css", ".scss", ".sass", ".less"].includes(extension)) {
      const styles = text.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const match of styles.matchAll(/@(?:import|use|forward)\s+(?:url\(\s*)?["']([^"']+)["']/g)) resolveReference(id, match[1], "import");
    }
    if ([".c", ".h", ".cc", ".cpp", ".hpp", ".cxx"].includes(extension)) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const match of code.matchAll(/^\s*#\s*include\s*"([^"]+)"/gm)) {
        if (!resolveReference(id, match[1], "include")) resolveReference(id, match[1], "include", { fromRoot: true });
      }
    }
    if (extension === ".py") {
      const code = text.replace(/(?:"""[\s\S]*?"""|'''[\s\S]*?''')/g, "");
      for (const match of code.matchAll(/^\s*(?:from\s+([.\w]+)\s+import\s+([^\n#]+)|import\s+([^\n#]+))/gm)) {
        const specs = match[1] ? [match[1]] : match[3].split(",").map((part) => part.trim().split(/\s+/)[0]);
        for (const spec of specs) {
          const dots = spec.match(/^\.+/)?.[0].length || 0;
          const modulePath = spec.slice(dots).replaceAll(".", "/");
          const bases = dots ? [path.posix.join(path.posix.dirname(id), "../".repeat(dots - 1))] : ["", "src"];
          for (const base of bases) {
            const target = path.posix.join(base, modulePath);
            connect(id, target + ".py", "import");
            connect(id, path.posix.join(target, "__init__.py"), "import");
            if (match[1]) for (const name of match[2].replace(/[()]/g, "").split(",")) {
              const child = path.posix.join(target, name.trim().split(/\s+/)[0]);
              connect(id, child + ".py", "import");
              connect(id, path.posix.join(child, "__init__.py"), "import");
            }
          }
        }
      }
    }
    if (extension === ".rs") {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      const parent = path.posix.dirname(id);
      const moduleBase = /(?:^|\/)(?:lib|main|mod)\.rs$/.test(id) ? parent : id.slice(0, -3);
      for (const match of code.matchAll(/\b(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/g)) {
        connect(id, path.posix.join(moduleBase, match[1] + ".rs"), "module");
        connect(id, path.posix.join(moduleBase, match[1], "mod.rs"), "module");
      }
    }
  }

  const labels = [...new Set([...files.keys()].map((id) => id.includes("/") ? id.split("/")[0] + "/" : "root"))].sort();
  const groups = labels.map((label, index) => ({ id: label, label, color: COLORS[index % COLORS.length] }));
  const nodes = [...files].map(([id, { text, bytes }]) => ({
    id, path: id, label: path.posix.basename(id), group: id.includes("/") ? id.split("/")[0] + "/" : "root",
    language: path.posix.extname(id).slice(1) || "text", bytes, lines: text ? text.split("\n").length - Number(text.endsWith("\n")) : 0,
  }));
  const edges = [...edgeMap.values()].sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  return {
    schemaVersion: 1,
    repository: { name: path.basename(root), root },
    generatedAt: new Date().toISOString(),
    stats: { files: nodes.length, relationships: edges.length, groups: groups.length, omittedFiles, unresolvedReferences: unresolved.size },
    warnings: [...new Set(warnings)], groups, nodes, edges,
  };
}
