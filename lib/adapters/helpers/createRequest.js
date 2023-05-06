'use strict';

function createRequest( ) {
  if (req.aborted) return;

  // uncompress the response body transparently if required
  var responseStream = res;

  // return the last request in case of redirects
  var lastRequest = res.req || req;

  // if decompress disabled we should not decompress
  if (config.decompress !== false) {
    // if no content, but headers still say that it is encoded,
    // remove the header not confuse downstream operations
    if (data && data.length === 0 && res.headers['content-encoding']) {
      delete res.headers['content-encoding'];
    }

    switch (res.headers['content-encoding']) {
    /*eslint default-case:0*/
    case 'gzip':
    case 'compress':
    case 'deflate':
      // add the unzipper to the body stream processing pipeline
      responseStream = responseStream.pipe(zlib.createUnzip());

      // remove the content-encoding in order to not confuse downstream operations
      delete res.headers['content-encoding'];
      break;
    }
  }

  var response = {
    status: res.statusCode,
    statusText: res.statusMessage,
    headers: res.headers,
    config: config,
    request: lastRequest
  };

  if (responseType === 'stream') {
    response.data = responseStream;
    settle(resolve, reject, response);
  } else {
    var responseBuffer = [];
    var totalResponseBytes = 0;
    responseStream.on('data', function handleStreamData(chunk) {
      responseBuffer.push(chunk);
      totalResponseBytes += chunk.length;

      // make sure the content length is not over the maxContentLength if specified
      if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
        // stream.destroy() emit aborted event before calling reject() on Node.js v16
        rejected = true;
        responseStream.destroy();
        reject(new AxiosError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
          AxiosError.ERR_BAD_RESPONSE, config, lastRequest));
      }
    });

    responseStream.on('aborted', function handlerStreamAborted() {
      if (rejected) {
        return;
      }
      responseStream.destroy();
      reject(new AxiosError(
        'maxContentLength size of ' + config.maxContentLength + ' exceeded',
        AxiosError.ERR_BAD_RESPONSE,
        config,
        lastRequest
      ));
    });

    responseStream.on('error', function handleStreamError(err) {
      if (req.aborted) return;
      reject(AxiosError.from(err, null, config, lastRequest));
    });

    responseStream.on('end', function handleStreamEnd() {
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
  }
}

module.exports = createRequest;
