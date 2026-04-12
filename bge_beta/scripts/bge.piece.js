//http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html





var bge = (function (bge) {
	
	
	//CLASS PIECE
	bge.Piece = {
		new: function(_s){
			var _ = {};
			
			//FILL IN DEFAULTS FOR MISSING SETTINGS
			_.attributes = 		"attributes" in 	_s ?			_s.attributes : 		(new Array());
			_.bg =				"bg" in 			_s ?			_s.bg : 				"";
			_.classes = 		"classes" in 		_s ?			_s.classes : 			"";
			_.placement = 		"placement" in 		_s ? 			_s.placement : 			{};
			_.placement.coords ="coords" in 		_s.placement ?	_s.placement.coords:	{x:0, y:0};
			_.image_size =		"image_size" in		_s ?			_s.image_size : 		{w: 0, h: 0};
			_.initial_size =	"initial_size" in 	_s ?			_s.initial_size :		{w: 0, h: 0};
			
			
			//SET VARS
			_.selected = false;
			
			_.id = bge.Piece.lastid++;
			_.move_el_start = {x:0, y:0};
			_.move_cursor_start = {x:0, y:0}; //when dragging, starting move position of cursor
			_.move_dragging = false; //when dragging, starting move position
			
			_.deselect = function(){
				var _ = this;
				if(!_.selected) return; //return if not selected
			
			
				_.selected = false;
				_.el.removeClass("selected");
				
				bge.Network.emit("piece_deselect", {
					oursocketid: bge.Network.ourSocketId,
					id: _.id
				});
				
				bge.refreshMenu();
			}
			_.select = function(){
				var _ = this;
				if(_.attributes.indexOf("select") < 0) return; //return if we can't select
				
				
				_.selected = true;
				_.el.addClass("selected");
				
				
				bge.Network.emit("piece_select", {
					oursocketid: bge.Network.ourSocketId,
					id: _.id
				});
				
				bge.refreshMenu();
			}
			_.duplicate = function(){
				var _ = this;
				if(_.attributes.indexOf("duplicate") < 0) return; //return if can't duplicate
				
				
				var peo = getTransform(_.el); //piece element offset
				var np = bge.Piece.new({
					attributes: 	_.attributes.slice(0),
					bg: 			_.bg,
					classes: 		_.classes,
					placement:		{
						coords: 		{
							x: peo.x,
							y: peo.y,
						}
					},
					image_size: 	_.image_size,
					initial_size: 	_.initial_size,
				});
				np.attributes.splice(np.attributes.indexOf("duplicate"),1);//don't allow the new piece to duplicate
				np.attributes.push("destroy");//allow duplicates to be destroyed
				
				return np;
			}
			_.destroy = function(){
				var _ = this;
				if(_.attributes.indexOf("destroy") < 0) return; //return if can't destroy
				
				
				_.deselect();
				_.el.remove();
				
				//remove from bge.Piece.all
				//~~ need to check this to make sure it works
				bge.Piece.all.splice(bge.Piece.all.indexOf(_),1);
				//for(var i=0; i<bge.Piece.all.length; i++)
				//	if(bge.Piece.all[i].id === _.id){
				//		bge.Piece.all.splice(i,1);
				//		break;
				//	}
				
				//~~ needs destroy emit!
			}
			_.flip = function(){
				var _ = this;
				if(_.attributes.indexOf("flip") < 0) return; //return if can't flip
				
				
				if(_.isFlipped())
					_.el.css("background-position", (-_.initial_size.w)+"px 0px");
				else
					_.el.css("background-position", "0px 0px");
			}
			_.isFlipped = function(){
				var _ = this;
				if(_.attributes.indexOf("flip") < 0) return; //return if can't be flipped in the first place
				
				return parseFloat(_.el.css("background-position").split(" ")[0]) === 0;
			}
			_.moveTo = function(_x, _y){
				var _ = this;
				_.el.css("-webkit-transform", "translate3d(" +_x+ "px, " +_y+ "px, 0)");
			}
			
			
			//CREATE HTML ELEMENT
			_.el = $("<div/>")
				.addClass("piece "+_.classes)
				.css("width", _.initial_size.w)
				.css("height", _.initial_size.h)
				.css("background-image", "url(data/"+ bge.curgame +"/images/"+ _.bg +")")
				.css("-webkit-transform", "translate3d(" +(_.placement.coords.x)+ "px, " +(_.placement.coords.y)+ "px, 0)")
				.attr("rel", _.id)
				.css("z-index", _.id);
			
			
			//ADD LISTENERS
			_.wasSelectedAlready = false;
			_.movedSinceMouseDown = false;
			if(	_.attributes.indexOf("select") >= 0){				//SELECT
				_.el.on(touch_start, function(e){
						if(	touch_start === "touchstart" || e.which === 1){ //left click
							var _ = bge.Piece.getWithId( parseInt($(this).attr("rel"),10) );
							if(_ === undefined) return; //return if this piece is unregistered
							
							
							if(bge.shiftDown){ //trying to select multiple
								if(_.selected){
									//_.deselect();
									_.wasSelectedAlready = true;
								}
								else
									_.select();
							}	
							else if(!_.selected){ //trying to select single, if not already selected
								bge.Piece.deselectAll();
								_.select();
							}	
							
							
							e.preventDefault();
							e.stopPropagation();
						}
						
					
						bge.zSorted = false;
					})
					.on(touch_end, function(e){
						var _ = bge.Piece.getWithId( parseInt($(this).attr("rel"),10) );
						if(_ === undefined) return; //return if this piece is unregistered
						
						
						if(bge.shiftDown && _.wasSelectedAlready && !_.movedSinceMouseDown)
							_.deselect();
							
						_.wasSelectedAlready = false;
						_.movedSinceMouseDown = false;
						
						if(!_.isFlipped())
							bge.viewer.setTarget( _ );
						else
							bge.viewer.setTarget( undefined );
					});
			/*
				_.el.on(touch_start, function(e){
						if(	touch_start === "touchstart" || 
							e.which === 1 ||
							e.which === 3){
							var pid = parseFloat($(this).attr("rel"),10);
							var p = bge.Piece.getWithId( pid );
							if( p === undefined ) return;
							
							
							var clickcoords = {
								x: 0,
								y: 0
							};
							if(isMobile.android || isMobile.ios){
								clickcoords.x = e.originalEvent.touches[0].pageX;
								clickcoords.y = e.originalEvent.touches[0].pageY;
							}
							else{
								clickcoords.x = e.pageX;
								clickcoords.y = e.pageY;
							}
							
							//select action
							if(bge.Piece.getSelected().length === 0)
								if(bge.selectBoxing && p.selected)
									p.deselect();
								else
									p.select();
							else
								if(bge.shiftDown)
									p.select();
								else
									if(!p.selected){
										bge.Piece.deselectAll();
										p.select();
									}
							
							e.preventDefault();
							e.stopPropagation();
						}
					})
					.on(touch_end, function(e){
						if(	touch_end === "touchstart" || e.which === 1){
							var pid = parseFloat($(this).attr("rel"),10);
							var p = bge.Piece.getWithId( pid );
							if( p === undefined ) return;
							
							if(bge.shiftDown && !p.move_dragging){
								if(p.selected)
									p.deselect();
							}
						}
					});
			*/
			}
			if(	_.attributes.indexOf("move") >= 0){					//MOVE
				_.el.on(touch_start, function(e){
						var _ = bge.Piece.getWithId( parseInt($(this).attr("rel"),10) );
						if(_ === undefined) return; //return if this piece is unregistered
						
						
						bge.selectBoxing = false;
						var go = getTransform($("#game"));
						
						var slist = bge.Piece.getSelected();
						for(var i=0; i<slist.length; i++){
							var p = slist[i];
							var peo = getTransform(p.el);
							
							//set where cursor was when we started moving
							if(isMobile.android || isMobile.ios){
								p.move_cursor_start.x = e.originalEvent.touches[0].pageX -  go.x;
								p.move_cursor_start.y = e.originalEvent.touches[0].pageY -  go.y;
							}
							else{
								p.move_cursor_start.x = e.pageX -  go.x;
								p.move_cursor_start.y = e.pageY -  go.y;
							}
							
							//set where piece was when we started moving
							p.move_el_start.x = peo.x;
							p.move_el_start.y = peo.y;	
							
							p.move_dragging = true;
						}
						console.log(bge.Piece.getDragging().length +" set to drag");
					})
					.on(touch_move, function(e){
						var _ = bge.Piece.getWithId( parseInt($(this).attr("rel"),10) );
						if(_ === undefined) return; //return if this piece is unregistered
						
						
						if(_.move_dragging)
							_.movedSinceMouseDown = true;
					});
				/*_.el.on(touch_start, function(e){
					if(	touch_start === "touchstart" || e.which === 1){ //left click
						var pid = parseFloat($(this).attr("rel"),10);
						var p = bge.Piece.getWithId( pid );
						if( p === undefined ) return;
						
						
						//add clicked to selection
						var slist = bge.Piece.getSelected();
						//if(slist.indexOf(p) < 0)
						//	p.select();
						//var slist = bge.Piece.getSelected();
							
						if(!bge.selectBoxing){
							//see if we can move all the selected items
							var dontdoit = false;
							for(var i=0; i<slist.length; i++)
								if(slist[i].attributes.indexOf("move") < 0){
									dontdoit = true;
									break;
								}
							if(!dontdoit){
								//see if we are dragging duplicates off
								var dontdoit = false;
								for(var i=0; i<slist.length; i++)
									if(slist[i].attributes.indexOf("duplcate") < 0){
										dontdoit = true;
										break;
									}
								if(!dontdoit){
									bge.Piece.deselectAll();
									for(var i=0; i<slist.length; i++){
										var np = slist[i].duplicate();
										np.select();
									}
								}	
								
								var slist = bge.Piece.getSelected();
								for(var i=0; i<slist.length; i++){
									var p = slist[i];
									
									//start move action for this piece
									if(isMobile.android || isMobile.ios){
										p.move_cursor_start.x = e.originalEvent.touches[0].pageX;
										p.move_cursor_start.y = e.originalEvent.touches[0].pageY;
									}
									else{
										p.move_cursor_start.x = e.pageX;
										p.move_cursor_start.y = e.pageY;
									}
									
									var peo = getTransform(p.el);
									p.move_el_start.x = peo.x;
									p.move_el_start.y = peo.y;	
									
									var go = getTransform($("#game"));
									p.move_cursor_start.x -= go.x;
									p.move_cursor_start.y -= go.y;
									p.move_dragging = true;
								}
									
								e.preventDefault();
								e.stopPropagation();
							}
						}
					}
				});*/
			}
			if(	_.attributes.indexOf("flip") >= 0){					//FLIP
				_.el.css("background-position", (-_.initial_size.w)+"px 0px");
				_.el.css("background-size", "200% 100%");
			}
			if(	_.attributes.indexOf("roundcorners") >= 0){			//ROUNDED CORNERS
				_.el.css("border-radius", "8px");
			}
			
			
			
			
			
			
			
			$("#pieces").prepend(_.el);
			bge.Piece.all.push(_);
			return _;
		},
		
		lastid: 0,
		all: new Array(),
		
		getWithId: function(_id){
			for(var i=0; i<bge.Piece.all.length; i++)
				if(bge.Piece.all[i].id === _id)
					return bge.Piece.all[i];
			
			return undefined;
		},
		deselectAll: function(){
			$.each(bge.Piece.all, function(i, p){
				if(p.selected)
					p.deselect(); 
			});
		},
		getDragging: function(){
			return bge.Piece.all.filter(function(p){
				return p.move_dragging;
			});
		},
		getSelected: function(){
			return bge.Piece.all.filter(function(p){
				return p.selected;
			});
		},
		getNotSelected: function(){
			return bge.Piece.all.filter(function(p){
				return !p.selected;
			});
		},
		shuffleSelected: function(){
			var slist = bge.Piece.getSelected();
			
			
			//get shuffled list of z-indexes to distribute
			var shuffledList = new Array();
			for(var i=0; i<slist.length; i++)
				shuffledList.push({
					zindex: slist[i].el.css("z-index"),
					x: getTransform(slist[i].el).x,
					y: getTransform(slist[i].el).y,
				});
			shuffledList = shuffle(shuffledList);
			
			//distribute z-indexes
			for(var i=0; i<slist.length; i++){
				var p = slist[i];
				var pnew = shuffledList[i];
				p.el.css("z-index", pnew.zindex);
				p.moveTo(pnew.x, pnew.y);
				
				bge.Network.emit("piece_shuffle", {
					oursocketid: bge.Network.ourSocketId,
					id: p.id,
					zindex: pnew.zindex,
					x: pnew.x,
					y: pnew.y,
				});
			}
		},
		arrangeFanned: function(){
			var slist = bge.Piece.getSelected();
			
			
			//FIND AVERAGE POSITION
			var avgoff = {
				x: 0,
				y: 0
			}
			for(var i=0; i<slist.length; i++){
				var elt = getTransform(slist[i].el);
				
				avgoff.x += elt.x;
				avgoff.y += elt.y;
			}
			avgoff.x /= slist.length;
			avgoff.y /= slist.length;
			
			
			//GET UPPER-LEFT STARTING POINT
			var spacing = {
				x: 25,
				y: 0,
			}
			var start = {
				top: avgoff.y - (spacing.y * (slist.length-1))/2,
				left: avgoff.x - (spacing.x * (slist.length-1))/2,
			}
			
		
			//ARRANGE
			slist.sort(function(a, b) { 
			    return parseInt(a.el.css("z-index")) - parseInt(b.el.css("z-index"));
			})
			for(var i=0; i<slist.length; i++){
				var p = slist[i];
				
				var target = {
					x: start.left + (spacing.x*i),
					y: start.top + (spacing.y*i),
				};
				p.moveTo(target.x, target.y);
				
				bge.Network.emit("piece_move", {
					oursocketid: bge.Network.ourSocketId,
					id: p.id,
					x: target.x, 
					y: target.y
				});
			}
		},
		arrangeStacked: function(){
			var slist = bge.Piece.getSelected();
			
			
			//FIND AVERAGE POSITION
			var avgoff = {
				x: 0,
				y: 0
			}
			for(var i=0; i<slist.length; i++){
				var elt = getTransform(slist[i].el);
				
				avgoff.x += elt.x;
				avgoff.y += elt.y;
			}
			avgoff.x /= slist.length;
			avgoff.y /= slist.length;
			
			
			//ARRANGE
			for(var i=0; i<slist.length; i++){
				var p = slist[i];
				
				p.moveTo(avgoff.x, avgoff.y);
				
				bge.Network.emit("piece_move", {
					oursocketid: bge.Network.ourSocketId,
					id: p.id,
					x: avgoff.x, 
					y: avgoff.y
				});
			}
		},
		arrangeSmart: function(){
			var slist = bge.Piece.getSelected();
			
			if(slist[0].isFlipped())
				bge.Piece.arrangeStacked();
			else
				bge.Piece.arrangeFanned();
		},
		bringDraggingToFront: function(){
			/*
				How handling cards IRL works:
				-	If you have a selection of cards that you pull out of your
					hand, you likely want to either put them down, put them in
					front of the rest in your hand, or at back of your hand (categorizing). 
					Thus, it may be preferable to have cards selected
					come together in a fanned arrangement as they are dragged
					and then if you drag them in front/right (so that the first/leftmost card 
					in the selected arrangement is to the right/positive X of the static
					arrangement, and at similar height/similar Y) 
					of an arrangement of cards, then they are assigned
					z-indexes that are above/greater the right-most card in that arrangement.
					Likewise, if you drag the cards so that they are behind/left an
					arrangement (so that the last/rightmost card in the selected
					arrangement is to the left of the static arrangement, and at a
					similar height/similar Y) then they would be assigned z-indexes
					that are below/lesser than the static arrangement.
				-	You might want to put a group of cards in-between the rest
					in your hand. This would result as above, except that the selected 
					cards would be assigned higher z-indexes than the static cards
					that are to the left and the cards to the right would be assigned z-indexes
					that are higher than the selected cards. Additionally, it would be nice
					to have the cards pushed aside as the selected cards were moved about,
					so that the cards on either side would get pushed over as they would 
					be when the mouse was released and the position of the selected cards
					was decided. Perhaps css3 transitions might work on the static card elements
					to make them smoothly slide around while the user drags the selection.
			*/
		
		
			
			var dlist = bge.Piece.getDragging();
			console.log("bringDraggingToFront "+dlist.length);
			if(dlist.length === 0) return;
			var nslist = bge.Piece.getNotSelected();
			
			
			
			//CHECK IF SELECTED ITEMS ARE ALREADY TOP OF Z-INDEX
			var highest_ns_z = 0;
			for(var i=0; i<nslist.length; i++)
				if(highest_ns_z < parseInt(nslist[i].el.css("z-index"),10))
					highest_ns_z = parseInt(nslist[i].el.css("z-index"),10);
			var somethinglower = false;
			for(var i=0; i<dlist.length; i++)
				if(highest_ns_z > parseInt(dlist[i].el.css("z-index"),10))
					somethinglower = true;
			
			
			//IF SOMETHING IS LOWER, WE NEED TO RE-ARRANGE DRAGGING ITEMS ABOVE ALL OTHER ITEMS ON BOARD
			var highz = 0;
			if(somethinglower){
				//GET HIGHEST Z-INDEX
				var highz = 0;
				for(var i=0; i<bge.Piece.all.length; i++)
					if(highz < parseInt(bge.Piece.all[i].el.css("z-index"),10))
						highz = parseInt(bge.Piece.all[i].el.css("z-index"),10);
			}
			else{
				highz = highest_ns_z;
			}
			
			//ARRANGE BY Z-INDEX, LEFT->RIGHT TOP->BOTTOM
			//first, sort by y position
			dlist.sort(function(a, b) { 
			    return getTransform(a.el).y - getTransform(b.el).y;
			});
			
			//then, subsort into lists of what is on each y-position
			var xlists = new Array();
			var xlistsi = 0;
			var cury = -999999;
			for(var i=0; i<dlist.length; i++){
				//move to next xlist when we run out of elements on this y position
				if(cury + 50 < getTransform(dlist[i].el).y){
					//first, sort previous list if there was one			
					cury = getTransform(dlist[i].el).y;
					//console.log( "Y POSITION: " + cury );
					xlists.push(new Array());
					xlistsi = xlists.length-1;
				}
				
				xlists[xlistsi].push(dlist[i]);
				//console.log( getTransform(dlist[i].el).x );
			}
			
			//then sort each sublist by it's x-position
			for(var i=0; i<xlists.length; i++)
				xlists[i].sort(function(a, b) { 
				    return getTransform(a.el).x - getTransform(b.el).x;
				});
			
			//now assign z-indexs
			var nextz = 0;
			for(var yi=0; yi<xlists.length; yi++)
				for(var xi=0; xi<xlists[yi].length; xi++){
					var p = xlists[yi][xi];
					p.el.css("z-index", highz + (++nextz));
					
					bge.Network.emit("piece_zindexchange", {
						oursocketid: bge.Network.ourSocketId,
						id: p.id,
						zindex: p.el.css("z-index"),
					});
				}
		},
		handleEvent_document_touch_start: function(e){
			if(	touch_start === "touchstart" || e.which === 1){
				if(!bge.shiftDown)
					bge.Piece.deselectAll();
				bge.viewer.setTarget(undefined);
			}
		},
		handleEvent_document_touch_move: function(e){
			var go = getTransform($("#game"));
			var slist = bge.Piece.getDragging();
			for(var i=0; i<slist.length; i++){
				var p = slist[i];
					
				//start moving
				bge.handscroll = false;
				var newcoords = {
					x: 0,
					y: 0
				};
				if(isMobile.android || isMobile.ios){
					newcoords.x = e.originalEvent.touches[0].pageX;
					newcoords.y = e.originalEvent.touches[0].pageY;
				}
				else{
					newcoords.x = e.pageX;
					newcoords.y = e.pageY;
				}
				
				
				var zm = 1/bge.getzoommult(); //zoom modifier
				var target = {
					x: p.move_el_start.x - go.x*zm + (newcoords.x - p.move_cursor_start.x)*zm,
					y: p.move_el_start.y - go.y*zm + (newcoords.y - p.move_cursor_start.y)*zm
				};
				p.moveTo(target.x, target.y);
				
				//communicate to network
				bge.Network.emit("piece_move", {
					oursocketid: bge.Network.ourSocketId,
					id: p.id,
					x: target.x, 
					y: target.y
				});
			}
			
			if(!bge.zSorted){
				bge.zSorted = true;
				bge.Piece.bringDraggingToFront();
			}
		},
		handleEvent_document_touch_end: function(e){
			//handle pieces stop moving
			for(var i=0; i<bge.Piece.all.length; i++)
				bge.Piece.all[i].move_dragging = false;
		},
	}
	
		

	return bge;
}(bge || {}));

