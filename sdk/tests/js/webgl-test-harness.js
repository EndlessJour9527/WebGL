/*
Copyright (c) 2019 The Khronos Group Inc.
Use of this source code is governed by an MIT-style license that can be
found in the LICENSE.txt file.
*/

// This is a test harness for running javascript tests in the browser.
// The only identifier exposed by this harness is WebGLTestHarnessModule.
//
// To use it make an HTML page with an iframe. Then call the harness like this
//
//    function reportResults(type, msg, success) {
//      ...
//      return true;
//    }
//
//    var fileListURL = '00_test_list.txt';
//    var testHarness = new WebGLTestHarnessModule.TestHarness(
//        iframe,
//        fileListURL,
//        reportResults,
//        options);
//
// The harness will load the fileListURL and parse it for the URLs, one URL
// per line preceded by options, see below. URLs should be on the same domain
// and at the  same folder level or below the main html file.  If any URL ends
// in .txt it will be parsed as well so you can nest .txt files. URLs inside a
// .txt file should be relative to that text file.
//
// During startup, for each page found the reportFunction will be called with
// WebGLTestHarnessModule.TestHarness.reportType.ADD_PAGE and msg will be
// the URL of the test.
//
// Each test is required to call testHarness.reportResults. This is most easily
// accomplished by storing that value on the main window with
//
//     window.webglTestHarness = testHarness
//
// and then adding these to functions to your tests.
//
//     function reportTestResultsToHarness(success, msg) {
//       if (window.parent.webglTestHarness) {
//         window.parent.webglTestHarness.reportResults(success, msg);
//       }
//     }
//
//     function notifyFinishedToHarness() {
//       if (window.parent.webglTestHarness) {
//         window.parent.webglTestHarness.notifyFinished();
//       }
//     }
//
// This way your tests will still run without the harness and you can use
// any testing framework you want.
//
// Each test should call reportTestResultsToHarness with true for success if it
// succeeded and false if it fail followed and any message it wants to
// associate with the test. If your testing framework supports checking for
// timeout you can call it with success equal to undefined in that case.
//
// To run the tests, call testHarness.runTests(options);
//
// For each test run, before the page is loaded the reportFunction will be
// called with WebGLTestHarnessModule.TestHarness.reportType.START_PAGE and msg
// will be the URL of the test. You may return false if you want the test to be
// skipped.
//
// For each test completed the reportFunction will be called with
// with WebGLTestHarnessModule.TestHarness.reportType.TEST_RESULT,
// success = true on success, false on failure, undefined on timeout
// and msg is any message the test choose to pass on.
//
// When all the tests on the page have finished your page must call
// notifyFinishedToHarness.  If notifyFinishedToHarness is not called
// the harness will assume the test timed out.
//
// When all the tests on a page have finished OR the page as timed out the
// reportFunction will be called with
// WebGLTestHarnessModule.TestHarness.reportType.FINISH_PAGE
// where success = true if the page has completed or undefined if the page timed
// out.
//
// Finally, when all the tests have completed the reportFunction will be called
// with WebGLTestHarnessModule.TestHarness.reportType.FINISHED_ALL_TESTS.
//
// Harness Options
//
// These are passed in to the TestHarness as a JavaScript object
//
// version: (required!)
//
//     Specifies a version used to filter tests. Tests marked as requiring
//     a version greater than this version will not be included.
//
//     example: new TestHarness(...., {version: "3.1.2"});
//
// minVersion:
//
//     Specifies the minimum version a test must require to be included.
//     This basically flips the filter so that only tests marked with
//     --min-version will be included if they are at this minVersion or
//     greater.
//
//     example: new TestHarness(...., {minVersion: "2.3.1"});
//
// maxVersion:
//
//     Specifies the maximum version a test must require to be included.
//     This basically flips the filter so that only tests marked with
//     --max-version will be included if they are at this maxVersion or
//     less.
//
//     example: new TestHarness(...., {maxVersion: "2.3.1"});
//
// fast:
//
//     Specifies to skip any tests marked as slow.
//
//     example: new TestHarness(..., {fast: true});
//
// Test Options:
//
// Any test URL or .txt file can be prefixed by the following options
//
// min-version:
//
//     Sets the minimum version required to include this test. A version is
//     passed into the harness options. Any test marked as requiring a
//     min-version greater than the version passed to the harness is skipped.
//     This allows you to add new tests to a suite of tests for a future
//     version of the suite without including the test in the current version.
//     If no -min-version is specified it is inheriited from the .txt file
//     including it. The default is 1.0.0
//
//     example:  --min-version 2.1.3 sometest.html
//
// max-version:
//
//     Sets the maximum version required to include this test. A version is
//     passed into the harness options. Any test marked as requiring a
//     max-version less than the version passed to the harness is skipped.
//     This allows you to test functionality that has been removed from later
//     versions of the suite.
//     If no -max-version is specified it is inherited from the .txt file
//     including it.
//
//     example:  --max-version 1.9.9 sometest.html
//
// slow:
//
//     Marks a test as slow. Slow tests can be skipped by passing fastOnly: true
//     to the TestHarness. Of course you need to pass all tests but sometimes
//     you'd like to test quickly and run only the fast subset of tests.
//
//     example:  --slow some-test-that-takes-2-mins.html
//
try {
  console.log("[DEBUG] Starting WebGLTestHarnessModule initialization");

  WebGLTestHarnessModule = function () {
    console.log("[DEBUG] WebGLTestHarnessModule function called");
    /**
     * Wrapped logging function.
     */
    var log = function (msg) {
      if (window.console && window.console.log) {
        window.console.log(msg);
      }
    };

    /**
     * Loads text from an external file. This function is synchronous.
     * @param {string} url The url of the external file.
     * @param {!function(bool, string): void} callback that is sent a bool for
     *     success and the string.
     */
    var loadTextFileAsynchronous = function (url, callback) {
      console.log("[DEBUG] loadTextFileAsynchronous called for URL:", url);
      url = 'http://127.0.0.1:5500/sdk/tests/' + url;
      log("loading: " + url);
      var error = 'loadTextFileSynchronous failed to load url "' + url + '"';
      var request;
      if (window.XMLHttpRequest) {
        console.log("[DEBUG] XMLHttpRequest available");
        request = new XMLHttpRequest();
        if (request.overrideMimeType) {
          request.overrideMimeType('text/plain');
        }
      } else {
        console.log("[DEBUG] XMLHttpRequest is disabled");
        throw 'XMLHttpRequest is disabled';
      }
      try {
        console.log("[DEBUG] Opening GET request for:", url);
        request.open('GET', url, true);
        request.onreadystatechange = function () {
          console.log("[DEBUG] XMLHttpRequest readyState changed to:", request.readyState, "for URL:", url);
          if (request.readyState == 4) {
            var text = '';
            // HTTP reports success with a 200 status. The file protocol reports
            // success with zero. HTTP does not use zero as a status code (they
            // start at 100).
            // https://developer.mozilla.org/En/Using_XMLHttpRequest
            var success = request.status == 200 || request.status == 0;
            console.log("[DEBUG] Request completed with status:", request.status, "success:", success, "for URL:", url);
            if (success) {
              text = request.responseText;
              console.log("[DEBUG] Response text length:", text.length);
            } else {
              console.log("[DEBUG] Request failed with status:", request.status, "statusText:", request.statusText);
            }
            log("loaded: " + url);
            callback(success, text);
          }
        };
        console.log("[DEBUG] Sending XMLHttpRequest for:", url);
        request.send(null);
      } catch (e) {
        console.log("[DEBUG] Exception in loadTextFileAsynchronous:", e, "for URL:", url);
        log("failed to load: " + url);
        callback(false, '');
      }
    };

    /**
     * @param {string} versionString WebGL version string.
     * @return {number} Integer containing the WebGL major version.
     */
    var getMajorVersion = function (versionString) {
      if (!versionString) {
        return 1;
      }
      return parseInt(versionString.split(" ")[0].split(".")[0], 10);
    };

    /**
     * @param {string} url Base URL of the test.
     * @param {map} options Map of options to append to the URL's query string.
     * @return {string} URL that will run the test with the given WebGL version.
     */
    var getURLWithOptions = function (url, options) {
      var queryArgs = 0;

      for (i in options) {
        url += queryArgs ? "&" : "?";
        url += i + "=" + options[i];
        queryArgs++;
      }

      return url;
    };

    /**
     * Compare version strings.
     */
    var greaterThanOrEqualToVersion = function (have, want) {
      have = have.split(" ")[0].split(".");
      want = want.split(" ")[0].split(".");

      //have 1.2.3   want  1.1
      //have 1.1.1   want  1.1
      //have 1.0.9   want  1.1
      //have 1.1     want  1.1.1

      for (var ii = 0; ii < want.length; ++ii) {
        var wantNum = parseInt(want[ii]);
        var haveNum = have[ii] ? parseInt(have[ii]) : 0
        if (haveNum > wantNum) {
          return true; // 2.0.0 is greater than 1.2.3
        }
        if (haveNum < wantNum) {
          return false;
        }
      }
      return true;
    };

    /**
     * Reads a file, recursively adding files referenced inside.
     *
     * Each line of URL is parsed, comments starting with '#' or ';'
     * or '//' are stripped.
     *
     * arguments beginning with -- are extracted
     *
     * lines that end in .txt are recursively scanned for more files
     * other lines are added to the list of files.
     *
     * @param {string} url The url of the file to read.
     * @param {function(boolean, !Array.<string>):void} callback
     *      Callback that is called with true for success and an
     *      array of filenames.
     * @param {Object} options Optional options
     *
     * Options:
     *    version: {string} The version of the conformance test.
     *    Tests with the argument --min-version <version> will
     *    be ignored version is less then <version>
     *
     */
    var getFileList = function (url, callback, options) {
      var files = [];

      var copyObject = function (obj) {
        return JSON.parse(JSON.stringify(obj));
      };

      var toCamelCase = function (str) {
        return str.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase() });
      };

      var globalOptions = copyObject(options);
      globalOptions.defaultVersion = "1.0";
      globalOptions.defaultMaxVersion = null;

      var getFileListImpl = function (prefix, line, lineNum, hierarchicalOptions, callback) {
        var files = [];

        var args = line.split(/\s+/);
        var nonOptions = [];
        var useTest = true;
        var testOptions = {};
        for (var jj = 0; jj < args.length; ++jj) {
          var arg = args[jj];
          if (arg[0] == '-') {
            if (arg[1] != '-') {
              throw ("bad option at in " + url + ":" + lineNum + ": " + arg);
            }
            var option = arg.substring(2);
            switch (option) {
              // no argument options.
              case 'slow':
                testOptions[toCamelCase(option)] = true;
                break;
              // one argument options.
              case 'min-version':
              case 'max-version':
                ++jj;
                testOptions[toCamelCase(option)] = args[jj];
                break;
              default:
                throw ("bad unknown option '" + option + "' at in " + url + ":" + lineNum + ": " + arg);
            }
          } else {
            nonOptions.push(arg);
          }
        }
        var url = prefix + nonOptions.join(" ");

        if (url.substr(url.length - 4) != '.txt') {
          var minVersion = testOptions.minVersion;
          if (!minVersion) {
            minVersion = hierarchicalOptions.defaultVersion;
          }
          var maxVersion = testOptions.maxVersion;
          if (!maxVersion) {
            maxVersion = hierarchicalOptions.defaultMaxVersion;
          }
          var slow = testOptions.slow;
          if (!slow) {
            slow = hierarchicalOptions.defaultSlow;
          }

          if (globalOptions.fast && slow) {
            useTest = false;
          } else if (globalOptions.minVersion) {
            useTest = greaterThanOrEqualToVersion(minVersion, globalOptions.minVersion);
          } else if (globalOptions.maxVersion && maxVersion) {
            useTest = greaterThanOrEqualToVersion(globalOptions.maxVersion, maxVersion);
          } else {
            useTest = greaterThanOrEqualToVersion(globalOptions.version, minVersion);
            if (maxVersion) {
              useTest = useTest && greaterThanOrEqualToVersion(maxVersion, globalOptions.version);
            }
          }
        }

        if (!useTest) {
          callback(true, []);
          return;
        }

        if (url.substr(url.length - 4) == '.txt') {
          // If a version was explicity specified pass it down.
          if (testOptions.minVersion) {
            hierarchicalOptions.defaultVersion = testOptions.minVersion;
          }
          if (testOptions.maxVersion) {
            hierarchicalOptions.defaultMaxVersion = testOptions.maxVersion;
          }
          if (testOptions.slow) {
            hierarchicalOptions.defaultSlow = testOptions.slow;
          }
          loadTextFileAsynchronous(url, function () {
            return function (success, text) {
              if (!success) {
                callback(false, '');
                return;
              }
              var lines = text.split('\n');
              var prefix = '';
              var lastSlash = url.lastIndexOf('/');
              if (lastSlash >= 0) {
                prefix = url.substr(0, lastSlash + 1);
              }
              var fail = false;
              var count = 1;
              var index = 0;
              for (var ii = 0; ii < lines.length; ++ii) {
                var str = lines[ii].replace(/^\s\s*/, '').replace(/\s\s*$/, '');
                if (str.length > 4 &&
                  str[0] != '#' &&
                  str[0] != ";" &&
                  str.substr(0, 2) != "//") {
                  ++count;
                  getFileListImpl(prefix, str, ii + 1, copyObject(hierarchicalOptions), function (index) {
                    return function (success, new_files) {
                      //log("got files: " + new_files.length);
                      if (success) {
                        files[index] = new_files;
                      }
                      finish(success);
                    };
                  }(index++));
                }
              }
              finish(true);

              function finish(success) {
                if (!success) {
                  fail = true;
                }
                --count;
                //log("count: " + count);
                if (!count) {
                  callback(!fail, files);
                }
              }
            }
          }());
        } else {
          files.push(url);
          callback(true, files);
        }
      };
      console.log("[DEBUG] getFileList starting with URL:", url);
      getFileListImpl('', url, 1, globalOptions, function (success, files) {
        // console.log("[DEBUG] getFileListImpl completed with success:", success, "files:", files);
        // flatten
        var flat = [];
        flatten(files);
        function flatten(files) {
          for (var ii = 0; ii < files.length; ++ii) {
            var value = files[ii];
            if (typeof (value) == "string") {
              flat.push(value);
            } else {
              flatten(value);
            }
          }
        }
        // console.log("[DEBUG] Flattened file list:", flat);
        callback(success, flat);
      });
    };

    var FilterURL = (function () {
      var prefix = window.location.pathname;
      prefix = prefix.substring(0, prefix.lastIndexOf("/") + 1);
      return function (url) {
        if (url.substring(0, prefix.length) == prefix) {
          url = url.substring(prefix.length);
        }
        return url;
      };
    }());

    var TestFile = function (url) {
      this.url = url;
    };

    var Test = function (file) {
      this.file = file;
    };

    var TestHarness = function (iframe, filelistUrl, reportFunc, options) {
      console.log("[DEBUG] TestHarness constructor called with:", {
        iframe: iframe,
        filelistUrl: filelistUrl,
        options: options
      });

      this.window = window;
      this.iframes = iframe.length ? iframe : [iframe];
      this.reportFunc = reportFunc;
      // Keep the original options object for later use (e.g. selectedFolders)
      this.options = options || {};
      this.timeoutDelay = 20000;
      this.files = [];
      this.allowSkip = options.allowSkip;
      this.webglVersion = getMajorVersion(options.version);
      this.dumpShaders = options.dumpShaders;
      this.quiet = options.quiet;

      // Preload control: number of files to load initially and whether to load all immediately
      // preloadCount: integer (default 5)
      // loadAll: boolean (default false)
      this.preloadCount = (options && typeof options.preloadCount === 'number') ? options.preloadCount : 5;
      this.loadAll = true;// !!(options && options.loadAll);
      // Store remaining files when we only preload a subset
      this._remainingFiles = [];

      console.log("[DEBUG] TestHarness initialized with webglVersion:", this.webglVersion);

      var that = this;
      console.log("[DEBUG] About to call getFileList with URL:", filelistUrl);
      getFileList(filelistUrl, function () {
        return function (success, files) {
          console.log("[DEBUG] getFileList callback called with success:", success, "files count:", files ? files.length : 0);
          that.addFiles_(success, files);
        };
      }(), options);

    };

    TestHarness.reportType = {
      ADD_PAGE: 1,
      READY: 2,
      START_PAGE: 3,
      TEST_RESULT: 4,
      FINISH_PAGE: 5,
      FINISHED_ALL_TESTS: 6
    };

    TestHarness.prototype.addFiles_ = function (success, files) {
      console.log("[DEBUG] addFiles_ called with success:", success, "files:", files);

      if (!success) {
        console.log("[DEBUG] Failed to load files, reporting FINISHED_ALL_TESTS");
        this.reportFunc(
          TestHarness.reportType.FINISHED_ALL_TESTS,
          '',
          'Unable to load tests. Are you running locally?\n' +
          'You need to run from a server or configure your\n' +
          'browser to allow access to local files (not recommended).\n\n' +
          'Note: An easy way to run from a server:\n\n' +
          '\tcd path_to_tests\n' +
          '\tpython -m SimpleHTTPServer\n\n' +
          'then point your browser to ' +
          '<a href="http://localhost:8000/webgl-conformance-tests.html">' +
          'http://localhost:8000/webgl-conformance-tests.html</a>',
          false)
        return;
      }

      console.log("[DEBUG] Successfully loaded", files.length, "files");
      log("total files: " + files.length);

      // If selectedFolders is provided, filter the files list to include only
      // files under those folder prefixes. selectedFolders is expected to be
      // an array of folder prefixes (including trailing slash), e.g. ['attribs/'].
      var selected = (this.options && this.options.selectedFolders) ? this.options.selectedFolders : null;
      if (selected && Array.isArray(selected)) {
        try {
          var sfs = selected.map(function (s) { return (s === './' ? '' : s); });
          files = files.filter(function (f) {
            var idx = f.lastIndexOf('/');
            var dir = idx >= 0 ? f.substring(0, idx + 1) : '';
            return sfs.some(function (sf) {
              if (!sf) return true;
              return dir.indexOf(sf) === 0;
            });
          });
          console.log("[DEBUG] Filtered files by selectedFolders; remaining count:", files.length);
        } catch (e) {
          console.warn('[DEBUG] Error filtering selectedFolders', e);
        }
      }

      // If loadAll is true, add everything. Otherwise, add only preloadCount and stash the rest.
      var toAdd = files;
      var startIndex = 0;
      this._remainingFiles = [];
      if (!this.loadAll && this.preloadCount > 0 && files.length > this.preloadCount) {
        toAdd = files.slice(0, this.preloadCount);
        this._remainingFiles = files.slice(this.preloadCount);
      }

      for (var ii = 0; ii < toAdd.length; ++ii) {
        log("" + ii + ": " + toAdd[ii]);
        this.files.push(new TestFile(toAdd[ii]));
        this.reportFunc(TestHarness.reportType.ADD_PAGE, '', toAdd[ii], undefined);
      }

      if (this._remainingFiles.length > 0) {
        console.log("[DEBUG] Preloaded " + toAdd.length + " files, " + this._remainingFiles.length + " remaining. Call loadAllFiles() to load the rest.");
      }
      console.log("[DEBUG] Reporting READY state");
      this.reportFunc(TestHarness.reportType.READY, '', undefined, undefined);
    }

    // Request to load all remaining files that were deferred by preloadCount.
    TestHarness.prototype.setLoadAll = function (v) {
      this.loadAll = !!v;
    };

    TestHarness.prototype.loadAllFiles = function () {
      if (!this._remainingFiles || this._remainingFiles.length === 0) return;
      console.log("[DEBUG] loadAllFiles: loading " + this._remainingFiles.length + " remaining files");
      for (var ii = 0; ii < this._remainingFiles.length; ++ii) {
        var f = this._remainingFiles[ii];
        this.files.push(new TestFile(f));
        this.reportFunc(TestHarness.reportType.ADD_PAGE, '', f, undefined);
      }
      this._remainingFiles = [];
    };

    TestHarness.prototype.runTests = function (opt_options) {
      console.log("[DEBUG] runTests called with options:", opt_options);
      var options = opt_options || {};
      options.start = options.start || 0;
      options.count = options.count || this.files.length;

      this.idleIFrames = this.iframes.slice(0);
      this.runningTests = {};
      var testsToRun = [];
      for (var ii = 0; ii < options.count; ++ii) {
        testsToRun.push(ii + options.start);
      }
      this.numTestsRemaining = options.count;
      this.testsToRun = testsToRun;
      this.startNextTest();
    };

    TestHarness.prototype._bumpTimeout = function (test) {
      const newTimeoutAt = performance.now() + this.timeoutDelay;
      if (test.timeoutAt) {
        const old = test.timeoutAt;
        test.timeoutAt = newTimeoutAt;
        try {
          console.log(`[HARNESS][bumpTimeout][extend] url=${test.testFile && test.testFile.url} now=${performance.now().toFixed(3)} old=${old.toFixed(3)} new=${newTimeoutAt.toFixed(3)} remaining=${(old - performance.now()).toFixed(3)}`);
        } catch (e) { }
        return; // existing watchdog will see updated deadline
      }
      test.timeoutAt = newTimeoutAt;
      test.lastProgressAt = performance.now(); // initialize progress timestamp

      try {
        console.log(`[HARNESS][bumpTimeout][start] url=${test.testFile && test.testFile.url} now=${performance.now().toFixed(3)} new=${newTimeoutAt.toFixed(3)} delay=${this.timeoutDelay}`);
      } catch (e) { }

      const harness = this;

      const enqueueWatchdog = () => {
        // If test.timeoutAt was cleared meanwhile, stop scheduling.
        if (!test.timeoutAt) {
          try { console.log('[HARNESS][watchdog] aborted (timeout cleared)'); } catch (e) { }
          return;
        }
        const now = performance.now();
        let remaining = test.timeoutAt - now;
        // Clamp remaining to avoid negative or extremely small setTimeout which can starve event loop logging.
        if (remaining < 0) remaining = 0;
        const delay = Math.max(5, remaining); // minimum 5ms for stability
        try {
          console.log(`[HARNESS][watchdog][schedule] url=${test.testFile && test.testFile.url} now=${now.toFixed(3)} deadline=${test.timeoutAt.toFixed(3)} remaining=${remaining.toFixed(3)} usingDelay=${delay.toFixed(3)}`);
        } catch (e) { }
        harness.window.setTimeout(() => {
          if (!test.timeoutAt) {
            try { console.log('[HARNESS][watchdog] exit (timeout cleared before check)'); } catch (e) { }
            return; // Timeout was cleared.
          }
          const checkNow = performance.now();
          const remainingAtCheckTime = test.timeoutAt - checkNow;
          const sinceProgress = (checkNow - (test.lastProgressAt || 0));
          if (checkNow >= test.timeoutAt) {
            try {
              console.log(`[HARNESS][watchdog][fire] url=${test.testFile && test.testFile.url} now=${checkNow.toFixed(3)} deadline=${test.timeoutAt.toFixed(3)} sinceProgress=${sinceProgress.toFixed(3)}`);
            } catch (e) { }
            harness.timeout(test);
            return;
          }
          try {
            console.log(`[HARNESS][watchdog][defer] url=${test.testFile && test.testFile.url} now=${checkNow.toFixed(3)} newDeadline=${test.timeoutAt.toFixed(3)} remaining=${remainingAtCheckTime.toFixed(3)} sinceProgress=${sinceProgress.toFixed(3)}`);
          } catch (e) { }
          enqueueWatchdog();
        }, delay);
      };
      enqueueWatchdog();
    };

    TestHarness.prototype.clearTimeout = function (test) {
      test.timeoutAt = null;
    };

    TestHarness.prototype.startNextTest = function () {
      if (this.numTestsRemaining == 0) {
        log("done");
        this.reportFunc(TestHarness.reportType.FINISHED_ALL_TESTS,
          '', '', true);
      } else {
        while (this.testsToRun.length > 0 && this.idleIFrames.length > 0) {
          var testId = this.testsToRun.shift();
          var iframe = this.idleIFrames.shift();
          this.startTest(iframe, this.files[testId], this.webglVersion);
        }
      }
    };

    TestHarness.prototype.startTest = function (iframe, testFile, webglVersion) {
      var test = {
        iframe: iframe,
        testFile: testFile
      };
      var url = testFile.url;
      this.runningTests[url] = test;
      try { console.log(`[HARNESS][startTest] url=${url} webglVersion=${webglVersion} time=${performance.now().toFixed(3)}`); } catch (e) { }
      log("loading: " + url);
      if (this.reportFunc(TestHarness.reportType.START_PAGE, url, url, undefined)) {
        iframe.src = getURLWithOptions(url, {
          "webglVersion": webglVersion,
          "dumpShaders": this.dumpShaders,
          "quiet": this.quiet
        });

        // Inject iframe instrumentation AFTER initial document arrives (best-effort) for selected tests.
        // NOTE: If the test executes critical GL calls in inline scripts before DOMContentLoaded,
        // those early calls won't be captured. This is an acceptable limitation for now.
        const shouldInstrument = /gl-bindAttribLocation-aliasing\.html/.test(url);
        if (shouldInstrument) {
          const instrumentationId = `__harness_instrumented_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const attachInstrumentation = () => {
            let win, doc;
            try { win = iframe.contentWindow; doc = win && win.document; } catch (e) { }
            if (!win || !doc) {
              console.log('[HARNESS][instrument][retry] iframe window/doc not ready');
              setTimeout(attachInstrumentation, 50);
              return;
            }
            if (win[instrumentationId]) {
              console.log('[HARNESS][instrument] already installed');
              return;
            }
            try {
              const script = doc.createElement('script');
              script.type = 'text/javascript';
              script.text = `(() => {\n` +
                `  const INST_ID = '${instrumentationId}';\n` +
                `  if (window[INST_ID]) return; window[INST_ID] = true;\n` +
                `  const start = performance.now();\n` +
                `  function log(msg){ try{ console.log('[IFRAME][instrument]', msg); }catch(e){} }\n` +
                `  log('install start url=' + location.href);\n` +
                `  // XHR hook\n` +
                `  (function(){\n` +
                `    const OrigXHR = window.XMLHttpRequest; if(!OrigXHR) return;\n` +
                `    window.XMLHttpRequest = function(){ const xhr = new OrigXHR();\n` +
                `      const id = 'xhr#'+Math.random().toString(36).slice(2);\n` +
                `      xhr.addEventListener('loadstart', ()=>log(id+' loadstart '+xhr._openArgs));\n` +
                `      xhr.addEventListener('load', ()=>log(id+' load '+xhr.status));\n` +
                `      xhr.addEventListener('error', ()=>log(id+' error'));\n` +
                `      xhr.addEventListener('abort', ()=>log(id+' abort'));\n` +
                `      const origOpen = xhr.open; xhr.open = function(m,u,a,b,c){ xhr._openArgs = m+' '+u; log(id+' open '+xhr._openArgs); return origOpen.apply(xhr, arguments); };\n` +
                `      return xhr; };\n` +
                `  })();\n` +
                `  // fetch hook\n` +
                `  if (window.fetch) {\n` +
                `    const origFetch = window.fetch;\n` +
                `    window.fetch = function(){ const t0 = performance.now(); const url = arguments[0]; log('fetch '+url); return origFetch.apply(this, arguments).then(r=>{ log('fetch done '+url+' status='+r.status+' dt='+(performance.now()-t0).toFixed(1)); return r; }).catch(e=>{ log('fetch error '+url+' '+e); throw e; }); };\n` +
                `  }\n` +
                `  function wrapGLProto(proto, name){ if(!proto || !proto[name]) return; const orig = proto[name]; proto[name] = function(){ const t0 = performance.now(); try { return orig.apply(this, arguments); } finally { const dt = performance.now()-t0; log('GL '+name+' dt='+dt.toFixed(3)); } }; }\n` +
                `  function installGLHooks(){\n` +
                `    const c = document.createElement('canvas');\n` +
                `    let gl = c.getContext('webgl2') || c.getContext('webgl');\n` +
                `    if(!gl){ log('no GL context for hook'); return; }\n` +
                `    const protoList = [];\n` +
                `    if (window.WebGL2RenderingContext) protoList.push(window.WebGL2RenderingContext.prototype);\n` +
                `    if (window.WebGLRenderingContext) protoList.push(window.WebGLRenderingContext.prototype);\n` +
                `    protoList.forEach(p=>{ ['bindAttribLocation','linkProgram','getProgramParameter','getActiveAttrib','getAttribLocation'].forEach(fn=>wrapGLProto(p, fn)); });\n` +
                `    log('GL hooks installed');\n` +
                `  }\n` +
                `  installGLHooks();\n` +
                `  // Heartbeat\n` +
                `  setInterval(()=>{ log('heartbeat t='+(performance.now()-start).toFixed(0)); }, 2000);\n` +
                `  window.addEventListener('error', e=>{ log('window.error '+e.message+' at '+e.filename+':'+e.lineno); });\n` +
                `  window.addEventListener('unhandledrejection', e=>{ log('unhandledrejection '+e.reason); });\n` +
                `  log('instrumentation complete');\n` +
                `})();`;
              doc.documentElement.appendChild(script);
              console.log('[HARNESS][instrument] script injected');
            } catch (e) {
              console.log('[HARNESS][instrument][error]', e);
            }
          };
          // Try a few times until the iframe document is reachable.
          setTimeout(attachInstrumentation, 50);
          setTimeout(attachInstrumentation, 150);
          setTimeout(attachInstrumentation, 300);
          // Also hook load event.
          iframe.addEventListener('load', attachInstrumentation, { once: true });
        }
        this._bumpTimeout(test);
      } else {
        this.reportResults(url, !!this.allowSkip, "skipped", true);
        this.notifyFinished(url);
      }
    };

    TestHarness.prototype.getTest = function (url) {
      var test = this.runningTests[FilterURL(url)];
      if (!test) {
        throw ("unknown test:" + url);
      }
      return test;
    };

    TestHarness.prototype.reportResults = function (url, success, msg, skipped) {
      url = FilterURL(url);
      var test = this.getTest(url);
      if (test) {
        test.lastProgressAt = performance.now();
        try { console.log(`[HARNESS][reportResults] url=${url} success=${success} skipped=${!!skipped} now=${test.lastProgressAt.toFixed(3)} deadline=${test.timeoutAt ? test.timeoutAt.toFixed(3) : 'n/a'}`); } catch (e) { }
      }
      if (0) {
        // This is too slow to leave on for tests like
        // deqp/functional/gles3/vertexarrays/multiple_attributes.output.html
        // which has 33013505 calls to reportResults.
        log((success ? "PASS" : "FAIL") + ": " + msg);
      }
      this.reportFunc(TestHarness.reportType.TEST_RESULT, url, msg, success, skipped);
      // For each result we get, reset the timeout
      this._bumpTimeout(test);
    };

    TestHarness.prototype.dequeTest = function (test) {
      this.clearTimeout(test);
      this.idleIFrames.push(test.iframe);
      delete this.runningTests[test.testFile.url];
      --this.numTestsRemaining;
    }

    TestHarness.prototype.notifyFinished = function (url) {
      url = FilterURL(url);
      var test = this.getTest(url);
      log(url + ": finished");
      this.dequeTest(test);
      this.reportFunc(TestHarness.reportType.FINISH_PAGE, url, url, true);
      this.startNextTest();
    };

    TestHarness.prototype.timeout = function (test) {
      this.dequeTest(test);
      var url = test.testFile.url;
      log(url + ": timeout");
      this.reportFunc(TestHarness.reportType.FINISH_PAGE, url, url, undefined);
      this.startNextTest();
    };

    TestHarness.prototype.setTimeoutDelay = function (x) {
      this.timeoutDelay = x;
    };

    console.log("[DEBUG] WebGLTestHarnessModule returning exports");
    return {
      'TestHarness': TestHarness,
      'getMajorVersion': getMajorVersion,
      'getURLWithOptions': getURLWithOptions,
      // Expose getFileList so external callers (like custom HTML) can
      // enumerate all tests and folders before instantiating the harness.
      'getFileList': getFileList
    };

  }();
  console.log("[DEBUG] WebGLTestHarnessModule successfully initialized", WebGLTestHarnessModule);
} catch (error) {
  console.log("[ERROR] webgl-test-harness initialization failed:", error);
  console.log("[ERROR] Stack trace:", error.stack);
}

console.log("[DEBUG] webgl-test-harness.js file loaded completely");


