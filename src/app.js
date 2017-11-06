const path = require('path');
const favicon = require('serve-favicon');
const compress = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');

const feathers = require('feathers');
const configuration = require('feathers-configuration');
const hooks = require('feathers-hooks');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');

const handler = require('feathers-errors/handler');
const notFound = require('feathers-errors/not-found');

const middleware = require('./middleware');
const services = require('./services');
const appHooks = require('./app.hooks');

const authentication = require('./authentication');

// feathers-blob service
const blobService = require('feathers-blob');
const multer = require('multer');
const dauria = require('dauria');
const fs = require('fs-blob-store');

const Jimp = require('jimp');

const multipartMiddleware = multer();

// Here we initialize a FileSystem storage,
// but you can use feathers-blob with any other
// storage service like AWS or Google Drive.

const blobStorage = fs(path.dirname(__dirname) + '/public/uploads');

const app = feathers();

// Load app configuration
app.configure(configuration());
// Enable CORS, security, compression, favicon and body parsing
app.use(cors());
app.use(helmet());
app.use(compress());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Set the favicon for the whole app
app.use(favicon(path.join(app.get('public'), 'images/favicon.ico')));

// Host the public folder
app.use('/', feathers.static(app.get('public')));

// Set ejs as the view engine
app.set('view engine', 'ejs');

// Host the '/article' route
// Now it sends a simple string containing "articles"
// TODO: render the article page
app.get('/article', function(req, res, next) {
    res.render('pages/article');
});

// Host the '/news' route to render the news.ejs
app.get('/news', function(req, res, next) {
    res.render('pages/news');
});

// Host the '/topic' route to render topic.ejs
app.get('/topic', function(req, res, next) {
    res.render('pages/topic');
});

// Host the "/dashboard" route which will render dashboard.ejs
app.get('/dashboard', function(req, res, next) {
    res.render('pages/dashboard');
});

// Host the "/dashboard/new" route will render new.ejs
app.get('/dashboard/new', function(req, res, next) {
    res.render('pages/new');
});

// Host the "/dashboard/edit" route which will render edit.ejs
app.get('/dashboard/edit', function(req, res, next) {
    res.render('pages/edit');
});

// Host the '/login' route which will render login.ejs
app.get('/login', function(req, res, next) {
    res.render('pages/login');
});

// Host the '/signup' route which will render signup.ejs
app.get('/signup', function(req, res, next) {
    res.render('pages/signup');
});

// Host the "/dashboard/preview" route which will render preview.ejs
app.get('/dashboard/preview', function(req, res, next) {
    res.render('pages/preview');
});

app.get('/', function(req, res, next) {
    res.render('pages/index')
})

// Set up Plugins and providers
app.configure(hooks());
app.configure(rest());
app.configure(socketio());

app.use('/uploads',
    // multer parses the file named 'uri'.	
    // Without	extra	params	the	data is	
    // temporarely kept in memory 
    multipartMiddleware.single('uri'),
    // another middleware, this time to
    // transfer the received file to feathers
    function(req, res, next) { 
        req.feathers.file = req.file;
        next();
    },
    blobService({Model: blobStorage})
);

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
app.configure(authentication);
// Set up our services (see `services/index.js`)
app.configure(services);
// Configure a middleware for 404s and the error handler
app.use(notFound());
app.use(handler());

app.hooks(appHooks);
// before-create Hook to get the file (if there is any)
// and turn it into a datauri,
// transparently getting feathers-blob to work
// with multipart file uploads
app.service('/uploads').before({
    create: [
        function(hook) {
            if (!hook.data.uri && hook.params.file) {
                const file = hook.params.file;
                //console.log(file);
                const uri = dauria.getBase64DataURI(file.buffer, file.mimetype);
                hook.data = {uri: uri};
                //console.log(uri);
            }
        }
    ]
});

app.service('/uploads').after({
    create: [
        function(hook) {
            if (hook.result.id) {
                Jimp.read('public/' + hook.path + '/' + hook.result.id).then(function (image) {
                    image.resize(292, 182)            // resize
                        .write('public/' + hook.path + '/' + hook.result.id.split('.').reduce((prev, next) => {
                             return prev + 'home' + '.' + next;
                        }));
                    image.resize(100, 66)
                    .write('public/' + hook.path + '/' + hook.result.id.split('.').reduce((prev, next) => {
                        return prev + 'topics' + '.' + next;
                    }));
                }).catch(function (err) {
                    console.error(err);
                });
            }
        }
    ]
});

module.exports = app;
