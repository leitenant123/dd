'use strict';

// Application interface for Impress Application Server

const SCRIPT_PREPARE_TIMEOUT = 500;
const USE_STRICT = '\'use strict\';\n';

const DEFAULT_SANDBOX = [
  'Duration', 'Buffer', 'SlowBuffer', 'process',
  'setTimeout', 'setInterval', 'setImmediate',
  'clearTimeout', 'clearInterval', 'clearImmediate'
];

const apiWrap = src => {
  const s = src.toString().trim();
  const prepared = s[s.length - 1] === ';' ? s.slice(0, -1) : s;
  return USE_STRICT + `(connection => (${prepared}))`;
};

const codeWrap = src => {
  const CURLY = 123;
  const SQUARE = 91;
  const ROUND = 40;
  if (src[0] === ROUND || src[0] === CURLY || src[0] === SQUARE) {
    return  `${USE_STRICT}return (${src});`;
  } else {
    return  `${USE_STRICT}${src}`;
  }
};

// PrepareScript
//   fileName <string> file name (absolute path)
//   source <string> JavaScript code
// Returns: <Object> exported from script
const prepareScript = (application, fileName, source) => {
  const key = application.relative(fileName);
  const options = {
    filename: fileName,
    timeout: SCRIPT_PREPARE_TIMEOUT,
    lineOffset: -1, // to compensate for USE_STRICT addition
  };
  if (key.startsWith('/api/')) {
    const code = apiWrap(source);
    try {
      const script = new api.vm.Script(code, options);
      const exports = script.runInContext(application.sandbox, options);
      application.cache.scripts.set(key, exports);
      return exports;
    } catch (err) {
      application.logException(err);
      return null;
    }
  } else {
    const code = codeWrap(source);
    const options = {
      filename: fileName,
      timeout: SCRIPT_PREPARE_TIMEOUT,
      parsingContext: application.sandbox,
    };
    try {
      const fn = api.vm.compileFunction(code, [], options);
      const exports = fn();
      application.cache.scripts.set(key, exports);
      return exports;
    } catch (err) {
      application.logException(err);
      return null;
    }
  }
};

// Create script
//   fileName <string> absolute path
//   callback <Function>(err, exports)
impress.createScript = (application, fileName, callback) => {
  const key = application.relative(fileName);
  let exports = application.cache.scripts.get(key);
  if (exports) {
    callback(null, exports);
    return;
  }
  api.fs.readFile(fileName, (err, code) => {
    if (err) {
      impress.log.error(impress.CANT_READ_FILE + fileName);
      callback(err);
    } else {
      exports = prepareScript(application, fileName, code);
      callback(null, exports);
    }
  });
};

impress.createSandbox = (application, callback) => {
  const sandbox = {
    api: {},
    console: api.con.createConsole(application.name)
  };
  sandbox.global = sandbox;
  sandbox.application = application;
  api.vm.createContext(sandbox);
  application.sandbox = sandbox;
  application.config.loadSandboxConfig(sandboxConfig => {
    const globals = sandboxConfig.global || DEFAULT_SANDBOX;
    for (let i = 0; i < globals.length; i++) {
      const moduleName = globals[i];
      if (moduleName === 'require') continue;
      const moduleLink = moduleName === 'Duration' ?
        api.common.duration : global[moduleName];
      if (moduleLink) {
        application.sandbox[moduleName] = moduleLink;
      }
    }
    const apis = sandboxConfig.api || api.registry.defaultNames;
    for (let j = 0; j < apis.length; j++) {
      let moduleName = apis[j];
      let moduleLink = api[moduleName];
      if (!moduleLink) moduleLink = api.registry.require(moduleName);
      if (moduleName === 'fs') {
        moduleLink = api.sandboxedFs.bind(application.dir);
      }
      moduleName = api.common.spinalToCamel(moduleName);
      if (moduleLink) application.sandbox.api[moduleName] = moduleLink;
    }
    callback();
  });
};
