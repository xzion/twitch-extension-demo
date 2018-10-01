var express = require('express');
require('express-async-errors');

var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

let mw = require('./routes/middleware');


// Set up the winston logger
let wins = require('winston');
const safeStringify = require('fast-safe-stringify');
let log_level = "debug";
if (process.env.LOG_LEVEL) log_level = process.env.LOG_LEVEL;
const customPrinter = wins.format.printf((info) => {
    if (info instanceof Error) {
        if (info.name == "StatusCodeError") {
            let level = info.level;
            delete info.level;
            return `${level}: ${info.name}: ${info.message}\n${safeStringify(info, null, '  ')}`;
            info.message = JSON.stringify(info, null, '  ');
        } else {
            if (info.stack) {
                return `${info.level}: ${info.stack}`;
            } else {
                return `${info.level}: ${info.name} - ${info.message}`;
            }
        }
    } else {
        if (typeof info.message == 'object') {
            return `${info.level}: ${safeStringify(info.message, null, '  ')}`;
        } else {
            return `${info.level}: ${info.message}`;
        }
    }
});
wins.configure({
    format: customPrinter,
    transports: [new wins.transports.Console()],
    level: log_level
});

// Terminate on unhandle Promise rejections
process.on('unhandledRejection', e => {
  wins.error("UNHANDLED PROMISE EXCEPTION");
  wins.error(e);
  process.exit(1);
});

// Routes
let index = require('./routes/index');

// Initial render of the frontend HTML
index.renderFrontend();

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Middleware for enforcing https on heroku
var enforceHttps = (req, res, next) => {
    if (req.header('x-forwarded-proto') != 'https') {
        res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    } else {
        next();
    }
};

if (process.env.NODE_ENV == 'production') {
  // Uncomment the line below to enforce HTTPS in production on Heroku
  // app.use(enforceHttps);
} else {
  app.locals.pretty = true;
  app.use((req, res, next) => {
    // In dev mode every page load will re-render the frontend
    index.renderFrontend();
    next();
  });
}

app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-twitch-jwt');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    // Note that the origin of an extension iframe will be null
    // so the Access-Control-Allow-Origin has to be wildcard.
    res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use('/', index);
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


app.use(mw.customErrorHandler);

// error handler
app.use(function(err, req, res, next) {
    wins.error("Caught error in backup error handler!");
    wins.error(err);

    // render the error page
    if (err.status == 404) {
      res.status(404).send({err: "Not Found!"});
    } else {
      res.status(500).send({err: "Server Error"});
    }
});

module.exports = app;
