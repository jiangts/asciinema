// CREDITS: https://www.terlici.com/2015/12/04/realtime-node-expressjs-with-sse.html
var express = require('express')
var app = express()
var sse = require('./sse')
var bodyParser = require('body-parser')
var shortid = require('shortid')


var PORT = process.env.PORT || 3003;

// app.use(express.static('public'))
app.use(express.static(__dirname + '/player'))
app.use(sse)

// parse various different custom JSON types as JSON
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))


var sessions = {}

var makeSession = function(key) {
  return {
    waterline: 0,
    buffer: {},
    header: null,
    waitingConnections: [],
    connections: []
  }
}

const api = function(app, path, f) {
  app.get(path, function(req, res, next) {
    req.args = req.query
    return f(req, res, next);
  })
  app.post(path, function(req, res, next) {
    req.args = req.body
    return f(req, res, next);
  })
}

const pushEvent = function(req, res) {
  // console.log(req.args);
  var sessionKey = req.args.session
  if (sessionKey && sessions[sessionKey]) {
    var session = sessions[sessionKey]

    if(req.args.seqno == 1) session.waterline = 0;
    session.buffer[req.args.seqno] = req.args.event

    while(session.buffer[session.waterline+1]) {
      var ev = session.buffer[session.waterline+1]
      session.connections.map(conn => conn.sseSend(ev))
      delete session.buffer[session.waterline+1]
      session.waterline += 1
    }

    res.sendStatus(200)
  }
  else {
    res.status(400).end('missing session parameter')
  }
}

const pushHeader = function(req, res) {
  var sessionKey = req.args.session
  if (sessionKey) {
    sessions[sessionKey] = makeSession(sessionKey)
    var session = sessions[sessionKey]

    session.header = req.args.header
    while(session.waitingConnections.length > 0) {
      waitingConnections.pop().sseSend(session.header);
    }
    console.log('HEADER', session.header)
    // our header is missing `title`, `command`

    res.sendStatus(200)
  }
  else {
    res.status(400).end('missing session parameter')
  }
}

const pushMeta = function(req, res) {
  var sessionKey = req.args.session
  if (sessionKey && sessions[sessionKey]) {
    const dims = JSON.parse(req.args.event)[2]
    const width = dims[0]
    const height = dims[1]

    var session = sessions[sessionKey]
    var header = JSON.parse(session.header)

    if (header) {
      header.width = width
      header.height = height
      session.header = JSON.stringify(header)
      return pushEvent(req, res)
    }
  }
  else {
    res.status(400).end('missing session parameter')
  }

}

const requestSession = function(req, res) {
  const id = shortid.generate()
  res.json({id: id})
}

const endSession = function(req, res) {
  var sessionKey = req.args.session
  if (sessionKey) {
    delete sessions[sessionKey]
    // TODO close SSE connections?

    res.sendStatus(200)
  }
  else {
    res.status(400).end('missing session parameter')
  }
}

const getSessions = function(req, res) {
  var out = {}
  for (name in sessions) {
    out[name] = sessions[name].waterline
  }
  res.json(out)
}


// stuff the array into a dict with key event
api(app, '/push-event', pushEvent)
api(app, '/push-meta', pushMeta)
api(app, '/push-header', pushHeader)
api(app, '/request-session', requestSession)
api(app, '/end-session', endSession)
api(app, '/get-sessions', getSessions)


app.get('/stream/:id', function(req, res) {
  res.sseSetup()
  var sessionKey = req.params.id
  if (sessionKey && sessions[sessionKey]) {
    var session = sessions[sessionKey]
    var header = session.header
    session.connections.push(res)
    if (header) res.sseSend(header);
    else session.waitingConnections.push(res);

    while(Object.keys(session.buffer).length > 0) {
      var ev = session.buffer[session.waterline+1]
      session.connections.map(conn => conn.sseSend(ev))
      delete session.buffer[session.waterline+1]
      session.waterline += 1
    }
  }
})

app.listen(PORT, function() {
  console.log('Listening on port ' + PORT + '...');
})

