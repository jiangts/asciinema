module.exports = function (req, res, next) {
  res.sseSetup = function() {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })
  }

  res.sseSend = function(data) {
    var datastr =
      (typeof data === "string") ?  data : JSON.stringify(data);
    res.write("data: " + datastr + "\n\n");
  }

  next()
}
