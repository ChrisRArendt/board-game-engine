
function BGE(){
	var _ = this;
	
	
	_.zoomlevel = 0;
	_.adjustzoom = function(z){
		//adjust zoom
		var lastzm = bge.getzoommult();
		var lastzl = bge.zoomlevel;
		bge.zoomlevel += z;
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
			
		
		
		
		
		//center on camera point
		var camo = $("#camera").offset(); //used to have to multiply x and y by scale
		var go = getTransform($("#game"));
		var newo = {
			x: go.x + (get_viewportSize().w/2) - camo.left,
			y: go.y + (get_viewportSize().h/2) - camo.top
		}
		
		$("#game").css("-webkit-transform", "translate3d(" +newo.x+ "px, " +newo.y+ "px, 0)");
	}
	_.getzoommult = function(){
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
	_.handscroll = false;
	_.scrollCursorOrigin = { x: 0, y: 0 };
	_.scrollGameOrigin = { x: 0, y: 0 };
	_.centerCamToVP = function(){
		var vp = get_viewportSize();
		var go = getTransform($("#game"));
		var z = bge.getzoommult();
		
		
		var target = {
			x: (vp.w/2 - go.x) * (1/z),
			y: (vp.h/2 - go.y) * (1/z)
		};
		$("#camera").css("-webkit-transform", "translate3d(" +(target.x)+ "px, " +(target.y)+ "px, 0)");
	}
	
	_.shiftDown = false;
	_.selectBoxStart = { x: 0, y: 0 };
	_.selectBoxing = false;
	_.selectStartItems = (new Array());
	_.refreshMenu = function(){
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
			
		
		//CONTEXT MENU
		//FLIP
		var hide = false;
		for(var i=0; i<slist.length; i++)
			if(slist[i].attributes.indexOf("flip") < 0){
				hide = true;
				break;
			}
		if(hide)
			$("#contextmenu .flip").hide();
		else
			if(slist.length > 0)
				$("#contextmenu .flip").show();
			else
				$("#contextmenu .flip").hide();
				
		//SHUFFLE
		var hide = false;
		for(var i=0; i<slist.length; i++)
			if(slist[i].attributes.indexOf("shuffle") < 0){
				hide = true;
				break;
			}
		if(hide)
			$("#contextmenu .shuffle").hide();
		else
			if(slist.length > 1)
				$("#contextmenu .shuffle").show();
			else
				$("#contextmenu .shuffle").hide();
				
		//FAN
		if(slist.length > 1)
			$("#contextmenu .arrange_fan").show();
		else
			$("#contextmenu .arrange_fan").hide();
			
		//SHUFFLE STACK	
		if(slist.length > 1)
			$("#contextmenu .arrange_stack").show();
		else
			$("#contextmenu .arrange_stack").hide();
	}
	
	_.init = function(){
		console.log("bge init");
		
		//create windows
		(new bge.Window({
			id: "window_roller",
			titlebar: {
				sysbuttons: [
					"close"
				],
				title: "Dice Roller",
				tabs: [
					/*{
						text: "Coin",
						class: "coin"
					},
					{
						text: "1-4",
						class: "d4"
					},
					{
						text: "1-6",
						class: "d6"
					},*/
					{
						text: "1-8",
						class: "d8"
					}/*,
					{
						text: "1-10",
						class: "d10"
					},
					{
						text: "1-12",
						class: "d12"
					},
					{
						text: "1-20",
						class: "d20"
					},
					{
						text: "00-90",
						class: "percent"
					}*/
				]
			},
			content: [
				/*{
					tabClass: "coin",
					content: $("<div/>")
						.css("width", "400px")
						.css("height", "200px")
						.text("Coin page!")
				},
				{
					tabClass: "d4",
					content: $("<div/>")
						.css("width", "400px")
						.css("height", "200px")
						.text("D4 page!")
				},
				{
					tabClass: "d6",
					content: $("<div/>")
						.css("width", "400px")
						.css("height", "200px")
						.text("D6 page!")
				},*/
				{
					tabClass: "d8",
					content: $("<div/>")
						.css({
							"width": "150px",
							"height": "200px"
						})
						.append(
							$("<div/>")
								.attr("id", "diceroller_d8_button")
								.addClass("button")
								.css({
									"height": "192px",
									"line-height": "192px"
								})
								.text("roll")
								.on("mousedown touchstart", function(e){
									var result = 1+Math.floor(Math.random()*8);
									var d = new Date();
									var datestr = pad(d.getHours(),2) +":"+ pad(d.getMinutes(),2) +":"+ pad(d.getSeconds(),2);
									
									$("#diceroller_d8_result").prepend( 
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
									if(bge.Network.hasConnection){
										bge.Network.connection.emit("window_roller_roll", {
											result: result,
											datestr: datestr
										});
									}
								})
						).append(
							$("<div/>")
								.css({
									"display": "inline-block",
									"vertical-align": "top",
									"height": "200px",
									"width": "90px",
									"overflow": "scroll",
									"float": "right"	
								})
								.attr("id", "diceroller_d8_result")
								.on("mousewheel", function(e){
									e.stopPropagation();
								})
						)
				}/*,
				{
					tabClass: "d10",
					content: $("<div/>")
						.css("width", "400px")
						.css("height", "200px")
						.text("D10 page!")
				},
				{
					tabClass: "d12",
					content: $("<div/>")
						.css("width", "400px")
						.css("height", "200px")
						.text("D12 page!")
				},
				{
					tabClass: "d20",
					content: $("<div/>")
						.css("width", "400px")
						.css("height", "200px")
						.text("D20 page!")
				},
				{
					tabClass: "percent",
					content: $("<div/>")
						.css("width", "400px")
						.css("height", "200px")
						.text("Percent page!")
				}*/
			]
		})).el.hide();
		
		
		//add shit to other shit
		$("body").append(
			$("<ul/>")
				.attr("id", "controls")
				.append(
					$("<li/>").addClass("spacer")
				).append(
					$("<li/>")
						.addClass("zoomout")
						.append(
							$("<p/>").text("-")
						)
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
								bge.adjustzoom(1);
								
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
								new bge.Window({
									titlebar: {
										sysbuttons: [
											"close"
										],
										title: "Text",
										tabs: []
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
				).append(
					$("<li/>")
						.addClass("textbox")
						.append(
							$("<p/>").text("Roller")
						)
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
								var id = parseInt( $("#window_roller").attr("rel") ,10);
								console.log(id);
								var w = bge.Window.getWindowById( id );
								w.open();
						
								//communicate to network
								if(bge.Network.hasConnection){
									bge.Network.connection.emit("window_open", {
										winid: "window_roller"
									});
								}
							
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
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
										if(bge.Network.hasConnection){
											bge.Network.connection.emit("piece_flip", {
												oursocketid: bge.Network.ourSocketId,
												id: p.id,
												isFlipped: p.isFlipped()
											});
										}
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
								bge.Piece.arrangeSelected();
								
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
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
								bge.Piece.shuffleSelected();
								var slist = bge.Piece.getSelected();
								for(var i=0; i<slist.length; i++)
									if(!slist[i].isFlipped()){
										var p = slist[i];
										p.flip();
										
										//communicate to network
										if(bge.Network.hasConnection){
											bge.Network.connection.emit("piece_flip", {
												oursocketid: bge.Network.ourSocketId,
												id: p.id,
												isFlipped: p.isFlipped()
											});
										}
									}
								bge.Piece.arrangeSelected();
								
								e.preventDefault();
								e.stopPropagation();
							}
						})
						.hide()
				).append(
					$("<li/>")
						.css({
							"float": "right"
						})
						.append(
							$("<ul/>")
								.append(
									$("<li/>")
										.addClass("connection")
										.append(
											$("<p/>").text("Connection")
										)
										.on("touchstart mousedown", function(e){
											if(e.which === 1){
												new bge.Window({
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
																			"padding": "5px 0",
																			"border-bottom": "double 3px #ccc"
																		})
																		.append(
																			$("<div/>")
																				.addClass("button")
																				.text("Connect")
																				.on("mousedown touchstart", function(e){
																					var address = $("#connectionwindow_address").val();
																					bge.Network.connectTo(address);
																					bge.Network.ourName = $("#connectionwindow_name").val();
																				})
																		).append(
																			$("<input/>")
																				.attr("id", "connectionwindow_address")
																				.attr("type", "text")
																				.attr("placeholder", "address")
																				.val("71.201.26.102")
																		).append(
																			$("<input/>")
																				.attr("id", "connectionwindow_name")
																				.attr("type", "text")
																				.attr("placeholder", "username")
																		)
																).append(
																	$("<div/>")
																		.css({
																			"padding": "5px 0",
																			"overflow": "scroll",
																			"font-size": "11px"
																		})
																		.attr("id", "connectionwindow_console")
																		.on("mousewheel", function(e){
																			e.stopPropagation();
																		})
																)
														}
													]
												});
											
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
			$("<ul/>")
				.attr("id", "contextmenu")
				.append(
					$("<li/>")
						.addClass("flip")
						.text("Flip")
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
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
										if(bge.Network.hasConnection){
											bge.Network.connection.emit("piece_flip", {
												oursocketid: bge.Network.ourSocketId,
												id: p.id,
												isFlipped: p.isFlipped()
											});
										}
									}
								
								e.preventDefault();
								e.stopPropagation();
								$('#contextmenu').hide();
							}
						})
				).append(
					$("<li/>")
						.addClass("shuffle")
						.text("Shuffle")
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
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
								$('#contextmenu').hide();
							}
						})
				).append(
					$("<li/>").addClass("spacer")
				).append(
					$("<li/>")
						.addClass("arrange_fan")
						.text("Arrange Fan")
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
								bge.Piece.arrangeSelected();
								
								e.preventDefault();
								e.stopPropagation();
								$('#contextmenu').hide();
							}
						})
				).append(
					$("<li/>")
						.addClass("arrange_stack")
						.text("Arrange Shuffle Stack")
						.on("touchstart mousedown", function(e){
							if(e.which === 1){
								
								bge.Piece.arrangeSelected();
								
								e.preventDefault();
								e.stopPropagation();
								$('#contextmenu').hide();
							}
						})
				)
		).append(
			$("<div/>")
				.attr("id", "selectbox")
				.hide()
		);
		
		
		//prevent backing
		$(window).on("beforeunload", function(){
			return "You are about to disconnection.";
		});	
		
		//keys and scrolling
		$(document).on("keyup", function(e) {
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
								if(bge.Network.hasConnection){
									bge.Network.connection.emit("piece_flip", {
										oursocketid: bge.Network.ourSocketId,
										id: p.id,
										isFlipped: p.isFlipped()
									});
								}
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
						bge.Piece.arrangeSelected();
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
				var go = getTransform($("#game"));
				$("#game").css("-webkit-transform", "translate3d(" +(go.x+wheeldelta.x)+ "px, " +(go.y+wheeldelta.y)+ "px, 0)");
				
				bge.centerCamToVP();
			})
			.on("contextmenu", function(e) {
				    $('#contextmenu').css({
				        top: e.pageY+'px',
				        left: e.pageX+'px'
				    }).show();
				    
				    return false;
				});
		
		
		//touch, dragging, release
		$(document)
			.on("touchstart mousedown", function(e){
				if(e.which === 1){
			    	$('#contextmenu').hide();
			    	
					if(isMobile.android || isMobile.ios){
						bge.scrollCursorOrigin.x = e.originalEvent.touches[0].pageX;
						bge.scrollCursorOrigin.y = e.originalEvent.touches[0].pageY;
					}
					else{
						bge.scrollCursorOrigin.x = e.pageX;
						bge.scrollCursorOrigin.y = e.pageY;
					}
					
					if(bge.shiftDown){
						//start selecting
						$("#selectbox").show();
						bge.selectBoxStart = {
							x: bge.scrollCursorOrigin.x,
							y: bge.scrollCursorOrigin.y
						};
						
						bge.selectStartItems = bge.Piece.getSelected();
						bge.selectBoxing = true;
					}
					else{
						bge.Piece.deselectAll();
						
						//start panning
						var go = getTransform($("#game"));
						bge.scrollGameOrigin.x = go.x;
						bge.scrollGameOrigin.y = go.y;
						
						bge.handscroll = true;
					}
				}
			})
			.on("touchmove mousemove", function(e){
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
				
				if(bge.selectBoxing){
					//selecting
					var selrect = {
						x: bge.selectBoxStart.x < newcoords.x ? bge.selectBoxStart.x : newcoords.x,
						y: bge.selectBoxStart.y < newcoords.y ? bge.selectBoxStart.y : newcoords.y,
						w: Math.abs(bge.selectBoxStart.x - newcoords.x),
						h: Math.abs(bge.selectBoxStart.y - newcoords.y)
					};
					$("#selectbox")
						.css("-webkit-transform", "translate3d(" +selrect.x+ "px, " +selrect.y+ "px, 0px)")
						.css("width", selrect.w+"px")
						.css("height", selrect.h+"px");
					
					//selection
					for(var i=0; i<bge.Piece.all.length; i++){
						var wasSelected = false;
						for(var i2=0; i2<bge.selectStartItems.length; i2++)
							if(bge.Piece.all[i].id === bge.selectStartItems[i2].id){
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
				if(bge.handscroll){
					//panning
					var go = getTransform($("#game"));
					var target = {
						x: bge.scrollGameOrigin.x + newcoords.x - bge.scrollCursorOrigin.x,
						y: bge.scrollGameOrigin.y + newcoords.y - bge.scrollCursorOrigin.y
					};
					$("#game").css("-webkit-transform", "translate3d(" +(target.x)+ "px, " +(target.y)+ "px, 0)");
					
					bge.centerCamToVP();
				}
			})
			.on("touchend mouseup", function(e){
				if(bge.handscroll){
					bge.handscroll = false;
				}
				if(bge.selectBoxing){
					bge.selectBoxing = false;
					console.log("end select");
					$("#selectbox")
						.hide()
						.css("width", 0)
						.css("height", 0);
				}
			});
			
			
		//jump into play game... can make a menu to do other things instead in the future
		bge.playgame.open();
	},
	_.mainmenu = {
		open: function(){
			console.log("mainmenu open");
			
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
			console.log("mainmenu close");
			$("#mainmenu").remove();
		}
	};
	
	_.curgame = "";
	_.playgame = {
		open: function(){
			console.log("playgame open");
			
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
									.attr("id", "user_privateregions")
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
						var p = new bge.Piece(piecedata);
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
										console.log("input recorded");
										//communicate to network
										if(bge.Network.hasConnection){
											bge.Network.connection.emit("textregion_change", {
												oursocketid: bge.Network.ourSocketId,
												winid: $(this).parent().attr("id"),
												val: $(this).val(),
											});
										}
									})
							)
					);
				}
			});
			
			
			
			$("#game").css("-webkit-transform", "translate3d(0px, 0px, 0)");
			bge.adjustzoom(0);
		},
		close: function(){
			console.log("playgame close");
		}
	};
	
	
	_.Network = {
		hasConnection: false,
		connection: undefined, //socket.io connection
		connectionAddress: "",
		ourSocketId: "",
		ourName: "",
		connectTo: function(_ip){
			var address = "http://" +_ip +":10000/";
			
			bge.Network.connectionAddress = address;
			$("#connectionwindow_console").prepend(
				$("<p/>").text("Starting connection to " +bge.Network.connectionAddress+ ".")
			);
			
			bge.Network.connection = io.connect(address);
			bge.Network.connection.socket.on("connect", function(){
					bge.Network.hasConnection = true;
					bge.Network.ourSocketId = this.sessionid;
					
					
					//communicate to network
					bge.Network.connection.emit("user_set_name", {
						oursocketid: bge.Network.ourSocketId,
						name: bge.Network.ourName
					});
					
					$("#connectionwindow_console").prepend(
						$("<p/>").css("color", "#3A0").text("Successful connection to " +bge.Network.connectionAddress+ ".")
					);
				}).on("disconnect", function(data){
					bge.Network.hasConnection = false;
					
					$("#connectionwindow_console").prepend(
						$("<p/>").text("Disconnected from " +bge.Network.connectionAddress+ ".")
					);
					console.log(data);
				}).on('error', function (data) {
					bge.Network.hasConnection = false;
					
					$("#connectionwindow_console").prepend(
						$("<p/>").css("color", "#A30").text("Failed connection to " +bge.Network.connectionAddress+ ".")
					);
					console.log(data);
			    }).on('connect_failed', function (data) {
					bge.Network.hasConnection = false;
					
					$("#connectionwindow_console").prepend(
						$("<p/>").css("color", "#A30").text("Failed connection to " +bge.Network.connectionAddress+ ". Possible handshake error?")
					);
					console.log(data);
			    });
				bge.Network.connection
					.on("piece_move", function(_data){
						var p = bge.Piece.getFromId(_data.id);
						
						p.moveTo(_data.x, _data.y);
					})
					.on("piece_flip", function(_data){
						var p = bge.Piece.getFromId(_data.id);
						
						if(p.isFlipped() !== _data.isFlipped)
							p.flip();
					})
					.on("piece_shuffle", function(_data){
						var p = bge.Piece.getFromId(_data.id);
						
						p.el.css("z-index", _data.zindex);
					})
					.on("piece_select", function(_data){
						var p = bge.Piece.getFromId(_data.id);
						console.log("piece_select request");
						p.el.css("border", "6px dotted "+_data.color);
					})
					.on("piece_deselect", function(_data){
						var p = bge.Piece.getFromId(_data.id);
						
						p.el.css("border", "");
					})
					.on("user_update_privateregions", function(_data){
						$("#user_privateregions").empty();
						for(var i=0; i<_data.length; i++){
							var region = _data[i];
							
								
							var pos = {
								x: 50 + ((i%6)*520),
								y: 2300 + (Math.floor(i/6)*800)
							};
							
							
							//add footprint
							$("#user_privateregions").prepend(
								$("<div/>")
									.css({
										"background-color": region.color,
										"width": "500px",
										"height": "600px",
										"-webkit-transform": "translate3d(" +pos.x+ "px, " +pos.y+ "px, 0px)",
										"z-index": 0,
										"position": "absolute",
										"font-size": "40px",
										"line-height": "50px",
										"text-align": "center",
										"color": "#000"
									})
									.text("Your private region")
							)
							
							//add cover
							if(region.name !== bge.Network.ourName)
								$("#user_privateregions").prepend(
									$("<div/>")
										.css({
											"background-color": region.color,
											"width": "500px",
											"height": "600px",
											"-webkit-transform": "translate3d(" +pos.x+ "px, " +pos.y+ "px, 0px)",
											"z-index": 10000,
											"position": "absolute",
											"font-size": "50px",
											"line-height": "300px",
											"text-align": "center",
											"color": "#fff"
										})
										.text(region.name)
								)
						}
					})
					.on("window_open", function(_data){
						var w = bge.Window.getWindowById( parseInt($("#"+_data.winid).attr("rel"),10) );
						w.open();
					})
					.on("window_roller_roll", function(_data){
						var w = bge.Window.getWindowById( parseInt($("#window_roller").attr("rel"),10) );
						
						$("#diceroller_d8_result").prepend( 
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
	
	
	_.Window = function( _settings ){
		var _ = this;
		
		_.id = bge.Window.lastid++;
		_.el = $("<div/>").addClass("window");
		$("body").append( _.el );
		_.el.attr("rel", _.id)
			.attr("id", _settings.id)
			.css("width", _settings.width+"px")
			.css("height", _settings.height+"px");
		
		
		//BUILD THE TITLEBAR
			_.titlebar = {};
			_.titlebar.el = $("<div/>").addClass("titlebar");
			_.el.append( _.titlebar.el);
		
			//CLOSE, MINIMIZE, MAXIMIZE
			_.titlebar.sysbuttons = {};
			_.titlebar.sysbuttons.el = $("<ul/>").addClass("sysbuttons");
			_.titlebar.el.append( _.titlebar.sysbuttons.el );
			
			if(_settings.titlebar.sysbuttons.indexOf("close") >= 0)
				_.titlebar.sysbuttons.el.append(
					$("<li/>")
						.text("x")
						.addClass("close")
						.on("touchstart mousedown", function(e){
							var winEl = $(this).parent().parent().parent();
							var winId = parseInt(winEl.attr("rel"),10);
							var _ = bge.Window.getWindowById(winId);
							
							_.close();
						})
				);
			else
				_.titlebar.sysbuttons.el.append(
					$("<li/>").addClass("inactive")
				);
				
			if(_settings.titlebar.sysbuttons.indexOf("minimize") >= 0)
				_.titlebar.sysbuttons.el.append(
					$("<li/>")
						.text("_")
						.addClass("minimize")
						.on("touchstart mousedown", function(e){
							var winEl = $(this).parent().parent().parent();
							var winId = parseInt(winEl.attr("rel"),10);
							var _ = bge.Window.getWindowById(winId);
							
							_.minimize();
						})
				);
			else
				_.titlebar.sysbuttons.el.append(
					$("<li/>").addClass("inactive")
				);
			
			if(_settings.titlebar.sysbuttons.indexOf("maximize") >= 0)
				_.titlebar.sysbuttons.el.append(
					$("<li/>")
						.text("+")
						.addClass("maximize")
						.on("touchstart mousedown", function(e){
							var winEl = $(this).parent().parent().parent();
							var winId = parseInt(winEl.attr("rel"),10);
							var _ = bge.Window.getWindowById(winId);
							
							_.maximize();
						})
				);
			else
				_.titlebar.sysbuttons.el.append(
					$("<li/>").addClass("inactive")
				);
				
		
			//TITLE
			_.titlebar.title = {};
			_.titlebar.title.el = $("<p/>").addClass("title").text(_settings.titlebar.title);
			_.titlebar.el.append(_.titlebar.title.el);
			
			//TABS
			_.titlebar.tabs = new Array();
			_.titlebar.tabs.el = $("<ul/>").addClass("tabs");
			_.titlebar.el.append(_.titlebar.tabs.el);
			for( var i=0; i<_settings.titlebar.tabs.length; i++){
				var tab = _settings.titlebar.tabs[i];
				
				_.titlebar.tabs.push(tab);
				tab.el = $("<li/>")
					.addClass(tab.class)
					.text(tab.text);
				_.titlebar.tabs.el.append( tab.el );
				
				if(tab.events === undefined){
					tab.el.on("touchstart mousedown", function(e){
						var winEl = $(this).parent().parent().parent();
						var winId = parseInt(winEl.attr("rel"),10);
						var _ = bge.Window.getWindowById(winId);
						
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
			_.content = {};
			_.content.el = $("<div/>").addClass("content");
			_.el.append( _.content.el );
			
			_.content.panes = new Array();
			for( var i=0; i<_settings.content.length; i++){
				var pane = _settings.content[i];
				
				pane.el = $("<div/>")
					.addClass("pane")
					.append(pane.content)
					.hide();
				_.content.el.append(pane.el);
				
				_.content.panes.push(pane);
			}
			
				
				
		//EVENTS
		_.move_cursor_start = {
			x: 0,
			y: 0
		}
		_.move_el_start = {
			x: 0,
			y: 0
		}
		_.move_dragging = false;
		_.el.on("touchstart mousedown", function(e){
			if(e.which === 1){
				var winId = parseInt($(this).attr("rel"),10);
				var _ = bge.Window.getWindowById(winId);
				
				bge.Window.blurAll();
				_.focus();
				
				e.stopPropagation();
			}
		});
		_.titlebar.title.el.on("touchstart mousedown", function(e){
			if(e.which === 1){
				var winEl = $(this).parent().parent();
				var winId = parseInt(winEl.attr("rel"),10);
				var _ = bge.Window.getWindowById(winId);
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
		
		
		//FUNCTIONS
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
			for(var i=0; i<_.titlebar.tabs.length; i++){
				var tab = _.titlebar.tabs[i];
				
				if(_tabClass.indexOf(tab.class) >= 0)
					tab.el.addClass("active");
				else
					tab.el.removeClass("active");
			}
		}
		_.close = function(){
			var _ = this;
			
			_.el.hide();
			/*
			_.el.remove();
			
			//remove from bge.Window.all
			for(var i=0; i<bge.Window.all.length; i++)
				if(bge.Window.all[i].id === _.id){
					bge.Window.all.splice(i,1);
					break;
				}*/
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
			_.el.removeClass("inactive");
		}
		_.blur = function(){
			var _ = this;
			_.el.addClass("inactive");
		}
		
		
		_.switchToPane( _.content.panes[0].tabClass );
		bge.Window.all.push( _ );
	}
	_.Window.lastid = 0;
	_.Window.all = new Array();
	_.Window.getWindowById = function( _id ){
		for(var i=0; i<bge.Window.all.length; i++){
			var win = bge.Window.all[i];
			if(win.id === _id)
				return win;
		}
	}
	_.Window.blurAll = function(){
		for(var i=0; i<bge.Window.all.length; i++)
			bge.Window.all[i].blur();
	}
		
		
	_.Piece = function( _json ){
		var _ = this;
		
		
		//FROM JSON DATA
		_.attributes = 		"attributes" in 	_json ?				_json.attributes : 		(new Array());
		_.bg =				"bg" in 			_json ?				_json.bg : 				"";
		_.classes = 		"classes" in 		_json ?				_json.classes : 		"";
		_.placement = 		"placement" in 		_json ? 			_json.placement : 		{};
		_.placement.coords ="coords" in 		_json.placement ?	_json.placement.coords :{x:0, y:0};
		_.image_size =		"image_size" in		_json ?				_json.image_size : 		{w: 0, h: 0};
		_.initial_size =	"initial_size" in 	_json ?				_json.initial_size :	{w: 0, h: 0};
		
		
		//EXTRA
		_.selected = false;
		
		_.id = bge.Piece.lastid++;
		_.move_el_start = {x:0, y:0};
		_.move_cursor_start = {x:0, y:0}; //when dragging, starting move position of cursor
		_.move_dragging = false; //when dragging, starting move position
		
		_.deselect = function(){
			var _ = this;
			
			if(_.selected){
				_.selected = false;
				_.el.removeClass("selected");
				
				//communicate to network
				if(bge.Network.hasConnection){
					bge.Network.connection.emit("piece_deselect", {
						oursocketid: bge.Network.ourSocketId,
						id: _.id
					});
				}
				
				bge.refreshMenu();
			}
		}
		_.select = function(){
			var _ = this;
			if(_.attributes.indexOf("select") < 0) return;
			
			
			_.selected = true;
			_.el.addClass("selected");
			
			
			//communicate to network
			if(bge.Network.hasConnection){
				bge.Network.connection.emit("piece_select", {
					oursocketid: bge.Network.ourSocketId,
					id: _.id
				});
			}
			
			bge.refreshMenu();
		}
		_.duplicate = function(){
			var _ = this;
			if(_.attributes.indexOf("duplicate") < 0) return;
			
			
			var peo = getTransform(_.el);
			var np = new bge.Piece({
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
			np.attributes.splice(np.attributes.indexOf("duplicate"),1);
			np.attributes.push("destroy");
			
			return np;
		}
		_.destroy = function(){
			var _ = this;
			if(_.attributes.indexOf("destroy") < 0) return;
			
			
			_.deselect();
			_.el.remove();
			bge.refreshMenu();
			
			//remove from bge.Piece.all
			for(var i=0; i<bge.Piece.all.length; i++)
				if(bge.Piece.all[i].id === _.id){
					bge.Piece.all.splice(i,1);
					break;
				}
		}
		_.flip = function(){
			var _ = this;
			if(_.attributes.indexOf("flip") < 0) return;
			
			
			if(!_.isFlipped())
				_.el.css("background-position", "0px 0px");
			else
				_.el.css("background-position", (-_.initial_size.w)+"px 0px");
		}
		_.isFlipped = function(){
			var _ = this;
			if(_.attributes.indexOf("flip") < 0) return;
			
			var cbgp = _.el.css("background-position").split(" ");
			
			return parseFloat(cbgp[0]) === 0;
		}
		_.moveTo = function(_x, _y){
			var _ = this;
			_.el.css("-webkit-transform", "translate3d(" +_x+ "px, " +_y+ "px, 0)");
		}
		
		
		//INIT
		//create the elements
		_.el = $("<div/>")
			.addClass("piece "+_.classes)
			.css("width", _.initial_size.w)
			.css("height", _.initial_size.h)
			.css("background-image", "url(data/"+ bge.curgame +"/images/"+ _.bg +")")
			.css("-webkit-transform", "translate3d(" +(_.placement.coords.x)+ "px, " +(_.placement.coords.y)+ "px, 0)")
			.attr("rel", _.id)
			.css("z-index", _.id);
		
		
		//account for abiltiies
		if(	_.attributes.indexOf("select") >= 0){				//SELECT
			_.el.on("touchstart mousedown", function(e){
					if(	e.which === 1 ||
						e.which === 3){
						var pid = parseFloat($(this).attr("rel"),10);
						var p = bge.Piece.getFromId( pid );
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
				.on("touchend mouseup", function(e){
					if(	e.which === 1 ){
						var pid = parseFloat($(this).attr("rel"),10);
						var p = bge.Piece.getFromId( pid );
						if( p === undefined ) return;
						
						if(bge.shiftDown && !p.move_dragging){
							if(p.selected)
								p.deselect();
						}
					}
				});
		}
		if(	_.attributes.indexOf("move") >= 0){					//MOVE
			_.el.on("touchstart mousedown", function(e){
				if(e.which === 1){
					var pid = parseFloat($(this).attr("rel"),10);
					var p = bge.Piece.getFromId( pid );
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
			});
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
		//console.log(_);
		return _;
	}
	_.Piece.lastid = 0;
	_.Piece.all = new Array();
	_.Piece.getFromId = function(_id){
		for(var i=0; i<bge.Piece.all.length; i++)
			if(bge.Piece.all[i].id === _id)
				return bge.Piece.all[i];
		
		return undefined;
	}
	_.Piece.deselectAll = function(){
		bge.refreshMenu();
	
		for(var i=0; i<bge.Piece.all.length; i++)
			bge.Piece.all[i].deselect();
	}
	_.Piece.getSelected = function(){
		var selectedList = new Array();
		for(var i=0; i<bge.Piece.all.length; i++){
			if(bge.Piece.all[i].selected)
				selectedList.push(bge.Piece.all[i]);
		}
		return selectedList;
	}
	_.Piece.shuffleSelected = function(){
		var slist = bge.Piece.getSelected();
		
		
		//get shuffled list of z-indexes to distribute
		var shuffledList = new Array();
		for(var i=0; i<slist.length; i++)
			shuffledList.push( slist[i].el.css("z-index") );
		shuffledList = shuffle(shuffledList);
		
		//distribute z-indexes
		for(var i=0; i<slist.length; i++){
			var p = slist[i];
			p.el.css("z-index", shuffledList[i]);
			
			//communicate to network
			if(bge.Network.hasConnection){
				bge.Network.connection.emit("piece_shuffle", {
					oursocketid: bge.Network.ourSocketId,
					id: p.id,
					zindex: shuffledList[i]
				});
			}
		}
			
		console.log("shuffled");
	}
	_.Piece.arrangeSelected = function(){
		var slist = bge.Piece.getSelected();
		
		
		//find the average position
		var tlco = {
			x: 0,
			y: 0
		}
		for(var i=0; i<slist.length; i++){
			var elt = getTransform(slist[i].el);
			
			tlco.x += (elt.x-tlco.x) * (1/(i+1));
			tlco.y += (elt.y-tlco.y) * (1/(i+1));
		}
	
		//arrange spaced apart
		slist.sort(function(a, b) { 
		    return parseInt(a.el.css("z-index")) - parseInt(b.el.css("z-index"));
		})
		var spaceo = {	//space offset
			x: 0,
			y: 0
		};
		for(var i=0; i<slist.length; i++){
			var p = slist[i];
			
			var target = {
				x: tlco.x+spaceo.x,
				y: tlco.y+spaceo.y	
			};
			p.moveTo(target.x, target.y);
			
			//communicate to network
			if(bge.Network.hasConnection){
				bge.Network.connection.emit("piece_move", {
					oursocketid: bge.Network.ourSocketId,
					id: p.id,
					x: target.x, 
					y: target.y
				});
			}
			
			if(p.attributes.indexOf("flip") >= 0)
				if(!p.isFlipped()){
					spaceo.x += 20;
				}
		}
		
		
		console.log("arranged "+slist.length+" items");
	}
}
var bge = new BGE();
//bge.Network.connectTo("localhost");

$(document)
	.on("touchstart mousedown", function(e){
		//unfocus windows
		bge.Window.blurAll();
	})
	.on("touchmove mousemove", function(e){
		//handle pieces moving
		for(var i=0; i<bge.Piece.all.length; i++){
			var p = bge.Piece.all[i];
			
			if(p.move_dragging){
				e.preventDefault();
					
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
				var go = getTransform($("#game"));
				var target = {
					x: p.move_el_start.x - go.x*zm + (newcoords.x - p.move_cursor_start.x)*zm,
					y: p.move_el_start.y - go.y*zm + (newcoords.y - p.move_cursor_start.y)*zm
				};
				p.moveTo(target.x, target.y);
				
				//communicate to network
				if(bge.Network.hasConnection){
					bge.Network.connection.emit("piece_move", {
						oursocketid: bge.Network.ourSocketId,
						id: p.id,
						x: target.x, 
						y: target.y
					});
				}
			}
		}
		
		//handle windows moving
		for(var i=0; i<bge.Window.all.length; i++){
			var w = bge.Window.all[i];
			
			if(w.move_dragging){
				e.preventDefault();
					
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
	})
	.on("touchend mouseup", function(e){
		//handle pieces stop moving
		for(var i=0; i<bge.Piece.all.length; i++)
			bge.Piece.all[i].move_dragging = false;
			
		//handle windows stop moving
		for(var i=0; i<bge.Window.all.length; i++)
			bge.Window.all[i].move_dragging = false;
	});








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
isMobile.androidVersion = parseFloat(navigator.userAgent.slice(navigator.userAgent.indexOf("Android")+8))
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