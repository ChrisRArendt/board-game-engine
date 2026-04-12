//http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html





var bge = (function (bge) {
	
	
	//CLASS WINDOW
	bge.Window = {
		new: function(_s){
			var _ = {};
			
			
			//FILL IN DEFAULTS FOR MISSING SETTINGS
			
			
			//SET ADDITIONAL INSTANCE VARS
			_.id = bge.Window.lastid++;
			_.el = $("<div/>");
			_.titlebar = {
				el: $("<div/>").addClass("titlebar"),
				sysbuttons: {
					el: $("<ul/>").addClass("sysbuttons")
				},
				title: {
					el: $("<p/>").addClass("title").text(_s.titlebar.title)
				},
				tabs: {
					all: new Array(),
					el: $("<ul/>").addClass("tabs")
				}
			};
			_.content = {
				el: $("<div/>").addClass("content"),
				panes: new Array(),
				
			};
			_.move_cursor_start = {
				x: 0,
				y: 0
			}
			_.move_el_start = {
				x: 0,
				y: 0
			}
			_.move_dragging = false;
			
			
			//SET MEMBER FUNCTIONS
			_.switchToPane = function( _tabClass ){
				var _ = this;
				
				for(var i=0; i<_.content.panes.length; i++){
					var pane = _.content.panes[i];
					
					if(_tabClass.indexOf(pane.tabClass) >= 0)
						pane.el.show();
					else
						pane.el.hide();
				}
				
				
				//if there is one, set tab as active
				for(var i=0; i<_.titlebar.tabs.all.length; i++){
					var tab = _.titlebar.tabs.all[i];
					
					if(_tabClass.indexOf(tab.class) >= 0)
						tab.el.addClass("active");
					else
						tab.el.removeClass("active");
				}
			}
			_.close = function(){
				var _ = this;
				
				_.el.hide();
			}
			_.open = function(){
				var _ = this;
				
				_.el.show();
			}
			_.minimize = function(){
				
			}
			_.minimize = function(){
				
			}
			_.focus = function(){
				var _ = this;
				
				bge.Window.blurAll();
				
				_.el.removeClass("inactive");
			}
			_.blur = function(){
				var _ = this;
				_.el.addClass("inactive");
			}
			
			
			//CREATE HTML ELEMENT
			$("body").append(
				_.el.addClass("window")
					.attr("rel", _.id)
					.attr("id", _s.id)
					.css({
						"width": _s.width+"px",
						"height": _s.height+"px"
					})
					.append(
						_.titlebar.el
							.append(_.titlebar.sysbuttons.el) 
							.append(_.titlebar.title.el)
							.append(_.titlebar.tabs.el)
					)
					.append(_.content.el)
			);
				
			//TITLEBAR
				//CLOSE, MINIMIZE, MAXIMIZE
				if(_s.titlebar.sysbuttons.indexOf("close") >= 0)
					_.titlebar.sysbuttons.el.append(
						$("<li/>")
							.text("x")
							.addClass("close")
							.on(touch_start, function(e){
								var winEl = $(this).parent().parent().parent();
								var winId = parseInt(winEl.attr("rel"),10);
								var _ = bge.Window.getWithId(winId);
								
								_.close();
							})
					);
				else
					_.titlebar.sysbuttons.el.append(
						$("<li/>").addClass("inactive")
					);
					
				if(_s.titlebar.sysbuttons.indexOf("minimize") >= 0)
					_.titlebar.sysbuttons.el.append(
						$("<li/>")
							.text("_")
							.addClass("minimize")
							.on(touch_start, function(e){
								var winEl = $(this).parent().parent().parent();
								var winId = parseInt(winEl.attr("rel"),10);
								var _ = bge.Window.getWithId(winId);
								
								_.minimize();
							})
					);
				else
					_.titlebar.sysbuttons.el.append(
						$("<li/>").addClass("inactive")
					);
				
				if(_s.titlebar.sysbuttons.indexOf("maximize") >= 0)
					_.titlebar.sysbuttons.el.append(
						$("<li/>")
							.text("+")
							.addClass("maximize")
							.on(touch_start, function(e){
								var winEl = $(this).parent().parent().parent();
								var winId = parseInt(winEl.attr("rel"),10);
								var _ = bge.Window.getWithId(winId);
								
								_.maximize();
							})
					);
				else
					_.titlebar.sysbuttons.el.append(
						$("<li/>").addClass("inactive")
					);
					
				//TABS
				for( var i=0; i<_s.titlebar.tabs.length; i++){
					var tab = _s.titlebar.tabs[i];
					
					_.titlebar.tabs.all.push(tab);
					tab.el = $("<li/>")
						.addClass(tab.class)
						.text(tab.text);
					_.titlebar.tabs.el.append( tab.el );
					
					if(tab.events === undefined){
						tab.el.on(touch_start, function(e){
							var winEl = $(this).parent().parent().parent();
							var winId = parseInt(winEl.attr("rel"),10);
							var _ = bge.Window.getWithId(winId);
							
							_.switchToPane( $(this).attr("class") );
						});
					}
					else
						for( var i2=0; i2<tab.events.length; i2++){
							var event = tab.events[i2];
							
							tab.el.on(event.eString, event.eFunction);
						}
				}
				
				//CONTENT
				for( var i=0; i<_s.content.length; i++){
					var pane = _s.content[i];
					
					pane.el = $("<div/>")
						.addClass("pane")
						.append(pane.content)
						.hide();
					_.content.el.append(pane.el);
					
					_.content.panes.push(pane);
				}
			
			
			//ADD LISTENERS
			_.el.on(touch_start, function(e){
				if(	touch_start === "touchstart" || e.which === 1){
					var winId = parseInt($(this).attr("rel"),10);
					var _ = bge.Window.getWithId(winId);
					
					bge.Window.blurAll();
					_.focus();
					
					e.stopPropagation();
				}
			});
			_.titlebar.title.el.on(touch_start, function(e){
				if(	touch_start === "touchstart" || e.which === 1){
					var winEl = $(this).parent().parent();
					var winId = parseInt(winEl.attr("rel"),10);
					var _ = bge.Window.getWithId(winId);
					if( _ === undefined ) return;
					
			
					//start move action for this window
					if(isMobile.android || isMobile.ios){
						_.move_cursor_start.x = e.originalEvent.touches[0].pageX;
						_.move_cursor_start.y = e.originalEvent.touches[0].pageY;
					}
					else{
						_.move_cursor_start.x = e.pageX;
						_.move_cursor_start.y = e.pageY;
					}
					
					var peo = getTransform(_.el);
					_.move_el_start.x = peo.x;
					_.move_el_start.y = peo.y;	
					
					_.move_dragging = true;
						
					e.preventDefault();
				}
			});
			
			
			
			_.switchToPane( _.content.panes[0].tabClass );
			bge.Window.all.push( _ );
			return _;
		},
		
		lastid: 0,
		all: new Array(),
		
		getWithId: function(_id){
			for(var i=0; i<bge.Window.all.length; i++)
				if(bge.Window.all[i].id === _id)
					return bge.Window.all[i];
			
			return undefined;
		},
		blurAll: function(){
			$.each(bge.Window.all, function(i, w){
				w.blur(); 
			});
		},
		handleEvent_document_touch_start: function(e){
			bge.Window.blurAll();
		},
		handleEvent_document_touch_move: function(e){
			//handle windows moving
			for(var i=0; i<bge.Window.all.length; i++){
				var w = bge.Window.all[i];
				
				if(w.move_dragging){
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
					
					var target = {
						x: w.move_el_start.x + (newcoords.x - w.move_cursor_start.x),
						y: w.move_el_start.y + (newcoords.y - w.move_cursor_start.y)
					};
					w.el.css("-webkit-transform", "translate3d(" +(target.x)+ "px, " +(target.y)+ "px, 0)");
				}
			}
		},
		handleEvent_document_touch_end: function(e){
			//handle windows stop moving
			for(var i=0; i<bge.Window.all.length; i++)
				bge.Window.all[i].move_dragging = false;
		}
	}
			

	return bge;
}(bge || {}));