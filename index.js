const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const userModel = require(__dirname + '/models/User');
const gmModel = require(__dirname + '/models/Groupchat');
const pmModel = require(__dirname + '/models/Privatechat');

const mongoDB = 'mongodb+srv://kafabnu101:65qX6iKL2ENMmQj@cluster0.xlocajv.mongodb.net/lab_test1?retryWrites=true&w=majority';
mongoose.connect(mongoDB, 
{
     useNewUrlParser: true,
    useUnifiedTopology: true
}).then(success => {
  console.log('MongoDB connected')
}).catch(err => {
  console.log('Error while MongoDB connection')
});

const socketio = require('socket.io');
const formatMessage = require('./models/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
} = require('./models/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = "ChatBot";

// Run when client connects
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit('message', formatMessage(botName, 'Welcome to ChatBot!'));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

//http://localhost:8080/signup
app.get('/signup', async (req, res) => {
  res.sendFile(__dirname + '/public/signup.html')
});

//http://localhost:8080/login
app.get('/login', async (req, res) => {
  res.sendFile(__dirname + '/public/login.html')
});
app.post('/login', async (req, res) => {
const user = new userModel(req.body);

try {
  await user.save((err) => {
    if(err){
        if (err.code === 11000) {
           return res.redirect('/signup?err=username')
        }
      
      res.send(err)
    }else{
      res.sendFile(__dirname + '/public/login.html')
    }
  });
} catch (err) {
  res.status(500).send(err);
}
});

//http://localhost:8080/
app.get('/', async (req, res) => {
res.sendFile(__dirname + '/public/login.html')
});
app.post('/', async (req, res) => {
const username=req.body.username
const password=req.body.password

const user = await userModel.find({username:username});

try {
  if(user.length != 0){
    if(user[0].password==password){
      return res.redirect('/')
    }
    else{
      return res.redirect('/login?wrong=pass')
    }
  }else{
    return res.redirect('/login?wrong=uname')
  }
} catch (err) {
  res.status(500).send(err);
}
});


//http://localhost:8080/chat/covid
app.get('/chat/:room', async (req, res) => {
  const room = req.params.room
  const msg = await gmModel.find({room: room}).sort({'date_sent': 'desc'}).limit(10);
  if(msg.length!=0){
    res.send(msg)
  }
  else
  res.sendFile(__dirname + '/html/chat.html')
});
app.post('/chat',async(req,res)=>{
  const username=req.body.username
  const user = await userModel.find({username:username});
  console.log(user)
  if(user[0].username==username){
    return res.redirect('/chat/'+username)
  }
  else{
    return res.redirect('/?err=noUser')
  }
})

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


