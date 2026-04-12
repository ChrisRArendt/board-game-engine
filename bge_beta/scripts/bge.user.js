//http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html





var bge = (function (bge) {
	
	
	//CLASS USER
	bge.User = {
		new: function(_s){
			var _ = {};
			
			
			//FILL IN DEFAULTS FOR MISSING SETTINGS
			_.socketId = 	"socketId" in 	_s ?	_s.socketId : 	0;
			_.color =		"color" in 		_s ?	_s.color : 		"";
			_.name = 		"name" in 		_s ?	_s.name : 		"";
			_.connected = 	"connected" in 	_s ? 	_s.connected : 	false;
			
			
			//SET ADDITIONAL INSTANCE VARS
		
		
			//SET MEMBER FUNCTIONS
		
			
			//ADD LISTENERS
			
		
		
			bge.User.all.push(_);
			return _;
		},
		
		all: new Array(),
	}
			

	return bge;
}(bge || {}));
	