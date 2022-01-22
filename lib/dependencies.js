'use strict';

const metautil = require('metautil');

const node = {};
const npm = {};
const metarhia = {};

const system = ['util', 'child_process', 'os', 'v8', 'vm'];
const tools = ['path', 'url', 'string_decoder', 'querystring', 'assert'];
const streams = ['stream', 'fs', 'crypto', 'zlib', 'readline'];
const async = ['perf_hooks', 'async_hooks', 'timers', 'events'];
const network = ['dns', 'net', 'tls', 'http', 'https', 'http2', 'dgram'];
const internals = [...system, ...tools, ...streams, ...async, ...network];

const optional = ['metasql'];
const metapkg = ['metautil', 'metacom', 'metaschema', ...optional];

const npmpkg = ['ws'];
const pkg = require(process.cwd() + '/package.json');
if (pkg.dependencies) npmpkg.push(...Object.keys(pkg.dependencies));
const dependencies = [...internals, ...npmpkg, ...metapkg];

const notLoaded = new Set();

const spinalToCamel = (name) => {
  const words = metautil.split(name, '-');
  return words[0] + words.slice(1).map(metautil.toUpperCamel).join('');
};

const assignNamespace = (container, name, value) => {
  container[name] = value;
  const key = metautil.replace(
    name.startsWith('@') ? name.slice(1) : name,
    '/',
    '-'
  );
  const camelKey = spinalToCamel(key);
  container[camelKey] = value;
};

for (const name of dependencies) {
  if (name === 'impress') continue;
  let lib = null;
  try {
    lib = require(name);
  } catch {
    if (npmpkg.includes(name) || !optional.includes(name)) {
      notLoaded.add(name);
    }
    continue;
  }
  if (internals.includes(name)) {
    assignNamespace(node, name, lib);
    continue;
  }
  if (metapkg.includes(name)) {
    assignNamespace(metarhia, name, lib);
    continue;
  }
  assignNamespace(npm, name, lib);
}

node.childProcess = node['child_process'];
node.StringDecoder = node['string_decoder'];
node.perfHooks = node['perf_hooks'];
node.asyncHooks = node['async_hooks'];
node.fsp = node.fs.promises;

Object.freeze(node);
Object.freeze(npm);
Object.freeze(metarhia);

module.exports = { node, npm, metarhia, notLoaded };
