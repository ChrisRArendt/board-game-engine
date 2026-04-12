


var bge = (function (bge) {
	bge.zoomlevel = 0;
	bge.adjustzoom = function(_z, _zoomTo){
		//adjust zoom
		var lastzm = bge.getzoommult();
		var lastzl = bge.zoomlevel;
		bge.zoomlevel += _z;
		if( bge.zoomlevel < -1 )	bge.zoomlevel = -1;
		if( bge.zoomlevel > 1 )	bge.zoomlevel = 1;
		var curzm = bge.getzoommult();
		var curzl = bge.zoomlevel;
		$("#pieces")
			//.css("zoom", curzm) //IE
			.css("-moz-transform", "scale(" +curzm+ ")") //FF
			.css("-moz-transform-origin", "0 0")
			.css("-o-transform", "scale(" +curzm+ ")") //OPERA
			.css("-o-transform-origin", "0 0")
			.css("-webkit-transform", "scale(" +curzm+ ")") //SAFARI / CHROME
			.css("-webkit-transform-origin", "0 0")
			.css("transform", "scale(" +curzm+ ")")
			.css("transform-origin", "0 0")
			.removeClass("zoom_"+lastzl)
			.addClass("zoom_"+curzl);
			
		
		//center on zoomTo point
		var go = getTransform($("#game"));
		_zoomTo = _zoomTo === undefined ? "camera" : _zoomTo;
		var zoomo = $("#"+_zoomTo).offset(); //used to have to multiply x and y by scale
		var target = {
			x: go.x - zoomo.left + (get_viewportSize().w/2),
			y: go.y - zoomo.top + (get_viewportSize().h/2)
		}
		$("#game").css("-webkit-transform", "translate3d(" +target.x+ "px, " +target.y+ "px, 0)");
	}
	bge.getzoommult = function(){
		switch( bge.zoomlevel ){
			case -1:
				return .35;
				break;
			case 0:
				return .6;
				break;
			case 1:
				return 1.4;
				break;
		}
	}
	bge.handscroll = false;
	bge.centerCamToVP = function(){
		var vp = get_viewportSize();
		var go = getTransform($("#game"));
		var z = bge.getzoommult();
		
		
		var target = {
			x: (vp.w/2 - go.x) * (1/z),
			y: (vp.h/2 - go.y) * (1/z)
		};
		$("#camera").css("-webkit-transform", "translate3d(" +(target.x)+ "px, " +(target.y)+ "px, 0)");
	}
	
	
	bge.zSorted = false;
	bge.mouseScroll = {
		delta: {x: 0, y: 0},
		speed: 20,
		interval: setInterval(function(){
			if(	bge.settings.interface.panScreenEdge &&	//this is an optional feature
				!bge.handscroll){						//don't do while trying to scroll with mouse
				var go = getTransform($("#game"));
				var target = {
					x: go.x + bge.mouseScroll.delta.x,
					y: go.y + bge.mouseScroll.delta.y
				}
				$("#game").css("-webkit-transform", "translate3d(" +(target.x)+ "px, " +(target.y)+ "px, 0)");
			}
		}, (1000.0/30)),
		setDelta: function(_x, _y){
			bge.mouseScroll.delta.x = _x;
			bge.mouseScroll.delta.y = _y;
		},
		gameOrigin: {x: 0, y: 0},
		cursorOrigin: {x: 0, y: 0},
		mousePos: {x: 0, y: 0},
		handleEvent_document_mouseleave: function(e){
			bge.mouseScroll.setDelta(0, 0);
		},
		handleEvent_document_touch_start: function(e){
			if(	touch_start === "touchstart" || e.which === 1){
				if(isMobile.android || isMobile.ios)
					bge.mouseScroll.cursorOrigin = {
						x: e.originalEvent.touches[0].pageX,
						y: e.originalEvent.touches[0].pageY,
					};
				else
					bge.mouseScroll.cursorOrigin = {
						x: e.pageX,
						y: e.pageY
					};
			
			
				//PANNING WITH MOUSE
				if(!bge.shiftDown){
					var go = getTransform($("#game"));
					bge.mouseScroll.gameOrigin.x = go.x;
					bge.mouseScroll.gameOrigin.y = go.y;
					
					bge.handscroll = true;
				}
			}
		},
		handleEvent_document_touch_move: function(e){
			var go = getTransform($("#game"));
			
			
			//HANDLE SCROLLING FROM MOUSE
			bge.mouseScroll.mousePos = {x: 0, y: 0};
			if(isMobile.android || isMobile.ios){
				bge.mouseScroll.mousePos.x = e.originalEvent.touches[0].pageX;
				bge.mouseScroll.mousePos.y = e.originalEvent.touches[0].pageY;
			}
			else{
				bge.mouseScroll.mousePos.x = e.pageX;
				bge.mouseScroll.mousePos.y = e.pageY;
			}
			if(bge.handscroll){
				var target = {
					x: bge.mouseScroll.gameOrigin.x + bge.mouseScroll.mousePos.x - bge.mouseScroll.cursorOrigin.x,
					y: bge.mouseScroll.gameOrigin.y + bge.mouseScroll.mousePos.y - bge.mouseScroll.cursorOrigin.y
				};
				$("#game").css("-webkit-transform", "translate3d(" +(target.x)+ "px, " +(target.y)+ "px, 0)");
				
				bge.centerCamToVP();
			}
			
				
			//SET VARS FOR SCROLLING ON EDGE OF SCREEN
			var target = {x: 0, y: 0};
			var marginSize = {
				x: get_viewportSize().h * .1,
				y: get_viewportSize().h * .1
			}
					
			if(get_viewportSize().w-marginSize.x < e.pageX) //right side
				target.x = -bge.mouseScroll.speed * (e.pageX - (get_viewportSize().w-marginSize.x)) / marginSize.x;
			else if(e.pageX < marginSize.x) //left side
				target.x = bge.mouseScroll.speed * (marginSize.x - e.pageX) / marginSize.x;
			else
				target.x = 0;
				
			if(get_viewportSize().h-marginSize.y < e.pageY) //bottom
				target.y = -bge.mouseScroll.speed * (e.pageY - (get_viewportSize().h-marginSize.y)) / marginSize.y;
			else if(e.pageY < 30 + marginSize.y && 
					e.pageY > 30) // top
				target.y = bge.mouseScroll.speed * (marginSize.y + 30 - e.pageY) / marginSize.y;
			else
				target.y = 0;
				
			bge.mouseScroll.setDelta(target.x, target.y);
		},
		handleEvent_document_touch_end: function(e){
			if(bge.handscroll)
				bge.handscroll = false;
		}
	};
	bge.settings = {
		interface: {
			zoomWithScroll: false,
			panScreenEdge: false,
		},
		connection: {
			address: "",
			username: "",
		}
	};
	bge.shiftDown = false;
	bge.selectBox = {
		handleEvent_document_touch_start: function(e){
			if(	touch_start === "touchstart" || e.which === 1){
				if(bge.shiftDown){
					//start selecting
					$("#selectbox").show();
					
					if(isMobile.android || isMobile.ios)
						bge.selectBox.start = {
							x: e.originalEvent.touches[0].pageX,
							y: e.originalEvent.touches[0].pageY
						};
					else
						bge.selectBox.start = {
							x: e.pageX,
							y: e.pageY
						};
					
					
					bge.selectBox.startItems = bge.Piece.getSelected();
					bge.selectBox.selecting = true;
				}
			}
		},
		handleEvent_document_touch_move: function(e){
			if(bge.selectBox.selecting){
				//selecting
				var selrect = {
					x: bge.selectBox.start.x < bge.mouseScroll.mousePos.x ? bge.selectBox.start.x : bge.mouseScroll.mousePos.x,
					y: bge.selectBox.start.y < bge.mouseScroll.mousePos.y ? bge.selectBox.start.y : bge.mouseScroll.mousePos.y,
					w: Math.abs(bge.selectBox.start.x - bge.mouseScroll.mousePos.x),
					h: Math.abs(bge.selectBox.start.y - bge.mouseScroll.mousePos.y)
				};
				$("#selectbox")
					.css("-webkit-transform", "translate3d(" +selrect.x+ "px, " +selrect.y+ "px, 0px)")
					.css("width", selrect.w+"px")
					.css("height", selrect.h+"px");
				
				//selection
				for(var i=0; i<bge.Piece.all.length; i++){
					var wasSelected = false;
					for(var i2=0; i2<bge.selectBox.startItems.length; i2++)
						if(bge.Piece.all[i].id === bge.selectBox.startItems[i2].id){
							wasSelected = true;
							break;
						}
						
					var prect = {
						x: bge.Piece.all[i].el.offset().left,
						y: bge.Piece.all[i].el.offset().top,
						w: bge.Piece.all[i].el.width() * bge.getzoommult(),
						h: bge.Piece.all[i].el.height() * bge.getzoommult()
					};
					if(rectanglesIntersect(selrect, prect)){
						//find if we were selecting this already
						if(wasSelected)
							bge.Piece.all[i].deselect();
						else
							bge.Piece.all[i].select();
					}
					else
						if(!wasSelected)
							bge.Piece.all[i].deselect();
						else
							bge.Piece.all[i].select();
				}
			}
		},
		handleEvent_document_touch_end: function(e){
			if(bge.selectBox.selecting){
				bge.selectBox.selecting = false;
				$("#selectbox")
					.hide()
					.css("width", 0)
					.css("height", 0);
			}
		},
		start: {x:0, y:0},
		selecting: false,
		startItems: new Array()
	};
	bge.refreshMenu = function(){
		var slist = bge.Piece.getSelected();
		
		
		//TOP MENU
		//DUPLICATE
		var hide = false;
		for(var i=0; i<slist.length; i++)
			if(slist[i].attributes.indexOf("duplicate") < 0){
				hide = true;
				break;
			}
		if(hide)
			$("#controls .duplicate").hide();
		else
			if(slist.length > 0)
				$("#controls .duplicate").show();
			else
				$("#controls .duplicate").hide();
				
		//FLIP
		var hide = false;
		for(var i=0; i<slist.length; i++)
			if(slist[i].attributes.indexOf("flip") < 0){
				hide = true;
				break;
			}
		if(hide)
			$("#controls .flip").hide();
		else
			if(slist.length > 0)
				$("#controls .flip").show();
			else
				$("#controls .flip").hide();
			
		//DESTROY
		var hide = false;
		for(var i=0; i<slist.length; i++)
			if(slist[i].attributes.indexOf("destroy") < 0){
				hide = true;
				break;
			}
		if(hide)
			$("#controls .destroy").hide();
		else
			if(slist.length > 0)
				$("#controls .destroy").show();
			else
				$("#controls .destroy").hide();
				
		//SHUFFLE
		var hide = false;
		for(var i=0; i<slist.length; i++)
			if(slist[i].attributes.indexOf("shuffle") < 0){
				hide = true;
				break;
			}
		if(hide)
			$("#controls .shuffle").hide();
		else
			if(slist.length > 1)
				$("#controls .shuffle").show();
			else
				$("#controls .shuffle").hide();
				
		//FAN
		if(slist.length > 1)
			$("#controls .arrange_fan").show();
		else
			$("#controls .arrange_fan").hide();
			
		//SHUFFLE STACK	
		if(slist.length > 1)
			$("#controls .arrange_stack").show();
		else
			$("#controls .arrange_stack").hide();
			
		
		bge.contextMenu.refresh();
	}
	
	bge.contextMenu = {
		el: $("<ul/>").attr("id", "contextmenu"),
		init: function(){
			$("body").append(
				bge.contextMenu.el
					.append( bge.contextMenu.items.flip )
					.append( bge.contextMenu.items.shuffle ) 
					.append( bge.contextMenu.items.spacer_movements ) 
					.append( bge.contextMenu.items.arrange_fan ) 
					.append( bge.contextMenu.items.arrange_stack )
			);
		},
		refresh: function(){
			var slist = bge.Piece.getSelected();
		
			bge.contextMenu.items.spacer_movements.hide();
			
			//FLIP
			bge.contextMenu.items.flip.hide();
			for(var i=0; i<slist.length; i++)
				if(slist[i].attributes.indexOf("flip") >= 0){
					bge.contextMenu.items.flip.show();
					break;
				}
					
			//SHUFFLE
			bge.contextMenu.items.shuffle.hide();
			for(var i=0; i<slist.length; i++)
				if(slist[i].attributes.indexOf("shuffle") >= 0){
					bge.contextMenu.items.shuffle.show();
					break;
				}
					
			//FAN
			if(slist.length > 1)
				bge.contextMenu.items.arrange_fan.show();
			else
				bge.contextMenu.items.arrange_fan.hide();
				
			//SHUFFLE STACK	
			if(slist.length > 1)
				bge.contextMenu.items.arrange_stack.show();
			else
				bge.contextMenu.items.arrange_stack.hide();
				
			
			//SHOW DIVIDER
			if(	(
					bge.contextMenu.items.flip.css("display") != "none" ||
					bge.contextMenu.items.shuffle.css("display") != "none"
				) &&
				(
					bge.contextMenu.items.arrange_fan.css("display") != "none" ||
					bge.contextMenu.items.arrange_stack.css("display") != "none"
				) )
				bge.contextMenu.items.spacer_movements.show();
		},
		show: function(){
			if(bge.contextMenu.itemsVisible().length > 0)
				bge.contextMenu.el.show();
			else
				bge.contextMenu.el.hide();	
		},
		hide: function(){
			bge.contextMenu.el.hide();
		},
		itemsVisible: function(){
			var items = new Array();
			
			if(bge.contextMenu.items.flip.css("display") != "none")
				items.push(bge.contextMenu.items.flip);
			if(bge.contextMenu.items.shuffle.css("display") != "none")
				items.push(bge.contextMenu.items.shuffle);
			if(bge.contextMenu.items.spacer_movements.css("display") != "none")
				items.push(bge.contextMenu.items.spacer_movements);
			if(bge.contextMenu.items.arrange_fan.css("display") != "none")
				items.push(bge.contextMenu.items.arrange_fan);
			if(bge.contextMenu.items.arrange_stack.css("display") != "none")
				items.push(bge.contextMenu.items.arrange_stack);
				
			return items;
		},
		items: {
			flip: $("<li/>")
				.addClass("flip")
				.text("Flip")
				.on(touch_start, function(e){
					if(	touch_start === "touchstart" || e.which === 1){
						var slist = bge.Piece.getSelected();
						var dontdoit = false;
						for(var i=0; i<slist.length; i++)
							if(slist[i].attributes.indexOf("flip") < 0){
								dontdoit = true;
								break;
							}
						if(!dontdoit)
							for(var i=0; i<slist.length; i++){
								var p = slist[i];
								p.flip();
								
								//communicate to network
								bge.Network.emit("piece_flip", {
									oursocketid: bge.Network.ourSocketId,
									id: p.id,
									isFlipped: p.isFlipped()
								});
							}
						
						e.preventDefault();
						e.stopPropagation();
						bge.contextMenu.hide();
					}
				}),
			shuffle: $("<li/>")
				.addClass("shuffle")
				.text("Shuffle")
				.on(touch_start, function(e){
					if(	touch_start === "touchstart" || e.which === 1){
						var slist = bge.Piece.getSelected();
						var dontdoit = false;
						for(var i=0; i<slist.length; i++)
							if(slist[i].attributes.indexOf("shuffle") < 0){
								dontdoit = true;
								break;
							}
						if(!dontdoit)
							bge.Piece.shuffleSelected();
						
						e.preventDefault();
						e.stopPropagation();
						bge.contextMenu.hide();
					}
				}),
			spacer_movements: $("<li/>").addClass("spacer"),
			arrange_fan: $("<li/>")
				.addClass("arrange_fan")
				.text("Arrange Fan")
				.on(touch_start, function(e){
					if(	touch_start === "touchstart" || e.which === 1){
						bge.Piece.arrangeFanned();
						
						e.preventDefault();
						e.stopPropagation();
						bge.contextMenu.hide();
					}
				}),
			arrange_stack: $("<li/>")
				.addClass("arrange_stack")
				.text("Arrange Stacked")
				.on(touch_start, function(e){
					if(	touch_start === "touchstart" || e.which === 1){
						
						bge.Piece.arrangeStacked();
						
						e.preventDefault();
						e.stopPropagation();
						bge.contextMenu.hide();
					}
				})
		}
	};
	
	
	bge.viewer = {
		window: undefined,
		maxSize: {w: 350, h: 570},
		setTarget: function( _piece ){
			if(_piece === undefined){
				$("#"+ bge.viewer.window.el.attr("id") +" .image").parent()
					.css({
						"width": "150px",
						"height": "0px"
					})
				$("#"+ bge.viewer.window.el.attr("id") +" .image")
					.css({
						"background-image": ""
					})
			}else{
				$("#"+ bge.viewer.window.el.attr("id") +" .image").parent()
					.css({
						"width": (parseInt(_piece.el.css("width"),10)*2) +"px",
						"height": (parseInt(_piece.el.css("height"),10)*2) +"px",
					});
				$("#"+ bge.viewer.window.el.attr("id") +" .image")
					.css({
						"background-image": _piece.el.css("background-image"),
						"background-size": _piece.el.css("background-size"),
					});
			}
		}
	};
	
	
	bge.init = function(){
		//get cookies
		bge.settings.interface.zoomWithScroll = $.cookie("bge_settings_interface_zoomWithScroll") === "true";
		bge.settings.interface.panScreenEdge = $.cookie("bge_settings_interface_panScreenEdge") === "true";
		bge.settings.connection.address = $.cookie("bge_settings_connection_address");
		bge.settings.connection.username = $.cookie("bge_settings_connection_username");
		
		
		//create windows
		function windowRollerContent(_id){
			return $("<div/>")
				.css({
					"width": "240px",
					"height": "200px"
				})
				.append(
					$("<div/>")
						.attr("id", _id+ "_button")
						.addClass("button")
						.css({
							"height": "192px",
							"line-height": "192px"
						})
						.text("roll")
						.on(touch_start, function(e){
							var result = "";
							var id = $(this).attr("id");
							id = id.replace("_button", "");
							
							switch(id){
								case "diceroller_coin":
									result = Math.floor(Math.random()*2);
									if(result == 0)
										result = "heads";
									else
										result = "tails";
									break;
									
								case "diceroller_d4":
									result = 1+Math.floor(Math.random()*4);
									break;
									
								case "diceroller_d6":
									result = 1+Math.floor(Math.random()*6);
									break;
									
								case "diceroller_d8":
									result = 1+Math.floor(Math.random()*8);
									break;
									
								case "diceroller_d10":
									result = 1+Math.floor(Math.random()*10);
									break;
									
								case "diceroller_d12":
									result = 1+Math.floor(Math.random()*12);
									break;
									
								case "diceroller_d20":
									result = 1+Math.floor(Math.random()*20);
									break;
									
								case "diceroller_percent":
									result = Math.floor(Math.random()*10);
									result = "" + result + "0";
									break;
							}
							
							var d = new Date();
							var datestr = pad(d.getHours(),2) +":"+ pad(d.getMinutes(),2) +":"+ pad(d.getSeconds(),2);
							
							$("#" +id+ "_result").prepend( 
								$("<p/>").append(
									$("<span/>").text(result)
								).append(
									$("<span/>")
										.text(" at "+ datestr)
										.css({
											"color": "#ccc",
											"font-size": ".8em",
										})
								)
							);
							
							//communicate to network
							bge.Network.emit("window_roller_roll", {
								rollId: id,
								result: result,
								datestr: datestr
							});
						})
				).append(
					$("<div/>")
						.css({
							"display": "inline-block",
							"vertical-align": "top",
							"height": "200px",
							"width": "190px",
							"overflow": "scroll",
							"float": "right"	
						})
						.attr("id", _id+ "_result")
						.on("mousewheel", function(e){
							e.stopPropagation();
						})
				);
		}
		(bge.Window.new({
			id: "window_roller",
			titlebar: {
				sysbuttons: [
					"close"
				],
				title: "Dice Roller",
				tabs: [
					{
						text: "Coin",
						class: "coin"
					},
					{
						text: "d4",
						class: "d4"
					},
					{
						text: "d6",
						class: "d6"
					},
					{
						text: "d8",
						class: "d8"
					},
					{
						text: "d10",
						class: "d10"
					},
					{
						text: "d12",
						class: "d12"
					},
					{
						text: "d20",
						class: "d20"
					},
					{
						text: "d%",
						class: "percent"
					}
				]
			},
			content: [
				{
					tabClass: "coin",
					content: windowRollerContent("diceroller_coin")
				},
				{
					tabClass: "d4",
					content: windowRollerContent("diceroller_d4")
				},
				{
					tabClass: "d6",
					content: windowRollerContent("diceroller_d6")
				},
				{
					tabClass: "d8",
					content: windowRollerContent("diceroller_d8")
				},
				{
					tabClass: "d10",
					content: windowRollerContent("diceroller_d10")
				},
				{
					tabClass: "d12",
					content: windowRollerContent("diceroller_d12")
				},
				{
					tabClass: "d20",
					content: windowRollerContent("diceroller_d20")
				},
				{
					tabClass: "percent",
					content: windowRollerContent("diceroller_percent")
				}
			]
		})).el.hide();
		(bge.Window.new({
			id: "window_connection",
			titlebar: {
				sysbuttons: [
					"close"
				],
				title: "Connection",
				tabs: []
			},
			content: [
				{
					tabClass: "",
					content: $("<div/>")
						.css({
							"width": "300px",
							"height": "200px"
						})
						.append(
							$("<div/>")
								.css({
									"padding": "5px 0px 9px",
									"border-bottom": "double 3px #ccc"
								})
								.append(
									$("<div/>")
										.addClass("button")
										.text("Connect")
										.on(touch_start, function(e){
											var address = $("#connectionwindow_address").val();
											bge.Network.connectTo(address);
											bge.Network.ourName = $("#connectionwindow_name").val();
										})
								)/*.append(
									$("<input/>")
										.attr("id", "connectionwindow_address")
										.attr("type", "text")
										.attr("placeholder", "address")
										.val("71.201.26.102")
										.css({
											"width": "100px",
											"margin": "0 0 0 5px"
										})
								)*/.append(
									$("<select/>")
										.css({
											"width": "100px",
											"margin": "0 0 0 5px"
										})
										.attr("id", "connectionwindow_address")
										.append(
											$("<option/>")
												.val("71.201.26.102")
												.text("Remote")
										)
										.append(
											$("<option/>")
												.val("10.0.0.8")
												.text("Same network")
										)
										.append(
											$("<option/>")
												.val("localhost")
												.text("Localhost")
										)
										.val(bge.settings.connection.address)
										.on("change", function(e){
											bge.settings.connection.address = $(this).val();
											$.cookie("bge_settings_connection_address", bge.settings.connection.address);
											e.stopPropagation();
										})
								)/*.append(
									$("<input/>")
										.attr("id", "connectionwindow_name")
										.attr("type", "text")
										.attr("placeholder", "username")
										.css({
											"width": "100px",
											"margin": "0 0 0 5px"
										})
								)*/.append(
									$("<select/>")
										.css({
											"width": "100px",
											"margin": "0 0 0 5px"
										})
										.attr("id", "connectionwindow_name")
										.append(
											$("<option/>")
												.val("Guest")
												.text("Guest")
										)
										.append(
											$("<option/>")
												.val("DanO")
												.text("DanO")
										)
										.append(
											$("<option/>")
												.val("Eggzavier")
												.text("Eggzavier")
										)
										.append(
											$("<option/>")
												.val("Ruluzz")
												.text("Ruluzz")
										)
										.append(
											$("<option/>")
												.val("SlyFive")
												.text("SlyFive")
										)
										.val(bge.settings.connection.username)
										.on("change", function(e){
											bge.settings.connection.username = $(this).val();
											$.cookie("bge_settings_connection_username", bge.settings.connection.username);
											e.stopPropagation();
										})
								)
						).append(
							$("<div/>")
								.css({
									"padding": "5px 0",
									"overflow": "scroll",
									"font-size": "11px",
									"height": "150px",
								})
								.attr("id", "connectionwindow_console")
								.on("mousewheel", function(e){
									e.stopPropagation();
								})
						)
				}
			]
		})).el.hide();
		(bge.Window.new({
			id: "window_settings",
			titlebar: {
				sysbuttons: [
					"close"
				],
				title: "Settings",
				tabs: []
			},
			content: [
				{
					tabClass: "",
					content: $("<div/>")
						.css({
							"width": "300px",
							"height": "200px"
						})
						.append(
							$("<ul/>")
								.css({
									"list-style": "none"	
								})
								.append(
									$("<li/>")
										.addClass("check")
										.append(
											$("<input/>")
												.attr("type", "checkbox")
												.attr("id", "setting_mouseScrollZoom")
												.prop("checked", bge.settings.interface.zoomWithScroll)
												.on("change", function(e){
													bge.settings.interface.zoomWithScroll = $(this).is(":checked");
													$.cookie("bge_settings_interface_zoomWithScroll", bge.settings.interface.zoomWithScroll);
													e.stopPropagation();
												})
										)
										.append(
											$("<label/>")
												.attr("for", "setting_mouseScrollZoom")
												.text("Zoom with Scroll button")
										)
								)
								.append(
									$("<li/>")
										.addClass("check")
										.append(
											$("<input/>")
												.attr("type", "checkbox")
												.attr("id", "setting_panScreenEdge")
												.prop("checked", bge.settings.interface.panScreenEdge)
												.on("change", function(e){
													bge.settings.interface.panScreenEdge = $(this).is(":checked");
													$.cookie("bge_settings_interface_panScreenEdge", bge.settings.interface.panScreenEdge);
													e.stopPropagation();
												})
										)
										.append(
											$("<label/>")
												.attr("for", "setting_panScreenEdge")
												.text("Pan at screen edge")
										)
								)
						)
				}
			]
		})).el.hide();
		bge.viewer.window = bge.Window.new({
			id: "window_viewer",
			titlebar: {
				sysbuttons: [
					"close"
				],
				title: "Viewer",
				tabs: []
			},
			content: [
				{
					tabClass: "",
					content: $("<div/>")
						.css({
							"width": "150px",
							"height": "0"
						})
						.append(
							$("<div/>")
								.addClass("image")
								.css({
									"width": "100%",
									"height": "100%",
									"background-repeat": "no-repeat",
									"background-size": "auto 100%",
									"background-position": "100% 0"	
								})
						)
				}
			]
		});
		bge.viewer.window.el.hide();
		
		
		//add shit to other shit
		$("body").append(
			$("<ul/>")
				.attr("id", "controls")
				.append(
					$("<li/>")
						.css({
							"float": "left"
						})
						.append(
							$("<ul/>")	
								.append(
									$("<li/>").addClass("spacer")
								).append(
									$("<li/>")
										.addClass("zoomout")
										.append(
											$("<p/>").text("-")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												bge.adjustzoom(-1);
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>")
										.addClass("zoomin")
										.append(
											$("<p/>").text("+")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												bge.adjustzoom(1);
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>")
										.addClass("origin")
										.append(
											$("<p/>").text("O")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												$("#game").css("-webkit-transform", "translate3d(0px, 0px, 0px)");
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>")
										.addClass("rulebook")
										.append(
											$("<p/>").text("Rules")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												window.open("data/" +bge.curgame+ "/rules.pdf", "", "");
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>").addClass("spacer doubleline")
								).append(
									$("<li/>")
										.addClass("textbox")
										.append(
											$("<p/>").text("Text")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												bge.Window.new({
													titlebar: {
														sysbuttons: [
															"close"
														],
														title: "Text",
														tabs: [],
													},
													content: [
														{
															tabClass: "",
															content: $("<div/>")
																.text("Yay!")
																.css("width", "100px")
																.css("height", "100px")
														}
													]
												});
												
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
										.css("display", "none")
								).append(
									$("<li/>")
										.addClass("roller")
										.append(
											$("<p/>").text("Roller")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var id = parseInt( $("#window_roller").attr("rel") ,10);
												var w = bge.Window.getWithId( id );
												w.open();
												w.focus();
										
												//communicate to network
												bge.Network.emit("window_open", {
													winid: "window_roller"
												});
											
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>")
										.addClass("cardviewer")
										.append(
											$("<p/>").text("Card Viewer")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var id = parseInt( $("#window_viewer").attr("rel") ,10);
												var w = bge.Window.getWithId( id );
												w.open();
												w.focus();
										
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>").addClass("spacer doubleline")
								).append(
									$("<li/>")
										.addClass("duplicate")
										.append(
											$("<p/>").text("Duplicate")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var slist = bge.Piece.getSelected();
												var dontdoit = false;
												for(var i=0; i<slist.length; i++)
													if(slist[i].attributes.indexOf("duplicate") < 0){
														dontdoit = true;
														break;
													}
												if(!dontdoit)
													for(var i=0; i<slist.length; i++)
														slist[i].duplicate();
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
										.hide()
								).append(
									$("<li/>")
										.addClass("destroy")
										.append(
											$("<p/>").text("Destroy")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var slist = bge.Piece.getSelected();
												var dontdoit = false;
												for(var i=0; i<slist.length; i++)
													if(slist[i].attributes.indexOf("destroy") < 0){
														dontdoit = true;
														break;
													}
												if(!dontdoit)
													for(var i=0; i<slist.length; i++)
														slist[i].destroy();
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
										.hide()
								).append(
									$("<li/>")
										.addClass("flip")
										.append(
											$("<div/>").append(
												$("<div/>")
													.css("background-image", "url(images/icon_flip.png)")
													.css("width", "22px")
											)
											.addClass("img")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var slist = bge.Piece.getSelected();
												var dontdoit = false;
												for(var i=0; i<slist.length; i++)
													if(slist[i].attributes.indexOf("flip") < 0){
														dontdoit = true;
														break;
													}
												if(!dontdoit)
													for(var i=0; i<slist.length; i++){
														var p = slist[i];
														p.flip();
														
														//communicate to network
														bge.Network.emit("piece_flip", {
															oursocketid: bge.Network.ourSocketId,
															id: p.id,
															isFlipped: p.isFlipped()
														});
													}
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
										.hide()
								).append(
									$("<li/>")
										.addClass("shuffle")
										.append(
											$("<div/>").append(
												$("<div/>")
													.css("background-image", "url(images/icon_shuffle.png)")
													.css("width", "22px")
											)
											.addClass("img")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var slist = bge.Piece.getSelected();
												var dontdoit = false;
												for(var i=0; i<slist.length; i++)
													if(slist[i].attributes.indexOf("shuffle") < 0){
														dontdoit = true;
														break;
													}
												if(!dontdoit)
													bge.Piece.shuffleSelected();
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
										.hide()
								).append(
									$("<li/>")
										.addClass("arrange_fan")
										.append(
											$("<div/>").append(
												$("<div/>")
													.css("background-image", "url(images/icon_arrange_fan.png)")
													.css("width", "22px")
											)
											.addClass("img")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												bge.Piece.arrangeFanned();
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
										.hide()
								).append(
									$("<li/>")
										.addClass("arrange_stack")
										.append(
											$("<div/>").append(
												$("<div/>")
													.css("background-image", "url(images/icon_arrange_stack.png)")
													.css("width", "13px")
											)
											.addClass("img")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												bge.Piece.shuffleSelected();
												var slist = bge.Piece.getSelected();
												for(var i=0; i<slist.length; i++)
													if(!slist[i].isFlipped()){
														var p = slist[i];
														p.flip();
														
														//communicate to network
														bge.Network.emit("piece_flip", {
															oursocketid: bge.Network.ourSocketId,
															id: p.id,
															isFlipped: p.isFlipped()
														});
													}
												bge.Piece.arrangeStacked();
												
												e.preventDefault();
												e.stopPropagation();
											}
										})
										.hide()
								)
						)
				)
				.append(
					$("<li/>")
						.css({
							"float": "right"
						})
						.append(
							$("<ul/>")
								.append(
									$("<li/>")
										.addClass("settings")
										.append(
											$("<p/>").text("Settings")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var id = parseInt( $("#window_settings").attr("rel") ,10);
												var w = bge.Window.getWithId( id );
												w.open();
												w.focus();
											
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>")
										.addClass("connection")
										.append(
											$("<p/>").text("Connection")
										)
										.on(touch_start, function(e){
											if(	touch_start === "touchstart" || e.which === 1){
												var id = parseInt( $("#window_connection").attr("rel") ,10);
												var w = bge.Window.getWithId( id );
												w.open();
												w.focus();
											
												e.preventDefault();
												e.stopPropagation();
											}
										})
								).append(
									$("<li/>")
										.addClass("spacer")
								)
						)
				)
		).append(
			$("<div/>")
				.attr("id", "selectbox")
				.hide()
		).append(
			$("<ul/>")
				.attr("id", "users")
				.append(
					$("<li/>")
						.append(
							$("<div/>")
						)
						.append(
							$("<p/>")
								.text("You")
						)
				)
		);
		
		bge.contextMenu.init();
		
		
		//prevent backing
		$(window).on("beforeunload", function(){
			return "You are about to disconnection.";
		});	
		
		//keys and scrolling
		$(document)
			.on("keyup", function(e) {
				bge.shiftDown = false;
			})
			.on("keydown", function(e) {
				console.log(e.keyCode);
				
				var go = getTransform($("#game"));
				switch(e.keyCode){
					case 189:	//-
						bge.adjustzoom(-1);
						break;
						
					case 187:	//=
						bge.adjustzoom(1);
						break;
						
					case 37:	//left
						$("#game").css("-webkit-transform", "translate3d(" +(go.x+100)+ "px, " +go.y+ "px, 0)");
						break;
						
					case 39:	//right
						$("#game").css("-webkit-transform", "translate3d(" +(go.x-100)+ "px, " +go.y+ "px, 0)");
						break;
						
					case 38:	//up
						$("#game").css("-webkit-transform", "translate3d(" +go.x+ "px, " +(go.y+100)+ "px, 0)");
						break;
						
					case 40:	//down
						$("#game").css("-webkit-transform", "translate3d(" +go.x+ "px, " +(go.y-100)+ "px, 0)");
						break;
						
					case 16:	//shift key
						bge.shiftDown = true;
						break;
						
					case 68:	//d
						var slist = bge.Piece.getSelected();
						var dontdoit = false;
						for(var i=0; i<slist.length; i++)
							if(slist[i].attributes.indexOf("duplicate") < 0){
								dontdoit = true;
								break;
							}
						if(!dontdoit)
							for(var i=0; i<slist.length; i++)
								slist[i].duplicate();
						break;
						
					case 70:	//f
						var slist = bge.Piece.getSelected();
						var dontdoit = false;
						for(var i=0; i<slist.length; i++)
							if(slist[i].attributes.indexOf("flip") < 0){
								dontdoit = true;
								break;
							}
						if(!dontdoit)
							for(var i=0; i<slist.length; i++){
								var p = slist[i];
								p.flip();
								
								//communicate to network
								bge.Network.emit("piece_flip", {
									oursocketid: bge.Network.ourSocketId,
									id: p.id,
									isFlipped: p.isFlipped()
								});
							}
						break;
						
					case 83:	//s
						var slist = bge.Piece.getSelected();
						var dontdoit = false;
						for(var i=0; i<slist.length; i++)
							if(slist[i].attributes.indexOf("shuffle") < 0){
								dontdoit = true;
								break;
							}
						if(!dontdoit)
							bge.Piece.shuffleSelected();
						break;
						
					case 65:	//a
						bge.Piece.arrangeSmart();
						break;
						
					case 8:		//backspace
						var slist = bge.Piece.getSelected();
						if(slist.length > 0){
							var dontdoit = false;
							for(var i=0; i<slist.length; i++)
								if(slist[i].attributes.indexOf("destroy") < 0){
									dontdoit = true;
									break;
								}
							if(!dontdoit)
								for(var i=0; i<slist.length; i++)
									slist[i].destroy();
							
							e.preventDefault();
						}
						
						break;
				}
			})
			.on("mousewheel", function(e){
				var wheeldelta = {
					x: e.originalEvent.wheelDeltaX,
					y: e.originalEvent.wheelDeltaY
				};
				
				if(bge.settings.interface.zoomWithScroll){
					var go = getTransform($("#game"));
					var z = bge.getzoommult();
					var target = {
						x: parseInt(   (-go.x + e.pageX) * (1/z)  ,10),
						y: parseInt(   (-go.y + e.pageY) * (1/z)   ,10),	
					};
					if(wheeldelta.y > 0){
						bge.adjustzoom(-1, "mouse");
					}
					else{
						bge.adjustzoom(1, "mouse");
					}
				}else{
					var go = getTransform($("#game"));
					$("#game").css("-webkit-transform", "translate3d(" +(go.x+wheeldelta.x)+ "px, " +(go.y+wheeldelta.y)+ "px, 0)");
					
					bge.centerCamToVP();
				}
			})
			.on("contextmenu", function(e) {
				    bge.contextMenu.el.css({
				        top: e.pageY+'px',
				        left: e.pageX+'px'
				    });
				    bge.contextMenu.show();
				    
				    return false;
				})
			.on("mousemove", function(e){
				var go = getTransform($("#game"));
				var z = bge.getzoommult();
				var target = {
					x: parseInt(   (-go.x + e.pageX) * (1/z)  ,10),
					y: parseInt(   (-go.y + e.pageY) * (1/z)   ,10),	
				};
				$("#mouse").css("-webkit-transform", "translate3d(" +(target.x)+ "px, " +(target.y)+ "px, 0)");
			});
		
		
		//touch, dragging, release
		$(document)
			.on("mouseleave", function(e){
				bge.mouseScroll.handleEvent_document_mouseleave(e);
			})
			.on(touch_start, function(e){
				if(	touch_start === "touchstart" || e.which === 1)
			    	bge.contextMenu.hide();
				
				
				bge.Piece.handleEvent_document_touch_start(e);
				bge.Window.handleEvent_document_touch_start(e);
				bge.mouseScroll.handleEvent_document_touch_start(e);
				bge.selectBox.handleEvent_document_touch_start(e);
			})
			.on(touch_move, function(e){
				bge.Piece.handleEvent_document_touch_move(e);
				bge.Window.handleEvent_document_touch_move(e);
				bge.mouseScroll.handleEvent_document_touch_move(e);
				bge.selectBox.handleEvent_document_touch_move(e);
				
				
				e.preventDefault(); //forces no page scroll
			})
			.on(touch_end, function(e){
				bge.Piece.handleEvent_document_touch_end(e);
				bge.Window.handleEvent_document_touch_end(e);
				bge.mouseScroll.handleEvent_document_touch_end(e);
				bge.selectBox.handleEvent_document_touch_end(e);
			});
			
			
		//jump into play game... can make a menu to do other things instead in the future
		bge.playgame.open();
	},
	bge.mainmenu = {
		open: function(){
			$("body").append(
				$("<div/>")
					.attr("id", "mainmenu")
					.append(
						$("<div/>")
							.addClass("dialog")
							.append(
								$("<div/>")
									.addClass("button playgame")
									.text("Play Game")
									.on("click", function(e){
										bge.mainmenu.close();
										bge.playgame.open();
									})
							)
					)
			);
		},
		close: function(){
			$("#mainmenu").remove();
		}
	};
	bge.curgame = "";
	bge.playgame = {
		open: function(){
			bge.curgame = "bsg_1";
			
			//load from file
			$("body").append(
				$("<div/>")
					.attr("id", "game")
					.append(
						$("<div/>")
							.attr("id", "pieces")
							.append(
								$("<div/>")
									.attr("id", "user_stashes")
									.css("position", "absolute")
							)
							.append(
								$("<div/>")
									.attr("id", "table")
									.css("background-image", "url(data/" +bge.curgame+ "/images/table-bg.jpg)")
							)
							.append(
								$("<div/>")
									.attr("id", "camera")
									.css("-webkit-transform", "translate3d(" +(get_viewportSize().w/2)+ "px, " +(get_viewportSize().h/2)+ "px, 0)")
							)
							.append(
								$("<div/>")
									.attr("id", "mouse")
							)
					)
			);
			$.getJSON("data/"+ bge.curgame +"/pieces.json", function(gdata){
				$("#table")
					.css("width", gdata.table.size.w)
					.css("height", gdata.table.size.h);
			
				for(var pli=0; pli<gdata.pieces.length; pli++){
					var piecedata = gdata.pieces[pli];
					
					piecedata.placement = "placement" in piecedata ? piecedata.placement : {};
					var placement = piecedata.placement;
					placement.count = "count" in piecedata.placement ? piecedata.placement.count : 1;
					placement.xstep = "xstep" in piecedata.placement ? piecedata.placement.xstep : 30;
					placement.ystep = "ystep" in piecedata.placement ? piecedata.placement.ystep : 30;
					placement.cols = "cols" in piecedata.placement ? piecedata.placement.cols : 10;
					
					for(var ci=0; ci<placement.count; ci++){
						var p = bge.Piece.new(piecedata);
						var rownum = Math.floor(ci / placement.cols);
						
						var offset = {
							x: placement.xstep*(ci%placement.cols),
							y: placement.ystep*rownum
						};
						
						var peo = getTransform(p.el);
						p.el.css("-webkit-transform", "translate3d(" +(peo.x+offset.x)+ "px, " +(peo.y+offset.y)+ "px, 0)");
					}
				}
				
				
				//add textboxes to board
				for(var i=0; i<4; i++){
					$("#pieces").prepend(
						$("<div/>")
							.attr("id", "textregion_"+i)
							.css({
								"position": "absolute",
							    "width": "110px",
							    "height": "60px",
							    "z-index": "1000",   
							    "-webkit-transform": "translate3d("+ (1260+i*190) +"px, 580px, 0px)",
							    "background": "#fff",
							    "box-shadow": "0 0 10px 5px #000"
							})
							.append(
								$("<input/>")
									.attr("type", "text")
									.css({
									    "text-align": "center",
									    "width": "100%",
									    "font-size": "50px",
									    "padding": "0",
									    "margin": "0",
									    "border": "0",
									    "height": "100%"
									})
									.val("00")
									.on("input", function(e){
										//communicate to network
										bge.Network.emit("textregion_change", {
											oursocketid: bge.Network.ourSocketId,
											winid: $(this).parent().attr("id"),
											val: $(this).val(),
										});
									})
							)
					);
				}
			});
			
			
			
			$("#game").css("-webkit-transform", "translate3d(0px, 0px, 0)");
			bge.adjustzoom(0);
		},
		close: function(){
		}
	};
	
	
	bge.Network = {
		hasConnection: false,
		connection: undefined, //socket.io connection
		connectionAddress: "",
		ourSocketId: "",
		ourName: "",
		emit: function(_type, _data){
			if(!bge.Network.hasConnection) return false; //return if no connection
			
			bge.Network.connection.emit(_type, _data);
			console.log("SENDING PACKET OF TYPE: "+ _type);
		
			return true;
		},
		connectTo: function(_ip){
			var address = "http://" +_ip +":10000/";
			
			bge.Network.connectionAddress = address;
			$("#connectionwindow_console").prepend(
				$("<p/>").text("Starting connection to " +bge.Network.connectionAddress+ ".")
			);
			
			bge.Network.connection = io.connect(address);
			bge.Network.connection.socket
				.on("connect", function(){
					//setup socket & user
					bge.Network.hasConnection = true;
					bge.Network.ourSocketId = this.sessionid;
					var previousSocketId = $.cookie("bge_user_socketId");
					$.cookie("bge_user_socketId", this.sessionid);
					
					bge.Network.connection.emit("user_init", {
						socketId: bge.Network.ourSocketId,
						previousSocketId: previousSocketId,
						name: bge.Network.ourName
					});
					
					
					$("#connectionwindow_console").prepend(
						$("<p/>").css("color", "#3A0").text("Successful connection to " +bge.Network.connectionAddress+ ".")
					);
				})
				.on("disconnect", function(){
					bge.Network.hasConnection = false;
					
					$("#connectionwindow_console").prepend(
						$("<p/>").text("Disconnected from " +bge.Network.connectionAddress+ ".")
					);
				})
				.on('error', function (data) {
					bge.Network.hasConnection = false;
					
					$("#connectionwindow_console").prepend(
						$("<p/>").css("color", "#A30").text("Failed connection to " +bge.Network.connectionAddress+ ".")
					);
					console.log(data);
			    })
				.on('connect_failed', function (data) {
					bge.Network.hasConnection = false;
					
					$("#connectionwindow_console").prepend(
						$("<p/>").css("color", "#A30").text("Failed connection to " +bge.Network.connectionAddress+ ". Possible handshake error?")
					);
					console.log(data);
			    });
			bge.Network.connection
				.on("piece_move", function(_data){
					var p = bge.Piece.getWithId(_data.id);
					
					p.moveTo(_data.x, _data.y);
				})
				.on("piece_flip", function(_data){
					var p = bge.Piece.getWithId(_data.id);
					
					if(p.isFlipped() !== _data.isFlipped)
						p.flip();
				})
				.on("piece_shuffle", function(_data){
					var p = bge.Piece.getWithId(_data.id);
					
					p.el.css("z-index", _data.zindex);
					p.el.css("-webkit-transform", "translate3d("+ _data.x +"px, "+ _data.y +"px, 0px)");
				})
				.on("piece_zindexchange", function(_data){
					var p = bge.Piece.getWithId(_data.id);
					
					p.el.css("z-index", _data.zindex);
				})
				.on("piece_select", function(_data){
					var p = bge.Piece.getWithId(_data.id);
					console.log("piece_select request");
					p.el.css({
						"border": "6px dashed "+_data.color,
						"top": "-6px",
						"left": "-6px",
					});
				})
				.on("piece_deselect", function(_data){
					var p = bge.Piece.getWithId(_data.id);
					
					p.el.css({
						"border": "",
						"top": "0",
						"left": "0",
					});
				})
				.on("user_listing", function(_data){
					//THIS FUNCTION COMPLETELY DESTROYS AND REBUILDS
					//THE ARRAYS AND USER ELEMENTS. INSTEAD WE SHOULD
					//BE TRYING TO UPDATE USERS & ELEMENTS AS THEY COME
					//I.E. REMOVE IF DISCONNECT, ADD IF CONNECT, ETC
					bge.User.all = new Array();
					for(var i=0; i<_data.length; i++){
						var ui = _data[i];
						
						var user = bge.User.new({
							socketId: ui.socketId,
							color: ui.color,
							name: ui.name,
							connected: ui.connected
						});
					}
					
					
					//UPDATE USER LIST WIDGET
					$("#users").empty();
					for(var i=0; i<bge.User.all.length; i++){
						var user = bge.User.all[i];
						
						
						var name = user.name.toLowerCase();
						var bgimg = "";
						if(user.connected){
							switch(name){
								case "dano":
								case "ruluzz":
								case "slyfive":
								case "eggzavier":
									bgimg = "avatar_" +name+ ".jpg";
									break;
								
								default:
									bgimg = "avatar_default.jpg";
									break;
							}
							var boxshadow = "0px 0px 0px 1px #000, 0px 0px 0px 4px " +user.color+ ", 0px 1px 2px 4px #000";
						}
						else{
							bgimg = "avatar_disconnected.jpg";
							var boxshadow = "0px 0px 0px 1px #000, 0px 0px 0px 4px #BBB, 0px 1px 2px 4px #000";
						}
						$("#users").prepend(
							$("<li/>")
								.append(
									$("<div/>")
										.css({
											"background-image": "url(images/userimages/" +bgimg+ ")",
											"box-shadow": boxshadow
										})
								)
								.append(
									$("<p/>")
										.text(user.name)
								)
						);
					}
					
					
					//UPDATE STASHES
					$("#user_stashes").empty();
					for(var i=0; i<bge.User.all.length; i++){
						var user = bge.User.all[i];
				
						
						var pos = {
							x: 50 + ((i%6)*720),
							y: 2300 + (Math.floor(i/6)*800)
						};
						
						//add footprint
						$("#user_stashes").prepend(
							$("<div/>")
								.addClass("stash footprint")
								.css({
									"background-color": user.color,
									"-webkit-transform": "translate3d(" +pos.x+ "px, " +pos.y+ "px, 0px)",
								})
								.text("Your Stash")
						);
						
						//add cover
						if(user.socketId !== bge.Network.ourSocketId)
							$("#user_stashes").prepend(
								$("<div/>")
									.addClass("stash top")
									.css({
										"background-color": user.color,
										"-webkit-transform": "translate3d(" +pos.x+ "px, " +pos.y+ "px, 0px)",
									})
									.text(user.name)
							)
					}
				})
				.on("window_open", function(_data){
					var w = bge.Window.getWithId( parseInt($("#"+_data.winid).attr("rel"),10) );
					w.open();
				})
				.on("window_roller_roll", function(_data){
					$("#" +_data.rollId+ "_result").prepend( 
						$("<p/>").append(
							$("<span/>").text(_data.result)
						).append(
							$("<span/>")
								.text(" at "+ _data.datestr)
								.css({
									"color": "#ccc",
									"font-size": ".8em",
								})
						)
					);
				})
				.on("textregion_change", function(_data){
					$("#"+_data.winid).find("input").val(_data.val);
				});
		}
	};
	
	
		
		
		
		

	return bge;
}(bge || {}));
































































































				/*$("#game").stop().animate(
					{ 
						target_x: target.x, 
						target_y: target.y 
					}, 
					{
						step: function(now,fx) {
							if(fx.prop === "target_x")
								bge.mouseScroll.interval_anim_end.x = fx.now;
							if(fx.prop === "target_y")
								bge.mouseScroll.interval_anim_end.y = fx.now;
							$(this).css('-webkit-transform',"translate3d("+ bge.mouseScroll.interval_anim_end.x +"px, " + bge.mouseScroll.interval_anim_end.y + "px, 0px)");
						},
						duration: (1000.0/5)
					},'linear');*/

















































$(document).ready(function(){
	console.log("document ready");
	bge.init();
});




var isMobile = {
    android: navigator.userAgent.match(/Android/i) ? true : false,
    blackberry: navigator.userAgent.match(/BlackBerry/i) ? true : false,
    ios: navigator.userAgent.match(/iPhone|iPad|iPod/i) ? true : false,
    windows: navigator.userAgent.match(/IEMobile/i) ? true : false
};
isMobile.any = isMobile.android || isMobile.blackberry || isMobile.ios || isMobile.windows;
isMobile.androidVersion = parseFloat(navigator.userAgent.slice(navigator.userAgent.indexOf("Android")+8));
var touch_start = isMobile.android || isMobile.ios ? "touchstart" : "mousedown";
var touch_move = isMobile.android || isMobile.ios ? "touchmove" : "mousemove";
var touch_end = isMobile.android || isMobile.ios ? "touchend" : "mouseup";
function get_viewportSize(){
	var e = window, 
		a = 'inner';
	if ( !( 'innerWidth' in window ) ){
		a = 'client';
		e = document.documentElement || document.body;
	}
	return { 
		w: e[a+'Width'] , 
		h: e[a+'Height'] 
	}
}
function getTransform(el) {
    var matrix = el.css('-webkit-transform');
	var values = matrix.match(/-?[0-9\.]+/g);
	
    
    if(values == null)
    	values = [0,0,0,0,0,0];
    	
	if(values.length > 6){
		return {
			x: parseFloat(values[13]),
			y: parseFloat(values[14]),
			z: parseFloat(values[15]),
			matrix: matrix
		};
	}
	else{
		return {
			x: parseFloat(values[4]),
			y: parseFloat(values[5]),
			z: 0,
			matrix: matrix
		};
	}
    	
	return values;
}
function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};
function rectanglesIntersect( _a, _b ){
	return !(
		_a.x +_a.w 	< _b.x 			||	//a left of b
		_a.x 		> _b.x +_b.w 	||	//a right of b
		_a.y +_a.h 	< _b.y 			||	//a above b
		_a.y	 	> _b.y +_b.h		//a below b
	);
}
function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}