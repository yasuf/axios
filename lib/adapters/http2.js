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

    session.on('data', function handleStreamData(chunk) {
      responseBuffer.push(chunk);
      totalResponseBytes += chunk.length;

      // make sure the content length is not over the maxContentLength if specified
      if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
        // stream.destroy() emit aborted event before calling reject() on Node.js v16
        rejected = true;
        session.destroy();
        reject(new AxiosError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
          AxiosError.ERR_BAD_RESPONSE, config, lastRequest));
      }
    });

    session.on('aborted', function handlerStreamAborted() {
      if (rejected) {
        return;
      }
      session.destroy();
      reject(new AxiosError(
        'maxContentLength size of ' + config.maxContentLength + ' exceeded',
        AxiosError.ERR_BAD_RESPONSE,
        config,
        lastRequest
      ));
    });

    session.on('error', function handleStreamError(err) {
      if (req.aborted) return;
      reject(AxiosError.from(err, null, config, lastRequest));
    });

    session.on('response', function(headers) {
      response.headers = headers;
    });

    session.on('end', function handleStreamEnd() {
      try {
        // var responseData = responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
        // if (responseType !== 'arraybuffer') {
        //   responseData = responseData.toString(responseEncoding);
        //   if (!responseEncoding || responseEncoding === 'utf8') {
        //     responseData = utils.stripBOM(responseData);
        //   }
        // }
        // console.log('setting response data');
        response.data = { foo: 'bar' };
      } catch (err) {
        reject(AxiosError.from(err, null, config, response.request, response));
      }
      settle(resolve, reject, response);
    });

    try {
      var responseData = responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
      if (responseType !== 'arraybuffer') {
        responseData = responseData.toString(responseEncoding);
        if (!responseEncoding || responseEncoding === 'utf8') {
          responseData = utils.stripBOM(responseData);
        }
      }
      response.data = responseData;
    } catch (err) {
      reject(AxiosError.from(err, null, config, response.request, response));
    }

    settle(resolve, reject, response);
  });
};
