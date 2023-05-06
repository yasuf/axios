'use strict';

var http2 = require('http2');
var utils = require('./../utils');
// var fs = require('fs');
// var url = require('url');
var settle = require('./../core/settle');
var AxiosError = require('../core/AxiosError');
// var buildFullPath = require('../core/buildFullPath');
// var buildURL = require('./../helpers/buildURL');

/*
 * config param can take existing Axios settings plus:
 * certificatePath: relative path for the URLof the certificate to connect to the HTTP/2 server
 */
module.exports = function http2Adapter(config) {
  return new Promise(function promise(resolve, reject) {
    var fakeRequest = {
      setTimeout: function(param, callback) { callback(); },
      abort: function() {},
      description: 'This is a fake http request'
    };

    if (config.timeout) {
      var timeout = parseInt(config.timeout, 10);

      if (isNaN(timeout)) {
        reject(new AxiosError(
          'error trying to parse `config.timeout` to int',
          AxiosError.ERR_BAD_OPTION_VALUE,
          config,
          {}
        ));

        return;
      }

      fakeRequest.setTimeout(timeout, function handleRequestTimeout() {
        fakeRequest.abort();
        var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
        var transitional = config.transitional || transitionalDefaults;
        if (config.timeoutErrorMessage) {
          timeoutErrorMessage = config.timeoutErrorMessage;
        }
        reject(new AxiosError(
          timeoutErrorMessage,
          transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
          config,
          fakeRequest
        ));
      });
    }

    // var method = config.method.toUpperCase();
    // var fullPath = buildFullPath(config.baseURL, config.url);
    // var parsed = url.parse(fullPath);
    var responseType = config.responseType;
    var responseEncoding = config.responseEncoding;

    var lastRequest = fakeRequest;
    var response = {
      status: 200,
      statusText: 'all good',
      // headers: res.headers,
      config: config,
      request: lastRequest,
      data: {
        firstName: 'Fred',
        lastName: 'Flintstone',
        emailAddr: 'fred@example.com'
      }
    };

    var responseBuffer = [];
    var totalResponseBytes = 0;

    var session = http2.connect(config.url);

    session.on('stream', (stream, headers, flags) => {
      // const method = headers[':method'];
      // const path = headers[':path'];
      // ...
      stream.respond({
        ':status': 200,
        'content-type': 'text/plain; charset=utf-8',
      });
      stream.write('hello ');
      stream.end('world');
      settle(resolve, reject, response);
    });

    session.on('error', (e) => {
      console.log(e);
      reject(e);
    });
  });
};
