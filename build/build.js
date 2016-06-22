var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var jshint = require('jshint').JSHINT;
var hintrc = require('./hintrc.js').config;
var uglify = require("uglify-js");
var colors = require('colors');
var deps = require('./deps.js').deps;

function getSizeDelta(newContent, oldContent) {
	if (!oldContent) {
		return 'new';
	}

	var newLen = newContent.replace(/\r\n?/g, '\n').length;
  var oldLen = oldContent.replace(/\r\n?/g, '\n').length;
  var delta = newLen - oldLen;

	return (delta >= 0 ? '+' : '') + delta;
}

function loadSilently(path) {
	try {
		return fs.readFileSync(path, 'utf8');
	} catch (e) {
		return null;
	}
}

function saveFile(path, newData) {
  var oldData = loadSilently(path);
  var sizeDelta = getSizeDelta(newData, oldData);
  var newSize = newData.length;

  fs.writeFileSync(path, newData, 'utf-8');

  var msg = '\tSaved file: ' + path
    + '\n\t\tSize: ' + newSize
    + ' bytes (' + sizeDelta + ')\n';

  console.log(msg.green);
}

function lintFiles(files) {
  var results = [];

  files.forEach(function (file) {
    var f = fs.readFileSync(file, 'utf-8');
    jshint(f, hintrc);
    if (jshint.errors.length) {
      results.push({file: file, errors: jshint.errors});
    }
  });

  results.forEach(function (result) {
    var errorMsg = 'Found JSHint error(s) on file: ' + result.file;

    result.errors.forEach(function (error) {
      if (!error) {
        return;
      }
      errorMsg += '\n\t@ line ' + error.line + ' col ' + error.character + ' ' + error.reason;
    });

    console.log((errorMsg + '\n').yellow);
  });

  return results;
}

function getSrcFiles() {
  return deps.src.map(function (filename) {
    return path.join(__dirname, '../src/', filename);
  });
}

function mergeFiles(files) {
  return files.reduce(function (a, b) {
    return a + loadSilently(b);
  }, '');
}

function getDistSrc() {
  var info = require(path.join(__dirname, '../package.json'));

  var coprPath = path.join(__dirname, './copyright.template.js');
  var umdPath = path.join(__dirname,'./umd.template.js');

  var template = mergeFiles([coprPath, umdPath]);
  var contents = mergeFiles(getSrcFiles());

  var distSrc = _.template(template)({
    name: info.name,
    version: info.version,
    description: info.description,
    author: info.author,
    license: info.license,
    namespace: 'L.MarkerClusterGroup.LayerSupport',
    amd: '[\'leaflet\']',
    cjs: 'require(\'leaflet\')',
    global: 'root.L',
    param: 'L',
    exports: 'L.MarkerClusterGroup.LayerSupport',
    contents: contents
  });

  return distSrc;
}

exports.lint = function () {
  var errors = lintFiles(getSrcFiles());

  if (errors.length) {
    fail();
  }
};

exports.build = function () {
  var distSrc = getDistSrc();
  var distMinifiedSrc = uglify.minify(distSrc, {
    warnings: true,
    fromString: true,
    output: {
      comments: function (node, comment) {
        return /@preserve|@license|@cc_on/i.test(comment.value);
      }
    }
  }).code;

  var targetPath = path.join(__dirname, '../dist');
  var filename = 'leaflet.markercluster.layersupport';
  var distFilename = filename + '-src.js';
  var distMinifiedFilename = filename + '.js';

  saveFile(path.join(targetPath, distFilename), distSrc);
  saveFile(path.join(targetPath, distMinifiedFilename), distMinifiedSrc);
};
