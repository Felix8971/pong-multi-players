
/*
 -- Choses à faire dans mongo dans avant de lancer le server nodejs ----
 
 set path = %PATH%;C:\Program Files\MongoDB\Server\3.0\bin
 
 Faire un  "mongod.exe --dbpath C:\devjs\mongodata"
 
 use blog;//va creer la base blog si elle n'existe pas 
 db;//pour verifier qu'on est bien sur la base blog
 db.articles.insert( {titre:'Premier titre', corps:'corps article 1'} );//on insert un 1er doc dans la collection articles de la base blog 
 db.articles.find({});//on verifie si le document a bien été inseré
 db.articles.insert( {titre:'Deuxieme titre', corps:'corps article 2'} ); 
 db.articles.insert( {titre:'Article de Félix the cat', corps:'miaaaou!'} ); 

 db.users.insert( {login:'Lapin', pwd:'carotte'} ); 

 
 use admin;//on passe sur la base admin
 db.createUser( {user:'root', pwd:'123456', roles:['root'] });//on creer un user administrateur
 db.auth('root','123456');//on se connecte en tans que root
 use blog;//on passe sur la base blog
 db.createUser( {user:'monServerNode', pwd:'098765', roles:[{role:'readWrite',db:'blog' }] });//on creer un user qui va servir à node js pour se connecter à mongodb
 show users;
 //on peut alors fermer la fenetre mongo, par contre il faut garder ouverte la fenetre mongodb car c'est notre serveur mongodb (il ppurrait etre situé sur une autre machine)
 
 Ne pas oublier de faire un 'npm install mongodb' à l'emplacement où se trouve le fichier LectureDasnMongoDB.js
 
 pour convertir htlm en jade :  http://html2jade.org/
 
 */
 
 //http://code4fun.fr/creer-un-site-simple-avec-node-js-express-et-jade/

"use strict";

console.log('__dirname:'+__dirname);

var port = process.env['PORT'] || 8080;
//var http = require('http');//appel de la biblio http de nodeJS
var path = require('path');

var bodyParser = require('body-parser');

// initializing express-session middleware
var Session = require('express-session');
var SessionStore = require('session-file-store')(Session);
var session = Session({store: new SessionStore({path: __dirname+'/sessions'}), secret: 'pass', resave: true, saveUninitialized: true});

// creating new express app
var express = require('express');
var app = express();

var server = require('http').Server(app);

// voir https://github.com/xpepermint/socket.io-express-session/tree/master/example
var ios = require('socket.io-express-session');

// Chargement de socket.io (connexion "temps réel" pour ouvrir un tunnel via les WebSockets grâce à socket.io)
var io = require('socket.io')(server);
io.use(ios(session)); // session support

var mongo = require('mongodb');//util pour creer les objectID mongo

var db = require('./views/js/include/db');//module à part pour gere les acces bdd
var tools = require('./views/js/include/tools');//mes petits outils

app.use(express.static('views'));//permet de servir les fichiers static qui sont dans views
app.set('view engine', 'jade');

app.set('views', __dirname + '/views'); // template engine initialization
//app.use('/static', express.static(__dirname + '/views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session);

console.log(tools.dateDuJour());
console.log("__dirname="+__dirname);

//le serveur node va etre un client de mongodb 
//var MongoClient = mongodb.MongoClient;

// Connection URL
var url = 'mongodb://localhost:27017/pong';//27017 est le port par defaut pour mongodb si on ne le precise pas, on peut passer plusieurs hotes pour acceder à des bases sur plusieures serveurs

var _message = '';

app.get('/',function (req,res) {
    req.session.uid = Date.now();
    console.log('req.session.uid='+req.session.uid);
    //console.log('req.session.login='+req.session.login);
	res.render('index', {estConnecte: req.session.estConnecte, pseudo: req.session.login, addPlayAsGuestBtn:true ,msg:_message } );//index .jade
});

app.get('/about',function (req,res) {
	res.render('about', {estConnecte: req.session.estConnecte, pseudo: req.session.login, msg:_message} );
});

app.get('/scores',function (req,res) {
    var collections = db.get().collection('scores');
    var cursor = collections.find({}).toArray(function(err, documents){
        var nbrDoc = documents.length;
        console.log('nbrDoc='+nbrDoc);
        res.render('scores', {nbrDoc:nbrDoc, scores:documents, estConnecte: req.session.estConnecte, pseudo: req.session.login } );                    
    });
});

app.get('/formulaireConnexion', function (req,res,next){
    if ( req.session.estConnecte ){   
        res.render('index', {estConnecte: req.session.estConnecte, pseudo: req.session.login, msg:'You are already connected!' });
    }else{
        res.render('formulaireConnexion', { estConnecte: req.session.estConnecte});
    }
});

app.get('/formulaireSignIn', function (req,res,next){
	res.render('formulaireSignIn', { estConnecte: req.session.estConnecte});
});

app.get('/inscriptionOK', function (req,res,next){
	res.render('inscriptionOK'); 
});


app.post('/signIn',function(req, res){ 
	console.log('sigIn');
	if (!req.body) { 
		console.log("probleme au post");
		return res.sendStatus(400);
	}else{
        console.log('req.body.login:'+req.body.login);
        var collections = db.get().collection('users');
        var msg, search = /^[a-zA-Z0-9]+$/gi;
        
        var validator = tools.validerIdentifiants(req.body.login, req.body.pwd);
        
        if ( !validator.valid ){
            res.render('formulaireSignIn', { estConnecte: false, msg:validator.msg});    
        }else{   
            //on verifie que le login req.body.login est dispo
            var cursor = collections.find({login:req.body.login}).toArray(function(err, documents){
                var nbrDoc = documents.length; console.log('nbrDoc='+nbrDoc); 
                if ( documents.length > 0 ){
                    msg =  'Another account already uses the pseudo you entered. Please choose a different one, be original !';
                    res.render('formulaireSignIn', { estConnecte: false, msg: msg });
                }else{
                     console.log('login:'+req.body.login);
                     console.log('pwdverif:'+req.body.pwdverif);
                     console.log('pwd:'+req.body.pwd);
                    if ( req.body.pwdverif != req.body.pwd ){
                       msg = 'Password and confirmation password not equal after submit !';
                       res.render('formulaireSignIn', { estConnecte: false, msg:msg});
                    }else{ 
                        var document = {login: req.body.login, pwd: req.body.pwd, date:tools.dateDuJour()};
                        console.log('document='+document);
                        collections.insertOne(document, function(err, documents){
                            if ( err ){
                                res.render('erreurConnexion', {});
                            }else{
                                //req.session.estConnecte = true;
                                //req.session.login = req.body.login;
                                console.log("Inserted 1 documents into the users collection.");
                                //msg = 'Vous pouvez à present vous connecter avec vos identifiants';
                                res.render('inscriptionOK');
                            }
                        });
                    }
                }         
            });  
        }
	}
});

//Au post du formulaire de connexion ( formulaireConnexion.jade action='connexion' )
app.post('/connexion',function(req, res){ 
	 if (!req.body) { 
		console.log("probleme au post");
		return res.sendStatus(400);
	 }else{
        //req.session.test = 12;
        //console.log( db);
		var collections = db.get().collection('users');
        var query = {login: req.body.login , pwd : req.body.pwd};
        var cursor = collections.find(query).toArray(function(err, documents){
            if ( documents.length === 1){
                //bon login / mot de passe
                req.session.estConnecte = true;
                req.session.login = req.body.login;
                var msg = 'Welcome ' +req.body.login  + '! You are connected.'
                //socket.handshake.session.login = req.body.login;
                res.render('index', {estConnecte: req.session.estConnecte, pseudo: req.session.login, msg:msg } );                    
            }else{
              var msg = 'That account doesn\'t exist. If you\'ve forgotten your username or password create a new account !';
              res.render('formulaireConnexion', { estConnecte: req.session.estConnecte, msg:msg});
            }
        });
	 }
});	

app.get('/deconnexion', function (req,res,next) {
    
   io.sockets.emit('updatePublicChat', 'SERVER', req.session.login + ' has disconnected');  
   delete users[req.session.login];
   io.sockets.emit('updatePublicUsers', users);
   io.sockets.emit('deconnexion', req.session.login);       
   req.session.estConnecte = false;    
   req.session.login = '';
   res.redirect('/'); 
});

app.get('/404', function (req,res,next) {
  next();// L'appel à next() indique qu'on souhaite continuer la chaîne des middlewares
  // Si on interrompt ici cette chaîne, sans avoir renvoyé de réponse au client, il n'y aura
  // pas d'autres traitements, et le client verra simplement une page mouliner dans le vide...
});

//Gestion des erreurs 
//Dans le code suivant, situé après toutes les autres routes, nous créons une erreur dans le 
//cas d'une url non présente puis nous ajoutons l'en-tête 404 avant de faire le rendu de la page 404 créée par ailleurs.
app.use(function (req,res, next) {
	res.status(404);

	//réponse avec une page html
	if (req.accepts('html')){
		res.render('404',{title : 'Cette page n\'existe pas', titreH1: 'Page inconnue'});
		return;
	}

	//réponse avec du json
	if (req.accepts('json')){
		res.send({error: 'Fichier absent'});
		return;
	} 
	
	//réponse avec du js
	if (req.accepts('js')){
		res.send({error: 'Fichier absent'});
		return;
	} 
	//réponse avec un fichier texte
	res.type('txt').send('Pas de réponse');
     
});

db.connect(url, function(err){
    if (err) {
        console.log('Impossible de se connecter à la base de données.');
        process.exit(1);
    }
    server.listen(port, function(){
        var addressHost = server.address().address;
        var portListen = server.address().port;
        console.log('L\'application est disponible à l\'adresse http://%s:%s', addressHost, portListen);
    });
})


//socket.emit(type de l'évenement, data1, data2) : envoie juste au client connecté un événement (une chaine) et deux paramètres pouvant contenir des données
//io.sockets.emit(type de l'évenement, data1, data2) : envoie à tous les clients connectés un événement (une chaine) et deux paramètres pouvant contenir des données
//socket.broadcast.emit(type de l'évenement, data1, data2) : envoie à tous les clients connectés sauf au client courant (l'emetteur) un événement (une chaine) et deux paramètres 


// Initialisation variables du jeu
var TO_RADIANS = Math.PI/180; 
var vMin = 5;
var CANVAS_WIDTH = 600;
var CANVAS_HEIGHT = 439;//400;
var SCORE_MAX = 10;//12;
var EPSILON = 0.005;//0.002;


var getRandomArbitrary = function(min, max) {
	return Math.random() * (max - min) + min;
};
 
var getRandomInt = function(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

var valueInRange = function(value, min, max) {
  return (value < max) && (value > min);
};
 
 var checkPointInRect = function(Pt, boite ){
   var overlap = valueInRange(Pt.x, boite.x, boite.x + boite.w) && valueInRange(Pt.y, boite.y, boite.y + boite.h);
   return overlap;
};
 
var checkRectCollision = function(A, B) {
	//console.log('balle.x: '+A.x + ' balle.y: '+A.y + ' paddles[0].x: '  + B.x + ' paddles[0].y: ' + B.y );
	//console.log('A.h: '+A.h + ' A.w: '+A.w + ' B.h: '  + B.h + ' B.w:' + B.w );
	var xOverlap = valueInRange(A.x, B.x, B.x + B.w) || valueInRange(B.x, A.x, A.x + A.w);
	var yOverlap = valueInRange(A.y, B.y, B.y + B.h) || valueInRange(B.y, A.y, A.y + A.h); 
	//console.log('xOverlap:'+xOverlap + ' yOverlap:' + yOverlap)
	return xOverlap && yOverlap;
};


var Point = function(x,y){
	this.x = (typeof x === 'undefined') ? 0 : x;//if (typeof x === 'undefined'){ this.x = 0; }else{ this.x = x; }
	this.y = (typeof y === 'undefined') ? 0 : y;
};

var distance = function(A,B){
	var dx = (A.x-B.x);
	var dy = (A.y-B.y);
	return Math.sqrt( dx*dx + dy*dy );
};

var norme = function(vecteur){
	return ( Math.sqrt(vecteur.dx * vecteur.dx + vecteur.dy * vecteur.dy) );
}
//objet contenant la liste des utilisateurs presents sur le site
var users = {};
//on affichera le serveur dans la liste des user connectés 
users['LeServer'] = { pseudo:'LeServer', sid:'', dispo:true, avatar:'cpu.png', speech:'Je suis le server, c\'est moi le boss ici !' };

var NBR_ROOM = 3;//à changer suivant capacité du server 
// NBR_ROOM rooms disponibles = nbr de parties possibles en parrallele (2 joueurs max par room)  

var rooms = [];

//On remplit le tableau de room
for (var i=0;i<NBR_ROOM;i++){ 
	rooms.push({ 
		nbUsersPresents: 0, 
		users:{}, 
		nbClicPlay:0, 
		numerateur:0,
		jeuEnCours: false, 
        gameTime:0,
        winner:0,
		//Contient les positions des 2 joueurs: //paddles[0] = joueur de gauche et paddles[1] = joueur de droite
		paddles : [
			{x:0, y:0, x_before:0, y_before:0,  h:CANVAS_HEIGHT/8, w: CANVAS_HEIGHT/25, score:0, pseudo:'' },//joueur de gauche
			{x:0, y:0, x_before:0, y_before:0, h:CANVAS_HEIGHT/8, w: CANVAS_HEIGHT/25, score:0, pseudo:'' }//joueur de droite
		],
        serverWin:true //variable utilsée lorsque l'on joue contre le serveur pour decider si le serveur doit gagner un coup ou pas
	});
}

//vide la room d'indice i
var videRoom = function(i){
    console.log('--- videRoom ---');

    rooms[i].nbUsersPresents = 0;
    rooms[i].jeuEnCours = false;
    rooms[i].users = {};
	
	rooms[i].nbClicPlay = 0;
	rooms[i].numerateur = 0;//sert à produire un accroissement lineaire de la vitesse de la balle au cours du temps
	rooms[i].jeuEnCours = false;
	rooms[i].paddles[0] = {x:0, y:0, x_before:0, y_before:0,  h:CANVAS_HEIGHT/8, w: CANVAS_HEIGHT/25, score:0, pseudo:'' }
	rooms[i].paddles[1] = {x:0, y:0, x_before:0, y_before:0,  h:CANVAS_HEIGHT/8, w: CANVAS_HEIGHT/25, score:0, pseudo:'' }
}

var etatGame = [];//va contenir les info geometriqes des differentes parties en cours

for (var i=0;i<NBR_ROOM;i++){ 
	etatGame.push({
		balle:{
			x: CANVAS_WIDTH/2 - (CANVAS_HEIGHT/20)/2,
			y: CANVAS_HEIGHT/2 - (CANVAS_HEIGHT/20)/2,
			h: CANVAS_HEIGHT/20,
			w: CANVAS_HEIGHT/20,
			dx:1,
			dy:1
		}
	});
}

//On envoie aux clients des info sur les parties en cours et les users connectés
setInterval(function(){
    io.sockets.emit('ongoingGames', rooms);
    io.sockets.emit('updatePublicUsers', users);
},2000);

//Enregistre le score en base (dans la collection scores) quand un jouer gagne une partie
var majScoreMongo = function(i){//on passe i pour acceder à rooms[i]
    
    console.log('majScoreMongo'); 
    if ( typeof rooms[i] != 'undefined' ){
        console.log('rooms[i].paddles[0].pseudo:'+rooms[i].paddles[0].pseudo);
        console.log('rooms[i].paddles[1].pseudo:'+rooms[i].paddles[1].pseudo);    
        if ( (rooms[i].paddles[0].pseudo).length > 0 && (rooms[i].paddles[1].pseudo).length > 0 ){
            var collections = db.get().collection('scores');
            var data = {
                player0:rooms[i].paddles[0].pseudo,
                score0:rooms[i].paddles[0].score,
                player1:rooms[i].paddles[1].pseudo,
                score1:rooms[i].paddles[1].score,
                gameTime:rooms[i].gameTime,
                winner:rooms[i].winner,
                date:tools.dateDuJour().date,
                time:tools.dateDuJour().time
            };
            console.log('data='+data);
            collections.insertOne(data, function(err, documents){
                if ( err ){
                    res.render('erreurConnexion', {});
                }else{
                   console.log("Inserted 1 documents into the scores collection.");
                }
            }); 
        }
    }
}

//Car Math.sign n'existe que sous firefox
var sign = function(x) {
	if ( x >= 0 ){ return 1; }else{ return -1;}
};

//Fourni l'objet {dx:x, dy:y} qui permet de faire partir la balle avec un angle 
//aléatoire par rapport à la verticale (compris entre -45 et +45)
var departAleatoire = function(v){
	var randomSign = 2*getRandomInt(0,1) - 1;//vaudra 1 ou -1 
	var dx = randomSign*getRandomArbitrary(v/2, v);
	randomSign = 2*getRandomInt(0,1) - 1;
	var dy = randomSign*Math.sqrt( v*v - dx*dx );
	return {dx:dx, dy:dy};
};

//Remet le jeu i dans son etat initial  
var reInitGame = function(i){
	//Determine un vecteur vitesse aleatoire
	etatGame[i].compteur = 0;
	var U = departAleatoire(vMin); 
	etatGame[i].balle.dx = U.dx;
	etatGame[i].balle.dy = U.dy;
	//Balle au centre
	etatGame[i].balle.x = CANVAS_WIDTH/2 - (etatGame[i].balle.w)/2;
	etatGame[i].balle.y = CANVAS_HEIGHT/2 - (etatGame[i].balle.h)/2;
	//numerateur sert à produire un accroissement lineaire de la vitesse de la balle
	rooms[i].numerateur = vMin;
    etatGame[i].nbrPaddleBounce = 0;
}

//Trouve une room vide dispo
var findRoom = function(){
	var roomId = -1;
    /*
	//On cherche d'abord une room avec un joueur en attente
    for (var i=0;i<rooms.length;i++){
		if ( rooms[i].nbUsersPresents === 1 ){
			idRoom = i;
			break;
		}
	}*/
	//On cherche une room vide. 
	if ( roomId < 0){
		for (var i=0;i<rooms.length;i++){
			if ( rooms[i].nbUsersPresents === 0 && !rooms[i].jeuEnCours){
				roomId = i;
				break;
			}
		}	
	}
    if ( roomId >= NBR_ROOM ){
        roomId = -1;
    }
	console.log('findRoom='+roomId);
	return roomId; 
}

//Renvoi 1 si on lui fournie 0 et 0 si on lui fournie 1
//Permet donc de determiner dans tous les cas l'indice de l'advesraise (il y a un joueur 0 et un joueur 1)
var opponentOf = function(k){
    return Math.abs(k-1);
}

//Déclanche une serie d'actions lorsqu'un joueur gagne une partie (utilisée dans animation() )
var victory = function(i,j){
    console.log('victoire de '+rooms[i].paddles[j].pseudo+ + ' dans room ' + i );
    rooms[i].winner = rooms[i].paddles[j].pseudo;
    rooms[i].paddles[j].score = SCORE_MAX;
    //var debutPartie = rooms[i].gameTime;
    //console.log('rooms[i].gameTime ini='+rooms[i].gameTime);
    var now = (new Date()).getTime();
    //console.log('now='+now);
    var brut = (now - rooms[i].gameTime)/(1000*60);//durée partie minutes
    var min = parseInt(brut);
    rooms[i].gameTime = min + ' min ' +  parseInt((brut-min)*60) + ' s';
    //console.log('delta='+rooms[i].gameTime);
    //On enregistre les scores en base 
    majScoreMongo(i);
    //Mise à jours des scores chez les clients et fermeture de partie.  
    io.in(i).emit('updateScoreRight',rooms[i].paddles[opponentOf(j)].score);
    io.in(i).emit('winner', j);//joueur j gagne
    io.in(i).emit('fermerPartie');//va faire un socket.leave pour les 2 joueurs
    videRoom(i);    
}


var recallDelay = 20;//20 (en ms)

var step = 2;

var animation = function(i){
	var startTime = (new Date()).getTime();
	
	if ( !rooms[i].jeuEnCours ){ return 0; }
		
    etatGame[i].compteur++;
     
    if ( etatGame[i].compteur > 50 ){//Retarde le depart de la balle
        if ( etatGame[i].compteur === 51 ){ io.in(i).emit('bruitage', {son:'newBall', volume:1, room:i} ); }  
        etatGame[i].balle.x += etatGame[i].balle.dx;
        etatGame[i].balle.y += etatGame[i].balle.dy;
        
        //Augmentation lineaire de la vitesse de la balle (à chaque pas on ajoute un epsilon à la vitesse)
        rooms[i].numerateur = rooms[i].numerateur + EPSILON;
        var kn = rooms[i].numerateur /(rooms[i].numerateur - EPSILON);
        etatGame[i].balle.dx = kn*etatGame[i].balle.dx;
        etatGame[i].balle.dy = kn*etatGame[i].balle.dy;
        
        //Rebond balle sur les bords haut et bas du terrain
        if ( etatGame[i].balle.y < 0 ){
            etatGame[i].balle.dy = -etatGame[i].balle.dy;
            etatGame[i].balle.y = 0;//evite l'effet d'oscillation sur le bord haut
            io.in(i).emit('bruitage', {son:'bounceWall', volume:1, room:i});
        } else if ( etatGame[i].balle.y > CANVAS_HEIGHT - 16 ){
            etatGame[i].balle.dy = -etatGame[i].balle.dy;
            etatGame[i].balle.y = CANVAS_HEIGHT - 16;//evite l'effet d'oscillation sur le bord bas
            io.in(i).emit('bruitage', {son:'bounceWall', volume:1, room:i});
            //playBruitage('bounceWall');
        }            
        //console.log('balle.x: '+etatGame[i].balle.x + ' balle.y: '+etatGame[i].balle.y + ' paddles[0].x: '  + paddles[0].x + ' paddles[0].y: '  + paddles[0].y) ;
        
        //Rebond balle sur le paddle de droite
        if ( etatGame[i].balle.x > CANVAS_WIDTH/2 ){
            if ( checkRectCollision(etatGame[i].balle, rooms[i].paddles[1]) ){
                etatGame[i].nbrPaddleBounce++;
                //etatGame[i].balle.x -= etatGame[i].balle.dx;
                //etatGame[i].balle.y -= etatGame[i].balle.dy;
                var centrePaddle = rooms[i].paddles[1].y + rooms[i].paddles[1].h/2;
                var centreBalle = etatGame[i].balle.y + etatGame[i].balle.h/2;
                var delta = centrePaddle - centreBalle;
                var s = sign(delta);  // si s > 0 alors la balle a frappé le bord superieur du paddle, si s < 0 c'est bord inferieur
                var distBalleBordPaddle = rooms[i].paddles[1].h/2 - Math.abs(delta);
                //console.log('distBalleBordPaddle droite='+distBalleBordPaddle);
                
                //Si la balle s'approche trop du bord du paddle on fait un rebond aleatoire
                if ( distBalleBordPaddle < rooms[i].paddles[1].h/6 ){//rebond aleatoire
                    var U = departAleatoire(norme(etatGame[i].balle)); 
                    etatGame[i].balle.dx = -Math.abs(U.dx);//j'oblige la balle à aller à gauche
                    etatGame[i].balle.dy = -s*Math.abs(U.dy);
                    //console.log('dx:' + etatGame[i].balle.dx + ' dy:' + etatGame[i].balle.dy);
                }else{//Rebond normal
                    //if ( etatGame[i].balle.dx > 0 ){
                        etatGame[i].balle.dx = -etatGame[i].balle.dx;
                    //}
                }
                //Faire rebond different suivant mvt du paddle ?
                io.in(i).emit('bruitage', {son:'bouncePaddle', volume:0.3, room:i} );
                
            }
        } 
        
        //Rebond balle sur le paddle de gauche
        if ( (etatGame[i].balle.x < CANVAS_WIDTH/2 ) ){ 
            if  ( checkRectCollision(etatGame[i].balle, rooms[i].paddles[0]) ){
                //etatGame[i].balle.x -= etatGame[i].balle.dx;
                //etatGame[i].balle.y -= etatGame[i].balle.dy;                
                var centrePaddle = rooms[i].paddles[0].y + rooms[i].paddles[0].h/2;
                var centreBalle = etatGame[i].balle.y + etatGame[i].balle.h/2;
                var delta = centrePaddle - centreBalle;
                var s = sign(delta);  // si s > 0 alors la balle a frappé le bord superieur du paddle, si s < 0 c'est bord inferieur
                var distBalleBordPaddle = rooms[i].paddles[0].h/2 - Math.abs(delta);                    
                //console.log('distBalleBordPaddle gauche='+distBalleBordPaddle);
                
                //Si la balle s'approche trop du bord du paddle on fait un rebond aleatoire
                if ( distBalleBordPaddle < rooms[i].paddles[0].h/6 ){//rebond aleatoire
                    var U = departAleatoire(norme(etatGame[i].balle)); 
                    etatGame[i].balle.dx = Math.abs(U.dx);//j'oblige la balle à aller à droite
                    etatGame[i].balle.dy = -s*Math.abs(U.dy);
                }else{//Rebond normal                    
                    //if ( etatGame[i].balle.dx < 0 ){
                        etatGame[i].balle.dx = -etatGame[i].balle.dx;
                    //}
                }
                //playBruitage('bouncePaddle', 0.3);
                io.in(i).emit('bruitage', {son:'bouncePaddle', volume:0.3, room:i} );
            }
            
          
        }

        //Ajout du code pour faire bouger automatiquement le paddle si c'est le serveur qui joue
        if ( rooms[i].paddles[0].pseudo === 'LeServer'  ){
            
            if ( rooms[i].serverWin && etatGame[i].balle.x < CANVAS_WIDTH/2 && etatGame[i].balle.dx < 0 ){
                //Le serveur suit la balle    
                rooms[i].paddles[0].y = etatGame[i].balle.y - rooms[i].paddles[0].h/2;                
                rooms[i].paddles[0].x = 0;
            }else{
                //Le serveur revient vers le centre du terrain en ignorant la balle
                /*var dist2Middle = rooms[i].paddles[0].y - CANVAS_HEIGHT/2;
                if ( Math.abs(dist2Middle) > rooms[i].paddles[0].h/10 ){
                    if ( dist2Middle > 0 ){
                        rooms[i].paddles[0].y -= 2;
                    }else{
                        rooms[i].paddles[0].y += 2;
                    }    
                }*/
                //Le serveur fait des va-et-vient de haut en bas en ignorant la balle
                rooms[i].paddles[0].y += step;
                if ( rooms[i].paddles[0].y > CANVAS_HEIGHT - 1.5*rooms[i].paddles[0].h ){
                    step = -2; 
                } else if ( rooms[i].paddles[0].y < 0.5*rooms[i].paddles[0].h ){
                    step = +2; 
                }
                
            }
            
            //Si le joueur à reussit a renvoyer 10 fois de sutie la balle sans la perdre alors 
            //je re-defini aleatoirement le comportement du serveur (suivre la balle ou faire des va-et-vient idiots)   
            //un joueur qui renvoit la balle souvent doit donc, en theorie, pouvoir battre le serveur !            
            if ( etatGame[i].nbrPaddleBounce === 10 ){
                if ( getRandomInt(1,3) === 1 ){ 
                    console.log('re-definition, bounce:'+etatGame[i].nbrPaddleBounce);
                    rooms[i].serverWin = false; 
                    etatGame[i].nbrPaddleBounce = 0;
                 }else{
                    rooms[i].serverWin = true;
                 }   
            }
            //J'envois au user qui joue contre le serveur la position du serveur 
            io.in(i).emit('updateMouse',{x:0, y:rooms[i].paddles[0].y, side:0}, i);
        }
        
        
        //Balle perdue à gauche 
        if ( etatGame[i].balle.x < -etatGame[i].balle.w ){
            //etatGame[i].balle.dx = -etatGame[i].balle.dx;
            //On ajoute 1 point au joueur de droite
            rooms[i].paddles[1].score++;
            io.in(i).emit('updateScoreRight', rooms[i].paddles[1].score);
            if ( rooms[i].paddles[1].score >= SCORE_MAX){
                setTimeout(function(){victory(i,1);}, 200);//victoire du joueur 1 dans la room i
            }
            reInitGame(i);
            //Je determine aleatoirement si le serveur va gagner au prochain coup  
            if ( getRandomInt(1,2) === 1 ){ rooms[i].serverWin = false; }else{ rooms[i].serverWin = true; }
        }
        
        //Balle perdue à droite
        if ( etatGame[i].balle.x > CANVAS_WIDTH ){ 
            //etatGame[i].balle.dx = -etatGame[i].balle.dx;
            //On ajoute 1 point au joueur de gauche
            rooms[i].paddles[0].score++;
            io.in(i).emit('updateScoreLeft',rooms[i].paddles[0].score);
            if ( rooms[i].paddles[0].score >= SCORE_MAX){
               setTimeout(function(){victory(i,0);}, 200);//victoire du joueur 0 dans la room i
            }
            reInitGame(i);
            //Je determine aleatoirement si le serveur va gagner au prochain coup  
            if ( getRandomInt(1,2) === 1 ){ rooms[i].serverWin = false; }else{ rooms[i].serverWin = true; } 
        }
        
    }
    
	//On mesure le temps ecoulé pour effectuer un passage dans la boucle 
	var delais = (new Date()).getTime() - startTime;
	//io.sockets.emit('updateGame', etatGame[i]);
	if ( delais >= recallDelay ){//on rappelle la MAJ sur le champ
		io.in(i).emit('updateGame', {x:etatGame[i].balle.x,y:etatGame[i].balle.y});
		animation(i);
		console.log("delais >= "+ recallDelay +"! delais=" + delais)
	}else{// sinon on rappelle la MAJ un peu plus tard en essayant de conserver un ecart de 20 ms entre chaque appel
		io.in(i).emit('updateGame', {x:etatGame[i].balle.x,y:etatGame[i].balle.y});
		setTimeout(function(){
			animation(i);
		}, recallDelay - delais);
	}	
    
};

//On lance une boucle sans fin sur chacune des NBR_ROOM rooms afin de mettre à jour l'etat du jeu  
/*for (var i=0;i<NBR_ROOM;i++){
    (function(x){//on utilise une closure pour que la fonction s'execute vraiment avec les différentes valeurs de i 
        console.log('Lance animation('+ x +')');
        animation(x);
    })(i);
}*/

//Listen to socket connections and get the socket as provided by socket.io, together with either the session or an error
//on se prépare à recevoir des requêtes du client via socket.io.  
io.on('connection', function (socket){
    
    //socket.emit('session', "Session id: " + socket.handshake.session.uid); 
    console.log('socket.handshake.session.uid='+ socket.handshake.session.uid);
    //console.log('socket.handshake.session.test='+ socket.handshake.session.test);
    console.log('Un visiteur est arrivé sur le site !' + '( socket.id='+ socket.id + ')');// Quand un client se connecte, on le note dans la console
    socket.emit('updatePublicUsers', users);
    
    
    /*socket.on('my other event', function (my) {
         console.log('my:'+my);
    });*/
    /* ---------------- PARTIE PUBLIC CHAT  --------------------------*/ 
    
    //connection au jeu en tant que guest
    /*socket.on('addUser', function (pseudo, speech) {
        console.log('pseudo:' + pseudo + ' speech:'+speech);
        var pseudoDispo = true;
        
        //On regarde si le pseudo n'est pas deja pris par une personne presente sur le site 
        for ( var i in users) {
            console.log('pseudo='+users[i].pseudo);
            if ( users[i].pseudo === pseudo ){ pseudoDispo = false; }
        }
        
        //On verifie aussi que le pseudo n'est pas deja pris par un membre inscrit en base
        if ( pseudoDispo ){
            var collections = db.get().collection('users');
            var cursor = collections.find({login:pseudo}).toArray(function(err, documents){
                var nbrDoc = documents.length;
                console.log('nbrDoc='+nbrDoc); 
                if ( nbrDoc === 0 ){        
                    socket.emit('pseudoDispo');
                    console.log('pseudo Dispo');
                    socket.pseudo = pseudo;
                    users[pseudo] = { pseudo:pseudo, sid:socket.id, dispo:true, avatar:'defaultAvatar.png', speech:speech };
                    socket.broadcast.emit('updatePublicChat', 'SERVER', socket.pseudo + ' has connected');
                    // update the list of users in chat, client-side  
                    io.sockets.emit('updatePublicUsers', users);//envoie à tous les clients connectés
                }else{
                    console.log('pseudo Non Dispo');
                    socket.emit('pseudoNonDispo');
                }
            });
        }else{
            console.log('pseudo Non Dispo');
            socket.emit('pseudoNonDispo');
        }
    });*/
 
    //connection au jeu en tant que membre connecté, voir ligne 30 dans Navigation.jade !!
    socket.on('addUserMembre', function (pseudo, speech) {
        
        console.log(":::socket.handshake session login:", socket.handshake.session.login);
        //console.log("socket.handshake session uid:", socket.handshake.session.uid);
        console.log(' addUserMembre from :' +pseudo + ' sid:'+ socket.id);
        //On verifie en session que l'utilisateur qui essaye de se connecter en tant que 'pseudo' est bien 'pseudo'
        //Si oui alors on le fait entrer dans la liste des joueurs.          
        console.log('socket.handshake.session.login:' +socket.handshake.session.login);
        if ( socket.handshake.session.login === pseudo){
            
            console.log('pseudo::' + pseudo + ' speech::'+speech);
            socket.pseudo = pseudo;
            //On verifi que le user n'est pas deja present dans le tableau users car il pourrait rafraichir sa page
            //ou chnager de page ce qui provoquerait un nouveau socket.emit('addUserMembre', '#{pseudo}', 'xxx') coté client       
            if ( typeof users[pseudo] === 'undefined' ){
                users[pseudo] = { pseudo:pseudo, sid:socket.id, dispo:true, avatar:'defaultAvatar.png', speech:speech };
                socket.broadcast.emit('updatePublicChat', 'SERVER', socket.pseudo + ' has connected');
                // update the list of users in chat, client-side  
                io.sockets.emit('updatePublicUsers', users);//envoie à tous les clients connectés  
            }
         }else{
             console.log('action non autorisée !');
         }    
    });
 
    socket.on('comeBackAfterAGame', function (pseudo) {
        if ( typeof pseudo != 'undefined' ){
            console.log('comeBackAfterAGame: retour de ' + pseudo);
            socket.pseudo = pseudo;
            users[pseudo].dispo = true;
            socket.broadcast.emit('updatePublicChat', 'SERVER', socket.pseudo + ' is back');
            // update the list of users in chat, client-side  
            io.sockets.emit('updatePublicUsers', users);//envoie à tous les clients connectés 
        }   
    });   
    
    socket.on('indispo', function (pseudo) {
        if ( typeof pseudo != 'undefined' ){
            users[pseudo].dispo = false;
            socket.broadcast.emit('updatePublicChat', 'SERVER', pseudo + ' is playing...');
            io.sockets.emit('updatePublicUsers', users);
        }
    });
    
    socket.on('sendPublicMsg', function (message) {
        console.log(socket.pseudo + ' parle au serveur ! Il dit : ' + message);
        console.log("socket.handshake session login:", socket.handshake.session.login);
        console.log("socket.handshake session uid:", socket.handshake.session.uid);
        io.sockets.emit('updatePublicChat', socket.pseudo, message);
    });

    socket.on('deconnexion', function(){ 
        console.log('deconnexion: socket.room='+socket.room)
        deconnexion(socket.pseudo, socket.room);
        /*console.log('deconnexion');
        delete users[socket.pseudo];
        socket.emit('deconnexion');
        io.sockets.emit('updatePublicChat', 'SERVER', socket.pseudo + ' has disconnected');  
        io.sockets.emit('updatePublicUsers', users);
        io.sockets.emit('deconnexion', socket.pseudo);*/
    });
    
    
    
    var deconnexion = function(pseudo, room){
        if ( pseudo /*&& socket.room && rooms[socket.room].jeuEnCours*/  ){
            majScoreMongo(room);//ne fait pas de maj si room n'est pas definie   
            console.log('Disconnect:'+pseudo + ' room='+room );// + ' ( socket.id='+ socket.id + ')' );
            delete users[pseudo];
            //io.sockets.emit('updatePublicChat', 'SERVER', pseudo + ' has disconnected');//à envoyer que si le user ne ping plus 
            io.sockets.emit('updatePublicUsers', users);
            io.sockets.emit('deconnexion', pseudo);
            //si l'utilisateur est en train de jouer  
            if ( room >= 0 ){
                io.in(room).emit('updatechat', 'SERVER', pseudo + ' has disconnected');
                //Si un client se deconnecte l'autre gagne
                if ( rooms[room].jeuEnCours ){
                    if ( pseudo === rooms[room].paddles[0].pseudo ){
                        console.log('lance winner 1');
                        io.in(room).emit('winner', 1);
                        rooms[room].paddles[1].score = SCORE_MAX;
                    }else{
                        console.log('lance winner 0')
                        io.in(room).emit('winner', 0);
                        rooms[room].paddles[0].score = SCORE_MAX;
                    }
                    
                    io.in(room).emit('fermerPartie');//va engendrer un socket.leave pour les 2 joueurs
                    videRoom(room);
                    reInitGame(room);
                    console.log(pseudo + ' a quitté la room ' + room);
                }
            }
        }        
    }
    
    //si un utilisateur se deconnecte     
    socket.on('disconnect', function(){ //à declencher aussi si le client n'est plus actif (ou ne clique pas sur play en moins de 30 secondes)  
        deconnexion(socket.pseudo, socket.room);
    });
    /* ---------------- PARTIE PRIVATE CHAT  --------------------------*/ 
    
    //Envois messages vers la room du chat privé
    socket.on('sendPrivateMsg', function (message) {
        console.log(socket.pseudo + ' parle au serveur ! Il dit : ' + message);
        io.in(socket.room).emit('updatePrivateChat', socket.pseudo, message);
    });
        
    /* --------------------- PARTIE JEU PONG --------------------------*/ 	

    socket.on('defier', function (defiant, defie) {
        //console.log(socket.pseudo + ' parle au serveur ! Il dit : ' + message);
        io.sockets.emit('updatePublicChat', 'SERVER', defiant + ' à defié ' + defie);//envoie à tous les clients connectés sauf au client courant (l'emetteur)
        if ( defie === 'LeServer' ){
           console.log("defie = LeServer"); 
           
           io.sockets.emit('updatePublicChat', 'SERVER', defie + ' à accepté le défi de ' + defiant);//envoie à tous les clients connectés sauf au client courant (l'emetteur)
           io.sockets.emit('defiAccept', defiant, defie);
           //On va attribuer un room à nos deux joueurs
           var idRoom = findRoom();
           //Si aucune room n'est dispo on annule tout. 
           console.log('idRoom='+idRoom);
           if ( idRoom < 0){
                socket.emit('pasDeRoomDispo',defiant, defie);
           }else{ 
                rooms[idRoom].jeuEnCours = true;
                console.log('roomDispo');    
                var data = {defiant:defiant, defie:defie, idRoom:idRoom};
                //Envoyer un message à tous le monde pour enlever defiant et defie de la liste des challenge
                io.sockets.emit('removeFromChallengeList',data);
                //Indique à defiant et defie que leur partie va commencer
                io.sockets.emit('roomDispo', data);
               
                //socket.room = data.idRoom;  
                //socket.join(socket.room);  
                users['LeServer'].dispo = false;// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                rooms[idRoom].nbUsersPresents++;
                console.log('LeServer' + ' a rejoint la room ' + idRoom)
                //Add the client's username to the room's list 
                rooms[idRoom].users['LeServer'] = 'LeServer';
                //Tell all those in the room that a new user joined
                io.in(idRoom).emit('updatePrivateChat', 'SERVER', 'LeServer' + ' has connected');
                //io.in(socket.room).emit('readyToStartGame');
                socket.emit('readyToStartGame');
                
                //on fait comme si le server avait cliqué sur play en executant le code associé à l'event ClicPlay 
                rooms[idRoom].nbClicPlay++;
                console.log( 'LeServer' + ' de la room '+ idRoom  + ' a cliqué sur PLAY');
                console.log('nbClicPlay room ' + idRoom + '=' + rooms[idRoom].nbClicPlay);                
                console.log( 'LeServer' + ' joue à gauche');
                rooms[idRoom].paddles[0].pseudo = 'LeServer';
                users['LeServer'].dispo = false;
           }            
        }else{
           io.sockets.emit('defis', defiant, defie);
        }
    });
    
    socket.on('defiDecline', function (defiant, defie) {
        //console.log(socket.pseudo + ' parle au serveur ! Il dit : ' + message);
        io.sockets.emit('updatePublicChat', 'SERVER', defie + ' à refusé le défi de ' + defiant);//envoie à tous les clients connectés sauf au client courant (l'emetteur)
        io.sockets.emit('defiDecline', defiant, defie);
    });	
    
    socket.on('defiAccept', function (defiant, defie) {
        //console.log(socket.pseudo + ' parle au serveur ! Il dit : ' + message);
        io.sockets.emit('updatePublicChat', 'SERVER', defie + ' à accepté le défi de ' + defiant);//envoie à tous les clients connectés sauf au client courant (l'emetteur)
        io.sockets.emit('defiAccept', defiant, defie);
        //On va attribuer un room à nos deux joueurs
        var idRoom = findRoom();
        //Si aucune room n'est dispo on annule tout. 
        if ( idRoom < 0){
            socket.emit('pasDeRoomDispo',defiant, defie);
        }else{ 
            rooms[idRoom].jeuEnCours = true;
            console.log('roomDispo');    
            var data = {defiant:defiant, defie:defie, idRoom:idRoom};
            //Envoyer un message à tous le monde pour enlever defiant et defie de la liste des challenge
            io.sockets.emit('removeFromChallengeList',data);
            //Indique à defiant et defie que leur partie va commencer
            io.sockets.emit('roomDispo', data);
        }    
    });	
    
    //Le joueur entre dans la room
    socket.on('goInRoom', function (pseudo, data) {
        //send client to 'room'+idRoom
        socket.room = data.idRoom;  
        socket.join(socket.room);  
        
        rooms[socket.room].nbUsersPresents++;
        console.log(pseudo + ' a rejoint la room ' + socket.room)
        //Add the client's username to the room's list 
        rooms[socket.room].users[pseudo] = socket.pseudo;
        //Tell all those in the room that a new user joined
        io.in(socket.room).emit('updatePrivateChat', 'SERVER', pseudo + ' has connected');
        //io.in(socket.room).emit('readyToStartGame');
        socket.emit('readyToStartGame');
    });
     
    //Un joueur a cliqué sur play au milieu du canvas 
    socket.on('ClicPlay', function(){  
        rooms[socket.room].nbClicPlay++;
        
        console.log( socket.pseudo + ' de la room '+ socket.room  + ' a cliqué sur PLAY');
        console.log('nbClicPlay room ' + socket.room + '=' + rooms[socket.room].nbClicPlay);
        
        if ( rooms[socket.room].nbClicPlay === 1 ){
            console.log( socket.pseudo + ' joue à gauche');
            rooms[socket.room].paddles[0].pseudo = socket.pseudo;
            //on dit au client qui a cliqué sur play de quel coté il va jouer
            socket.emit('side', 'PlayOnLeft');//envoie juste au client connecté (c.à.d celui qui a envoyé l'evenement 'ClicPlay' (clic sur play)
        }else{
            if ( rooms[socket.room].nbClicPlay === 2 ){
                console.log( socket.pseudo + ' joue à droite');
                rooms[socket.room].paddles[1].pseudo  = socket.pseudo;
                //on dit au client qui a cliqué sur play de quel coté il va jouer
                socket.emit('side', 'PlayOnRigth');
                //J'envois les pseudo des joueurs gauche et droite pour les ecrire dans le canvas
                io.in(socket.room).emit('pseudos', rooms[socket.room].paddles[0].pseudo, rooms[socket.room].paddles[1].pseudo);
                
                setTimeout(function(){
                    console.log('emit startGame for room '+ socket.room);
                    io.in(socket.room).emit('startGame', socket.room);
                    rooms[socket.room].gameTime = (new Date()).getTime();
                    console.log('gameTime ini='+rooms[socket.room].gameTime);
                    reInitGame(socket.room);
                    rooms[socket.room].jeuEnCours = true;
                    animation(socket.room);
                },300);
            }
        }
    });
    


    socket.on('fermerPartie', function(){ //à declencher aussi si le client n'est plus actif (ou ne clique pas sur play en moins de 30 secondes)  
        console.log('fermerPartie');
        if ( socket.room >= 0 ){
            console.log('socket.room='+socket.room);
            io.in(socket.room).emit('updatechat', 'SERVER', socket.pseudo + ' has disconnected');
            //Le joueur quitte la partie
            //io.in(socket.room).emit('updateusers', rooms[socket.room].users);
            socket.leave(socket.room);
            io.in(socket.room).emit('fermerPartie');
            console.log(socket.pseudo + ' a quitté la room ' + socket.room);
            videRoom(socket.room);
            reInitGame(socket.room);
        }
    });
    
    //Un des joueurs a abandonné donc l'autre gagne
    socket.on('resign', function(winnerSide){   
        console.log('resign');
        if ( socket.room >= 0 ){
            setTimeout(function(){victory(socket.room, winnerSide);}, 200);    
        }
    });   
    

    //Le serveur recoit la position du paddle d'un client et l'envoit à l'autre client. 
    socket.on('updatePaddle', function(clientPaddle){  
        //clientPaddle.myPaddleSide vaut 0 ou 1 suivant que le client joue (respectivement) à gauche ou à droite 
        
        if ( socket.room >= 0 ){
            //console.log('socket.room='+socket.room);	
            rooms[socket.room].paddles[clientPaddle.side].x = clientPaddle.x;
            rooms[socket.room].paddles[clientPaddle.side].y = clientPaddle.y;
            io.in(socket.room).emit('updateMouse', clientPaddle, socket.room);
        }
    });
});
//});


