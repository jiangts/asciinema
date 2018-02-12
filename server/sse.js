module.exports = function (req, res, next) {
  res.sseSetup = function() {
    // https://serverfault.com/questions/801628/for-server-sent-events-sse-what-nginx-proxy-configuration-is-appropriate
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    var ping = function () { res.write(`event: ping\ndata: {"time": "${(new Date).getTime()}"}\n\n`); }
    ping()
    setInterval(ping, 10*1000)
  }

  res.sseSend = function(data) {
    var datastr =
      (typeof data === "string") ?  data : JSON.stringify(data);
    res.write("data: " + datastr + "\n\n");
  }

  next()
}
