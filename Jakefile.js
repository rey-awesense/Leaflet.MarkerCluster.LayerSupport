/*
Leaflet.markercluster.layersupport building, and linting scripts.

To use, install Node, then run the following commands in the project root:

    npm install

To check the code for errors and build Leaflet from source, run "npm run lint".
*/

var build = require('./build/build.js');

desc('Validates leaflet.markercluster.layersupport with JSHint');
task('lint', build.lint);

desc('Minifies source files');
task('build', ['lint'], build.build);

task('default', ['build']);
