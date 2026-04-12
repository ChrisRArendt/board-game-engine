
var bges = (new (function(){
	var _ = this;
	
	
	_.http = require("http");
	_.socketio = require("socket.io");
	_.fs = require("fs");
	
	
	_.nodeserver = _.http.createServer(function(_req, _res){
		_res.writeHead(200);
		_res.end("Server started.");
	});
	_.nodeserver.listen(10000, "0.0.0.0");
	
	
	_.allsocks = new Array();
	_.getSocketById = function(_id){
		for(var i=0; i<bges.allsocks.length; i++){
			var sock = bges.allsocks[i];
			
			if(sock.id === _id)
				return sock;
		}
	}
	_.io = _.socketio.listen(_.nodeserver);
	_.io.sockets.on('connection', function (_sock) {
		var sockaddress = _sock.handshake.address.address+":"+_sock.handshake.address.port;
		console.log("Connection for " +_sock.id+ " from "+sockaddress);
		
		//EVENTS
		_sock
			.on("disconnect", function(){
				var user = bges.User.getWithSocketId(this.id);
				if(user !== undefined)
					user.connected = false;
			
				//send out updated user listing
				bges.User.emitUserListing();
			})
			.on("user_init", function(_data){
				//get relevent user object
				var user = bges.User.getWithSocketId(_data.previousSocketId);
				user = user === undefined ? new bges.User() : user;
				
				//set user information
				user.socketId = _data.socketId;
				var oursock = bges.getSocketById(user.socketId);
				user.address = oursock.handshake.address.address +":"+ oursock.handshake.address.port;
				user.name = _data.name;
				user.connected = true;
				
				
				//send out updated user listing
				bges.User.emitUserListing();
			})
			.on('piece_move', function (_data) {
				_sock.broadcast.emit("piece_move", {
					id: _data.id,
					x: _data.x,
					y: _data.y
				});
			})
			.on('piece_select', function (_data) {
				var u = bges.User.getWithSocketId(_data.oursocketid);
				
				_sock.broadcast.emit("piece_select", {
					id: _data.id,
					color: u.color
				});
			})
			.on('piece_deselect', function (_data) {
				_sock.broadcast.emit("piece_deselect", {
					id: _data.id
				});
			})
			.on('piece_flip', function (_data) {
				_sock.broadcast.emit("piece_flip", {
					id: _data.id,
					isFlipped: _data.isFlipped,
				});
			})
			.on('piece_shuffle', function (_data) {
				_sock.broadcast.emit("piece_shuffle", {
					id: _data.id,
					zindex: _data.zindex,
					x: _data.x,
					y: _data.y
				});
			})
			.on('piece_zindexchange', function(_data){
				_sock.broadcast.emit("piece_zindexchange", {
					id: _data.id,
					zindex: _data.zindex,
				});
			})
			.on("window_open", function(_data){
				_sock.broadcast.emit("window_open", {
					winid: _data.winid,
				});
			})
			.on("window_roller_roll", function(_data){
				_sock.broadcast.emit("window_roller_roll", {
					rollId: _data.rollId,
					result: _data.result,
					datestr: _data.datestr,
				});
			})
			.on("textregion_change", function(_data){
				_sock.broadcast.emit("textregion_change", {
					winid: _data.winid,
					val: _data.val,
				});
			});
			
		bges.allsocks.push(_sock);
	});
	
	_.User = function(){
		var _ = this;
		
		
		_.id = bges.User.lastId++;
		_.socketId = 0;
		_.address = ""; //ip
		_.color = "hsla(" +(bges.User.all.length*222.49223595 + bges.User.colorRangeOffset)+ ", 70%, 60%, 1)";
		_.name = "";
		_.connected = false;
		
		
		_.destroy = function(){
			bges.User.all.splice(bges.User.all.indexOf(this), 1);
		}
		
		
		bges.User.all.push(_);
		return _;
	}
	_.User.colorRangeOffset = Math.random()*360;
	_.User.lastId = 0;
	_.User.all = new Array();
	_.User.getWithIp = function(_ip){
		for(var i=0; i<bges.User.all.length; i++){
			var u = bges.User.all[i];
			
			if(u.address === _ip)
				return u;
		}
	}
	_.User.getWithSocketId = function(_socketId){
		if(_socketId === undefined)
			return;
			
		for(var i=0; i<bges.User.all.length; i++){
			var u = bges.User.all[i];
			
			if(u.socketId === _socketId)
				return u;
		}
	}
	_.User.getWithName = function(_name){
		for(var i=0; i<bges.User.all.length; i++){
			var u = bges.User.all[i];
			
			if(u.name === _name)
				return u;
		}
	}
	_.User.emitUserListing = function(){
		var users = new Array();
		for(var i=0; i<bges.User.all.length; i++){
			var ui = bges.User.all[i];
			
			users.push({
				socketId: ui.socketId,
				color: ui.color,
				name: ui.name,
				connected: ui.connected,
			});
		}
		
		bges.io.sockets.emit("user_listing", users);
	}
	
	
	return _;
})());













































//past ideas:

/*
_.User.findUniqueColor = function(){
	//get array of existing user colors
	var reserved = new Array();
	for(var i=0; i<bges.User.all.length; i++)
		reserved.push(bges.User.all[i].color);
		
	//start with black
	var target = {
		r: {
			val: 0,
			uniqueness: 0
		}
		g: {
			val: 0,
			uniqueness: 0
		},
		b: {
			val: 0,
			uniqueness: 0
		}
	};
	
	for(var i=0; i<reserved.length; i++){
		var ca = reserved[i];
		for( var i2=0; i2<reserved.length; i2++){
			var cb = reserved[i];
			
			var test = {
				r: {
					val: 0,
					uniqueness: 0
				}
				g: {
					val: 0,
					uniqueness: 0
				},
				b: {
					val: 0,
					uniqueness: 0
				}
			};
			
			//uniqueness results
			test.r.uniqueness = Math.abs(ca.r - cb.r);
			test.g.uniqueness = Math.abs(ca.g - cb.g);
			test.b.uniqueness = Math.abs(ca.b - cb.b);
			
			//val results
			test.r.val = ca.r < cb.r ? ca.r : cb.r;
			test.r.val = test.r.val + (test.r.uniqueness/2);
			
			//set results if more unique
			target.r = target.r.uniqueness < test.r.uniqueness ? test.r : target.r;
			target.g = target.g.uniqueness < test.g.uniqueness ? test.g : target.g;
			target.b = target.b.uniqueness < test.b.uniqueness ? test.b : target.b;
		}
	}
}
*/
/*
_.history = new Array();



bges.history.push({
	type: _type,
	data: _data
});
console.log("history length: " +bges.history.length);



//give all previous history
for(var i=0; i<bges.history.length; i++){
	var h = bges.history[i];
	_sock.emit(h.type, h.data)
}
*/





/*

// send to current request socket client
 socket.emit('message', "this is a test");

 // sending to all clients, include sender
 io.sockets.emit('message', "this is a test");

 // sending to all clients except sender
 socket.broadcast.emit('message', "this is a test");

 // sending to all clients in 'game' room(channel) except sender
 socket.broadcast.to('game').emit('message', 'nice game');

  // sending to all clients in 'game' room(channel), include sender
 io.sockets.in('game').emit('message', 'cool game');

 // sending to individual socketid
 io.sockets.socket(socketid).emit('message', 'for your eyes only');

*/