'use strict'

//Carlos Sanchez - 2016
//randomouscrap98@aol.com
//-Yo, check it out. Drawing. In chat. 

//Make sure there's at least SOMETHING there. It won't log, but it won't throw
//errors either (I think).
if (!window.LogSystem)
	window.LogSystem = {RootLogger: {log: (message, level)=>{
		console.log(message)
	}}}

let LocalChatDraw = (()=>{
	
	//The chatdraw canvas's expected width and height
	let chatDrawCanvasWidth = 200
	let chatDrawCanvasHeight = 100
	
	let colorButtonClass = "colorChange"
	let colorPicker = null
	let drawArea = null
	let $root = document.createElement('chat-draw')
	let hideCharacters = 20
	let maxLineWidth = 7
	let maxScale = 5
	let defaultLineWidth = 2
	let drawer = false
	let animateFrames = false
	let animationPlayer = false
	let drawIframe
	let firstTimeRecentered = false
	
	let saveInput = false
	
	let animationTag = "_chdran"
	let allowAnimation = true
	
	let copyDrawing = (string)=>{
		StorageUtilities.WriteLocal(ChatDrawUtilities.ClipboardKey, string)
		UXUtilities.Toast("Copied drawing (chatdraw only!)")
	}
	
	let getClipboardDrawing = ()=>{
		return StorageUtilities.ReadLocal(ChatDrawUtilities.ClipboardKey)
	}
	
	let checkMessageForDrawing = (messageElement)=>{
		try {
			var content = messageElement.querySelector('[data-encoding="draw"]')
			
			if (content) {
				LogSystem.RootLogger.log("Converting drawing encoding to canvas image")
				
				var originalString = content.innerHTML
				var parts = originalString.split(")")
				var drawingString = ""
				var animationLink = false
				
				if (parts.length === 2) {
					drawingString = parts[1]
					animationLink = parts[0].slice(1)
				} else {
					drawingString = originalString
				}
				
				var canvas = ChatDrawUtilities.ChatDrawToFrame(drawingString).canvas
				content.textContent = ""
				content.appendChild(canvas)
				var date = new Date()
				var controlContainer = document.createElement("chatdraw-controlcontainer")
				
				if (allowAnimation && animationLink && animationLink.match("^https?://kland.smilebasicsource.com")) {
					var playButton = document.createElement("a")
					playButton.textContent = "►"
					playButton.className = "chatdrawplay"
					var animator = new AnimationPlayer(canvas, false)
					animator.OnPlay = (player)=>{
						if (player.frames === false) {
							playButton.disabled = false
							playButton.textContent = "⌛"
							RequestUtilities.XHRSimple(animationLink, (response)=>{
								animator.FromStorageObject(JSON.parse(response))
								animator.Play()
							})
							return false
						}
						
						playButton.disabled = false
						playButton.textContent = "◼"
					}
					animator.OnStop = (player)=>{
						playButton.textContent = "►"
					}
					playButton.addEventListener("click", ()=>{
						if (animator.IsPlaying())
							animator.Stop()
						else {
							if (animator.GetRepeat())
								animator.Play(animator._currentFrame)
							else
								animator.Play()
						}
					})
					var copyAnimation = document.createElement("a")
					copyAnimation.textContent = "📋"
					copyAnimation.title = "Copy whole animation"
					copyAnimation.addEventListener("click", ()=>{
						UXUtilities.Confirm("Copying this animation will OVERWRITE your current animation. Make sure you save your work first! Are you sure you want to copy this animation?", (confirmed)=>{
							if (!confirmed) return
							RequestUtilities.XHRSimple(animationLink, (response)=>{
								//Since we downloaded it anyway we might as well also
								//load up the animator.
								var storeObject = JSON.parse(response)
								animator.FromStorageObject(storeObject)
								loadAnimation(storeObject)
								saveInput.value = ""
							})
						})
					})
					controlContainer.appendChild(copyAnimation)
					controlContainer.appendChild(playButton)
				} else {
					var downloadLink = document.createElement("a")
					downloadLink.href = canvas.toDataURL("image/png")
					downloadLink.download = "chatDraw_" + Date.now() + ".png"
					downloadLink.textContent = "💾"
					downloadLink.className = "chatdrawdownload"
					var copyLink = document.createElement("a")
					copyLink.textContent = "📋"
					copyLink.className = "chatdrawcopy"
					copyLink.addEventListener("click", ev=>{
						copyDrawing(originalString)
					})
					if (allowAnimation) controlContainer.appendChild(copyLink)
					controlContainer.appendChild(downloadLink)
				}
				content.appendChild(controlContainer)
			}
		} catch(ex) {
			LogSystem.RootLogger.log("Error while converting drawing message to canvas: " + ex)
		}
	}
	
	let createToolButton = (displayCharacters, toolNames)=>{
		if (!Array.isArray(displayCharacters))
			displayCharacters= [displayCharacters]
		if (!Array.isArray(toolNames))
			toolNames = [toolNames]
		let nextTool = 0
		let tButton = HTMLUtilities.CreateUnsubmittableButton(displayCharacters[nextTool])
		//makeUnsubmittableButton()
		//tButton.textContent = displayCharacters[nextTool]
		tButton.className = "toolButton"
		tButton.addEventListener('click', ev=>{
			//First, deselect ALL other buttons
			let toolButtons = drawArea.querySelectorAll("button.toolButton")
			for (let i = 0; i < toolButtons.length; i++) {
				if (toolButtons[i] != tButton)
					delete toolButtons[i].dataset.selected
			}
			
			//Now figure out if we're just selecting this button or cycling
			//through the available tools
			if (tButton.getAttribute("data-selected"))
				nextTool = (nextTool + 1) % toolNames.length
			
			tButton.textContent = displayCharacters[nextTool]
			tButton.dataset.selected = true
			drawer.currentTool = toolNames[nextTool]
		})
		return tButton
	}
	
	let selectNextRadio = ()=>{
		let index = animateFrames.GetSelectedFrameIndex()
		if (index < animateFrames.GetFrameCount() - 1)
			animateFrames.SelectFrameIndex(index + 1)
	}
	
	let selectPreviousRadio = ()=>{
		let index = animateFrames.GetSelectedFrameIndex()
		if (index > 0) 
			animateFrames.SelectFrameIndex(index - 1)
	}
	
	let getButtonColorString = ()=>{
		return getColorString(getButtonColors())
	}
	
	let getColorString = (colors)=>{
		let colorSet = ""
		
		for (let i = 0; i < colors.length; i++) {
			colorSet += rgbToFillStyle(colors[i])
			if (i !== colors.length - 1)
				colorSet += "/"
		}
		
		return colorSet
	}
	
	let parseColorString = (string)=>{
		let colors = string.split("/")
		let result = []
		
		for (let i = 0; i < colors.length; i++)
			result.push(fillStyleToRgb(colors[i]))
		
		return result
	}
	
	let setButtonColors = (palette)=>{
		let buttons = getColorButtons()
		
		for (let i = 0; i < palette.length; i++) {
			if (i < buttons.length) {
				buttons[i].style.color = palette[i].ToRGBString(); //colors[i]
				
				if (buttons[i].hasAttribute("data-selected"))
					drawer.color = buttons[i].style.color
			}
		}
		
		drawer.moveToolClearColor = rgbToFillStyle(getClearColor())
	}
	
	let widthToggle = (widthButton)=>{
		let width = (Number(widthButton.dataset.width) % maxLineWidth) + 1
		widthButton.textContent = width
		widthButton.dataset.width = width
		drawer.lineWidth = width
	}
	
	let getAnimations = (callback, element)=>{
		let formData = new FormData()
		formData.append("list", "1")
		fullGenericXHR("/query/submit/varstore?session=" + StorageUtilities.GetPHPSession(), formData, element, (json, statusElement)=>{
			genericSuccess(json, element)
			
			let result = []
			
			for (let i = 0; i < json.result.length; i++)
				if (json.result[i].endsWith(animationTag))
					result.push(json.result[i].slice(0, -animationTag.length))
			
			callback(result)
		})
	}
	
	//Once you have a compliant v2 object, this is the actual load function.
	let loadAnimation = (storeObject)=>{
		animationPlayer.FromStorageObject(storeObject)
		animateFrames.ClearAllFrames()
		
		for (let i = 0; i < animationPlayer.frames.length; i++) {
			animateFrames.InsertNewFrame(i - 1)
			animateFrames.SetFrame(animationPlayer.frames[i], i)
		}
		
		animateFrames.SelectFrameIndex(0)
	}
	
	let setupInterface = (interfaceContainer)=>{
		let messagePane = interfaceContainer
		let i
		
		drawArea = document.createElement("draw-area")
		let canvasContainer = document.createElement("canvas-container")
		let buttonArea = document.createElement("button-area")
		let buttonArea2 = document.createElement("button-area")
		let toggleButton = HTMLUtilities.CreateUnsubmittableButton()
		let sendButton = HTMLUtilities.CreateUnsubmittableButton()
		let widthButton = HTMLUtilities.CreateUnsubmittableButton()
		let cSizeButton = HTMLUtilities.CreateUnsubmittableButton()
		let undoButton = HTMLUtilities.CreateUnsubmittableButton()
		let redoButton = HTMLUtilities.CreateUnsubmittableButton()
		let clearButton = HTMLUtilities.CreateUnsubmittableButton()
		let freehandButton = createToolButton(["✏️","✒️","🚿️"], ["freehand","slow","spray"]); //["✏","✒"], 
		let lineButton = createToolButton(["📏️","🔲️"], ["line", "square"])
		let fillButton = createToolButton(["🪣️","❎️"], ["fill","clear"])
		let moveButton = createToolButton(["↔️"], ["mover"])
		let canvas = ChatDrawUtilities.CreateCanvas()
		let lightbox = ChatDrawUtilities.CreateCanvas()
		colorPicker = document.createElement("input")
		lightbox.className = "lightbox"
		
		let frameContainer = document.createElement("animate-frames")
		animateFrames = new AnimatorFrameSet(frameContainer)
		animateFrames.OnFrameSelected = (data)=>{
			setButtonColors(data.palette)
			drawer.buffers[0].canvas = data.canvas
			drawer.ClearUndoBuffer()
			drawer.Redraw()
			
			let lightboxFrames = []
			let lightboxCount = Number(lightboxButton.textContent)
			let selectedIndex = animateFrames.GetSelectedFrameIndex()
			let totalFrames = animateFrames.GetFrameCount()
			let i
			
			if (lightboxCount > 0) {
				for (i = Math.max(0, selectedIndex - lightboxCount); i < selectedIndex; i++)
					lightboxFrames.push(animateFrames.GetFrame(i))
			} else {
				for (i = Math.min(totalFrames - 1, selectedIndex - lightboxCount); i > selectedIndex; i--)
					lightboxFrames.push(animateFrames.GetFrame(i))
			}
			
			let opacities = [0.03, 0.12, 0.25]
			ChatDrawUtilities.CreateLightbox(lightboxFrames, lightbox, opacities.slice(-lightboxFrames.length))
		}
		
		let firstFrame = animateFrames.InsertNewFrame(0)
		
		drawer = new CanvasDrawer()
		drawer.Attach(canvas, [firstFrame.canvas], 5)
		drawer.OnUndoStateChange = ()=>{
			undoButton.disabled = !drawer.CanUndo()
			redoButton.disabled = !drawer.CanRedo()
		}
		// URGENT TODO: this is inefficient, since it captures all mouse moves and etc. we need to fix the inner stroke detector to work with shadow DOM.
		drawer.onlyInnerStrokes = false
		
		//Set up the color picker
		colorPicker.type = 'color'
		colorPicker.style.position = "absolute"
		colorPicker.style.left = "-10000px"
		colorPicker.style.top = "-10000px"
		colorPicker.style.width = "0"
		colorPicker.style.height = "0"
		colorPicker.addEventListener("change", (event)=>{
			let frame = animateFrames.GetFrame(); //GetSelectedFrame()
			let newColor = StyleUtilities.GetColor(event.target.value)
			CanvasUtilities.SwapColor(frame.canvas.getContext("2d"), StyleUtilities.GetColor(event.target.associatedButton.style.color), newColor, 0)
			event.target.associatedButton.style.color = newColor.ToRGBString()
			drawer.color = newColor.ToRGBString()
			drawer.moveToolClearColor = rgbToFillStyle(getClearColor())
			drawer.Redraw()
			
			//TODO: Fix this later! Buttons should only be proxies for the real
			//colors stored in each frame! Don't set the palette based on the
			//buttons, set the palette when the user changes the color and ping
			//the palette back to the buttons (maybe with a call to "select" again)
			frame.palette = ChatDrawUtilities.StringToPalette(getButtonColorString())
			animateFrames.SetFrame(frame)
		})
		
		//Set up the various control buttons (like submit, clear, etc.)
		clearButton.textContent = "❌️"
		clearButton.addEventListener("click", ev=>{
			if (drawer.StrokeCount()) drawer.UpdateUndoBuffer()
			CanvasUtilities.Clear(animateFrames.GetFrame().canvas, 
			                      rgbToFillStyle(getClearColor()))
			drawer.Redraw()
		})
		drawArea.setAttribute("tabindex", "-1")
		drawArea.addEventListener("keydown", ev=>{
			if (drawArea.dataset.hidden) return
			if (ev.keyCode === 40)
				selectNextRadio()
			if (ev.keyCode === 38)
				selectPreviousRadio()
		})
		widthButton.textContent = defaultLineWidth - 1
		widthButton.dataset.width = defaultLineWidth - 1
		widthButton.addEventListener("click", widthToggle.callBind(widthButton))
		sendButton.textContent = "➥"
		sendButton.dataset.button = "sendDrawing"
		sendButton.addEventListener("click", ev=>{sendDrawing();})
		toggleButton.textContent = "✎"
		toggleButton.addEventListener("click", toggleInterface)
		cSizeButton.textContent = "◲"
		cSizeButton.addEventListener("click", scaleInterface)
		undoButton.textContent = "↶"
		undoButton.addEventListener("click", ev=>{ drawer.Undo(); })
		redoButton.textContent = "↷"
		redoButton.addEventListener("click", ev=>{ drawer.Redo(); })
		drawer.DoUndoStateChange()
		
		//These are the only elements that will be displayed if the drawing area
		//goes hidden. CSS doesn't have to look at these, ofc.
		toggleButton.dataset.keep = true
		buttonArea2.dataset.keep = true
		
		buttonArea.appendChild(cSizeButton)
		buttonArea.appendChild(undoButton)
		buttonArea.appendChild(redoButton)
		
		//Create the color picking buttons
		for (i = 0; i < ChatDrawUtilities.BaseColors.length; i++) {
			let colorButton = HTMLUtilities.CreateUnsubmittableButton(); //makeUnsubmittableButton()
			
			colorButton.textContent = "■"
			colorButton.className = colorButtonClass
			colorButton.addEventListener("click", colorButtonSelect.callBind(colorButton, canvas))
			
			buttonArea.appendChild(colorButton)
			
			if (i === 1)
				colorButton.click()
		}
		
		buttonArea.appendChild(sendButton)
		
		buttonArea2.appendChild(moveButton)
		buttonArea2.appendChild(clearButton)
		buttonArea2.appendChild(widthButton)
		buttonArea2.appendChild(fillButton)
		buttonArea2.appendChild(lineButton)
		buttonArea2.appendChild(freehandButton)
		buttonArea2.appendChild(toggleButton)
		canvasContainer.appendChild(canvas)
		canvasContainer.appendChild(lightbox)
		drawArea.appendChild(canvasContainer)
		drawArea.appendChild(buttonArea)
		drawArea.appendChild(buttonArea2)
		drawArea.appendChild(colorPicker)
		
		//Before we finish entirely, set up the animation area.
		let animateArea = document.createElement("animate-area")
		let animateScroller = document.createElement("animate-scroller")
		let animateControls = document.createElement("button-area")
		let animateSave = document.createElement("button-area")
		let newFrame = HTMLUtilities.CreateUnsubmittableButton("+")
		let frameSkip = document.createElement("input")
		let lightboxButton = HTMLUtilities.CreateUnsubmittableButton("0")
		let repeatAnimation = HTMLUtilities.CreateUnsubmittableButton("→")
		let exportAnimation = HTMLUtilities.CreateUnsubmittableButton("⛟")
		let sendAnimation = HTMLUtilities.CreateUnsubmittableButton("➥")
		let playPause = HTMLUtilities.CreateUnsubmittableButton("►")
		let saveAnimationButton = HTMLUtilities.CreateUnsubmittableButton("📝")
		let loadAnimationButton = HTMLUtilities.CreateUnsubmittableButton("☝")
		let listAnimations = HTMLUtilities.CreateUnsubmittableButton("L")
		saveInput = document.createElement("input")
		saveInput.name = "name"
		saveInput.placeholder = "Animation Name"
		saveAnimationButton.title = "Save animation to server"
		loadAnimationButton.title = "Load animation from server"
		listAnimations.title = "List all animations (in chat)"
		lightboxButton.title = "Lightbox toggle"
		exportAnimation.title = "Export animation to gif"
		playPause.title = "Play / Stop animation"
		repeatAnimation.title = "Toggle animation loop"
		newFrame.title = "Insert new frame after current"
		sendAnimation.title = "Send animation in chat"
		sendAnimation.dataset.button = "sendAnimation"
		
		frameSkip.type = 'number'
		frameSkip.min = 1
		frameSkip.max = 600
		frameSkip.placeholder = "1=60fps"
		frameSkip.title = "Frame skip (1=60fps)"
		frameSkip.value = 3
		
		lightboxButton.addEventListener("click", event=>{
			let next = Number(lightboxButton.textContent) + 1
			if (next > 3) next = -3
			lightboxButton.textContent = String(next)
			animateFrames.SelectFrameIndex(animateFrames.GetSelectedFrameIndex())
		})
		
		let saveAnimationWrapper = (name)=>{
			UXUtilities.Toast("Saving... please wait")
			animationPlayer.frames = animateFrames.GetAllFrames()
			let object = animationPlayer.ToStorageObject()
			writePersistent(name + animationTag, object, ()=>{
				UXUtilities.Toast("Saved animation '" + name + "'")
			})
		}
		
		let loadAnimationWrapper = (name)=>{
			readPersistent(name + animationTag, (value)=>{
				//Perform the version 1 conversion... eugh
				if (!value.version || value.version < 2) {
					let loadCount = 0
					value.times = value.frames
					value.data = []
					value.version = 2
					
					console.log("Loading an older animation")
					
					for (let i = 0; i < value.times.length; i++) {
						/* jshint ignore:start */
						let index = i
						readPersistent(name + animationTag + "_" + index, (drawing)=>{
							value.data[index] = drawing
							loadCount++
							
							if (loadCount === value.times.length) {
								loadAnimation(value)
								UXUtilities.Toast("Loaded animation '" + name + "'")
							}
						})
						/* jshint ignore:end */
					}
				} else {
					loadAnimation(value)
					UXUtilities.Toast("Loaded animation '" + name + "'")
				}
			})
		}
		
		saveAnimationButton.addEventListener("click", (event)=>{
			if (!saveInput.value) {
				UXUtilities.Toast("You must give the animation a name!")
				return
			}
			
			getAnimations((anims)=>{
				if (anims.includes(saveInput.value)) {
					UXUtilities.Confirm("There's already an animation named " + saveInput.value + ", are you sure you want to overwrite it?", (confirmed)=>{
						if (confirmed) saveAnimationWrapper(saveInput.value)
					})
				} else {
					saveAnimationWrapper(saveInput.value)
				}
			})
		})
		
		listAnimations.addEventListener("click", event=>{
			getAnimations((anims)=>{
				localModuleMessage("Your animations: \n" + anims.join("\n"))
			}, listAnimations)
		})
		
		loadAnimationButton.addEventListener("click", event=>{
			if (!saveInput.value) {
				UXUtilities.Toast("You must give a name to load an animation!")
				return
			}
			getAnimations((anims)=>{
				if (!anims.includes(saveInput.value)) {
					UXUtilities.Toast("Couldn't find animation " + saveInput.value)
					return
				}
				UXUtilities.Confirm("You will lose any unsaved progress. Are you sure you want to load " + saveInput.value + "?", (confirmed)=>{
					if (confirmed) loadAnimationWrapper(saveInput.value)
				})
			})
		})
		
		newFrame.addEventListener("click", event=>{
			animateFrames.InsertNewFrame(animateFrames.GetSelectedFrameIndex(), true)
		})
		
		repeatAnimation.addEventListener("click", event=>{
			if (repeatAnimation.hasAttribute("data-repeat")) {
				delete repeatAnimation.dataset.repeat
				repeatAnimation.textContent = "→"
			} else {
				repeatAnimation.dataset.repeat = true
				repeatAnimation.textContent = "⟲"
			}
		})
		
		sendAnimation.addEventListener("click", event=>{
			UXUtilities.Confirm("A copy of your current animation will be created and become publicly available. Animation will use the currently selected frame as a title card. Are you sure you want to post your animation?", (confirmed)=>{
				if (!confirmed)
					return
				UXUtilities.Toast("Uploading animation... please wait")
				animationPlayer.frames = animateFrames.GetAllFrames()
				let animation = animationPlayer.ToStorageObject()
				let uploadData = new FormData()
				uploadData.append("text", JSON.stringify(animation))
				RequestUtilities.XHRSimple(location.protocol + "//kland.smilebasicsource.com/uploadtext", (response)=>{
					if (response.startsWith("http")) {
						sendDrawing(response)
					} else {
						UXUtilities.Toast("The animation failed to upload! " + response)
					}
				}, uploadData)
			})
		})
		
		exportAnimation.addEventListener("click", ev=>{
			UXUtilities.Confirm("Your animation will be captured as-is and turned into a gif. Frame timings may be slightly off due to gif timings, particularly lower frame times. Are you ready to export your animation?", (confirmed)=>{
				if (!confirmed)
					return
				UXUtilities.Toast("Exporting animation... please wait")
				animationPlayer.frames = animateFrames.GetAllFrames()
				let animation = animationPlayer.ToStorageObject(true)
				let uploadData = new FormData()
				uploadData.append("animation", JSON.stringify(animation))
				uploadData.append("bucket", ChatDrawUtilities.ExportBucket()); //"chatDrawAnimations")
				RequestUtilities.XHRSimple(location.protocol + "//kland.smilebasicsource.com/uploadimage", (response)=>{
					if (response.startsWith("http")) {
						window.open(response, "_blank")
					} else {
						console.log(response)
						UXUtilities.Toast("The animation failed to upload! " + response)
					}
				}, uploadData)
			})
		})
		
		animationPlayer = new AnimationPlayer(canvas, false, (newValue)=>{ 
			if (newValue === undefined) {
				return repeatAnimation.hasAttribute("data-repeat")
			} else {
				if (newValue != repeatAnimation.hasAttribute("data-repeat"))
					repeatAnimation.click()
			}
		}, (newValue)=>{ 
			if (newValue === undefined)
				return frameSkip.value
			else
				frameSkip.value = newValue
		})
		
		animationPlayer.OnPlay = (player)=>{
			if (!frameSkip.value) {
				UXUtilities.Toast("Invalid frametime value")
				return false
			}
			
			player.frames = animateFrames.GetAllFrames()
			
			player.disabledAction = drawer.OnAction
			drawer.OnAction = ()=>{}
			newFrame.disabled = true
			buttonArea.disabled = true
			playPause.textContent = "■"
			lightbox.style.display = "none"
		}
		
		animationPlayer.OnStop = (player)=>{
			playPause.textContent = "►"
			drawer.OnAction = player.disabledAction
			newFrame.disabled = false
			buttonArea.disabled = false
			drawer.Redraw()
			lightbox.style.display = ""
		}
		
		playPause.addEventListener("click", event=>{
			if (animationPlayer.IsPlaying())
				animationPlayer.Stop()
			else
				animationPlayer.Play(animateFrames.GetSelectedFrameIndex())
		})
		
		animateControls.appendChild(newFrame)
		animateControls.appendChild(frameSkip)
		animateControls.appendChild(lightboxButton)
		animateControls.appendChild(repeatAnimation)
		animateControls.appendChild(exportAnimation)
		animateControls.appendChild(sendAnimation)
		animateControls.appendChild(playPause)
		animateScroller.appendChild(frameContainer); //animateFrames)
		animateSave.appendChild(saveInput)
		animateSave.appendChild(saveAnimationButton)
		animateSave.appendChild(loadAnimationButton)
		animateSave.appendChild(listAnimations)
		animateArea.appendChild(animateControls)
		animateArea.appendChild(animateScroller)
		animateArea.appendChild(animateSave)
		
		$root.attachShadow({mode: 'open'})
		let shadow = $root.shadowRoot
		
		let style = document.createElement('link')
		style.rel = 'stylesheet'
		style.href = 'chatdraw.css'
		shadow.append(style)
		
		shadow.append(drawArea)
		if (allowAnimation)
			shadow.append(animateArea)
		
		messagePane.append($root)
		
		//Make sure the interface is hidden, since we create it exposed.
		animateFrames.SelectFrameIndex(0)
		widthButton.click()
		freehandButton.click()
		toggleInterface({target: toggleButton})
		
		let scale = Math.floor((document.body.getBoundingClientRect().right - 200) / 200)
		$root.style.setProperty('--scale', MathUtilities.MinMax(scale, 1, 3))
		
		drawer.moveToolClearColor = rgbToFillStyle(getClearColor())
	}
	
	let interfaceVisible = ()=>{
		try {
			return !$root.dataset.hidden
		} catch(ex) {
			LogSystem.RootLogger.log("Error while checking interface visibility: " + ex)
		}
	}
	
	let toggleInterface = (event, allowResize)=>{
		try {
			if ($root.dataset.hidden)
				delete $root.dataset.hidden
			else
				$root.dataset.hidden = true
			
			if (drawIframe && !firstTimeRecentered && (allowResize !== false)) {
				console.debug("DOING A HIDDEN DISPLAY FORCE SIZE HACK")
				drawIframe.contentWindow.postMessage({recenter:true}, "*")
				drawIframe.contentWindow.postMessage({recenter:true}, "*")
				//because I don't feel like figuring out why it requires two so I
				//just let it happen twice.
				firstTimeRecentered = true
			}
		} catch(ex) {
			LogSystem.RootLogger.log("Error while toggling drawing interface: " + ex)
		}
	}
	
	let scaleInterface = (event)=>{
		try {
			let rect = $root.getBoundingClientRect()
			
			let scale = +$root.style.getPropertyValue('--scale') || 1
			let originalWidth = rect.width / scale
			
			//Figure out the NEXT scale.
			if (scale < maxScale && document.body.getBoundingClientRect().right - (originalWidth) * (scale + 1) - 200 > 5)
				scale++
			else
				scale = 1
			
			$root.style.setProperty('--scale', scale)
		} catch(ex) {
			LogSystem.RootLogger.log("Error while scaling drawing interface: " + ex)
		}
	}
	
	//The function that is called when the given colorButton is selected. The
	//canvas is also given so that colors may be swapped if necessary
	let colorButtonSelect = (colorButton, canvas)=>{
		let alreadySelected = colorButton.dataset.selected
		let buttons = getColorButtons()
		
		//Reset everything
		for (let i = 0; i < buttons.length; i++) {
			delete buttons[i].dataset.selected
		}
		
		//Set current button to this one.
		colorButton.dataset.selected = "true"
		
		//If this button was already selected, perform the color swap.
		if (alreadySelected) {
			colorPicker.associatedButton = colorButton
			colorPicker.value = rgbToHex(fillStyleToRgb(colorButton.style.color))
			colorPicker.focus()
			colorPicker.click()
		} else {
			drawer.color = colorButton.style.color
		}
	}
	
	//Send the current drawing to the chat.
	let sendDrawing = (animationLink)=>{
		try {
			let message = animateFrames.GetFrame().ToString()
			if (animationLink) message = "(" + animationLink + ")" + message
			sendMessage("/drawsubmit " + message, false)
		} catch(ex) {
			LogSystem.RootLogger.log("Error while sending drawing: " + ex)
		}
	}
	
	let sendDrawing2 = ()=>{
		drawIframe.contentWindow.postMessage({uploadImage:true}, "*")
	}
	
	//Get the colors from the drawing area buttons
	let getButtonColors = ()=>{
		let colors = []
		let buttons = getColorButtons()
		
		for (let i = 0; i < buttons.length; i++)
			colors.push(fillStyleToRgb(buttons[i].style.color))
		
		return colors
	}
	
	//Get the color that is best suited to be a clearing color (the color that
	//is closest to either white or black, whichever comes first)
	let getClearColor = ()=>{
		let colors = getButtonColors()
		let max = 0
		let clearColor = 0
		
		for (let i = 0; i < colors.length; i++) {
			let full = Math.pow((colors[i][0] + colors[i][1] + colors[i][2] - (255 * 3 / 2 - 0.1)), 2)
			
			if (full > max) {
				max = full
				clearColor = i
			}
		}
		
		return colors[clearColor]
	}
	
	//Get the buttons representing the color switching
	let getColorButtons = ()=>{
		return drawArea.querySelectorAll("button-area button." + colorButtonClass)
	}
	
	return {
		"getColorButtons": getColorButtons,
		"checkMessageForDrawing": checkMessageForDrawing,
		"setupInterface": setupInterface,
		"getButtonColors": getButtonColors,
		"drawingWidth": chatDrawCanvasWidth,
		"drawingHeight": chatDrawCanvasHeight,
		"createToolButton": createToolButton,
		"getDrawer": ()=>drawer,
		"getAnimateFrames": ()=>animateFrames,
		"getAnimationPlayer": ()=>animationPlayer,
		"loadAnimation": loadAnimation
	}
	
})()

//The legacy fixed palette, if you need it.
let legacyPalette = [
	[255,255,255], 
	[0,0,0],
	[255,0,0],
	[0,0,255],
]

//Convert a 3 channel palette color into a fill style
let rgbToFillStyle=(channels)=>{
	return "rgb(" + channels[0] + "," + channels[1] + "," + channels[2] + ")"
}

//Convert back from the rgba fill style to an array
let fillStyleToRgb=(fillStyle)=>{
	let regex = /^\s*rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)\s*$/i
	let result = regex.exec(fillStyle)
	return result ? [ Number(result[1]), Number(result[2]), Number(result[3]) ] : null
}

//Convert a hex color into RGB values
let hexToRGB=(hex)=>{
	// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
	hex = hex.replace(shorthandRegex, (m, r, g, b)=>{
		return r + r + g + g + b + b
	})
	
	let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
	return result ? [
		parseInt(result[1], 16),
		parseInt(result[2], 16),
		parseInt(result[3], 16)
	] : null
}

let rgbToHex=(channels)=>{
	return "#" + ((1 << 24) + (channels[0] << 16) + (channels[1] << 8) + channels[2]).toString(16).slice(1)
}

class AnimatorFrameSet {
	constructor(container) {
		this.container = container
		
		this.FrameTag = "animate-frame"
		this.FrameControlTag = "frame-controls"
		this.FramePaletteAttribute = "data-palette"
		this.FrameTimeAttribute = "data-time"
		this.SelectedAttribute = "data-selected"
		
		this.OnFrameSelected = false
		
		this.FrameTimeMax = 6000
		this.FrameTimeMin = 1
	}
	
	FrameSelected(frameData) {
		if (this.OnFrameSelected) this.OnFrameSelected(frameData)
	}
	
	ClearAllFrames() {
		this.container.textContent = ""
	}
	
	_GetAllFrameElements(selectedOnly) {
		return this.container.querySelectorAll(":scope > " + this.FrameTag + (selectedOnly ? '[' + this.SelectedAttribute + ']' : ""))
	}
	
	_GetIndexOfFrame(frame) {
		let elements = this._GetAllFrameElements()
		for (let i = 0; i < elements.length; i++) {
			if (elements[i].isSameNode(frame))
				return i
		}
		return -1
	}
	
	_IsSelected(frame) {
		return this._GetIndexOfFrame(frame) === this.GetSelectedFrameIndex()
	}
	
	_GetDataFromFrame(frameElement) {
		let element = frameElement.querySelector('[' + this.FrameTimeAttribute + ']')
		let time = Number(element.value)
		
		let frame = new AnimatorFrame(
			frameElement.querySelector("canvas"),
			ChatDrawUtilities.StringToPalette(frameElement.getAttribute(this.FramePaletteAttribute)),
			time <= this.FrameTimeMax && time >= this.FrameTimeMin ? time : 0
		)
		
		frame.timeElement = element
		return frame
	}
	
	//Fill the given frame element with the given data (for instance, set palette,
	//time, etc)
	_FillFrameWithData(frameElement, frameData) {
		frameElement.setAttribute(this.FramePaletteAttribute, ChatDrawUtilities.PaletteToString(frameData.palette))
		
		let original = this._GetDataFromFrame(frameElement)
		
		//Fill canvas IF it's not exactly the same canvas
		if (!original.canvas.isSameNode(frameData.canvas))
			CanvasUtilities.CopyInto(original.canvas.getContext("2d"), frameData.canvas)
		
		if (frameData.time)
			original.timeElement.value = frameData.time
		else
			original.timeElement.value = ""
	}
	
	_SelectFrame(frameElement) {
		//First, get rid of all selected attributes
		let selected = this._GetAllFrameElements(true)
		let i
		
		for (i = 0; i < selected.length; i++)
			selected[i].removeAttribute(this.SelectedAttribute)
		
		frameElement.setAttribute(this.SelectedAttribute, "true")
		this.FrameSelected(this._GetDataFromFrame(frameElement))
	}
	
	//Insert a new frame AFTER the given index. If index is negative or there are
	//no frames, frame is inserted at beginning.
	InsertNewFrame(index, selectNow) {
		let palette
		let canvas = ChatDrawUtilities.CreateCanvas()
		let me = this
		
		try {
			palette = this.GetFrame().palette
		} catch (ex) {
			palette = ChatDrawUtilities.BaseColors
		}
		
		CanvasUtilities.Clear(canvas, ChatDrawUtilities.GetClearColor(palette).ToRGBString())
		
		let frameData = new AnimatorFrame(canvas, palette, 0)
		
		let frame = document.createElement(this.FrameTag)
		let frameControls = document.createElement(this.FrameControlTag)
		let frameTime = document.createElement("input")
		let frameCopy = HTMLUtilities.CreateUnsubmittableButton("📋")
		let framePaste = HTMLUtilities.CreateUnsubmittableButton("📤")
		let frameDelete = HTMLUtilities.CreateUnsubmittableButton("✖")
		
		frameTime.setAttribute(this.FrameTimeAttribute, "")
		frameTime.className = "left"
		frameTime.title = "Individual frame time"
		frameCopy.className = "left"
		frameCopy.title = "Copy frame content"
		framePaste.title = "Paste frame content"
		frameDelete.className = "alerthover"
		frameDelete.title = "Delete frame (cannot be undone!)"
		
		frame.addEventListener("click", e=>{
			me._SelectFrame(frame)
		})
		
		frameCopy.addEventListener("click", event=>{
			StorageUtilities.WriteLocal(ChatDrawUtilities.ClipboardKey, me._GetDataFromFrame(frame).ToString())
			UXUtilities.Toast("Copied frame to clipboard (chatdraw only!)")
		})
		
		framePaste.addEventListener("click", event=>{
			let clipboard = StorageUtilities.ReadLocal(ChatDrawUtilities.ClipboardKey)
			let myData = me._GetDataFromFrame(frame)
			
			if (clipboard) {
				let newFrame = ChatDrawUtilities.ChatDrawToFrame(clipboard)
				newFrame.time = myData.time
				me._FillFrameWithData(frame, newFrame)
				
				//Reselect frame just in case
				if (me._IsSelected(frame)) me._SelectFrame(frame)
			} else {
				UXUtilities.Toast("No chatdraw on clipboard")
			}
		})
		
		frameDelete.addEventListener("click", event=>{
			if (me.GetFrameCount() === 1) {
				UXUtilities.Toast("You can't delete the only frame!")
				return
			}
			
			UXUtilities.Confirm("Are you sure you want to delete this frame?", (c)=>{
				if (c) {
					let toSelect = frame.nextElementSibling || frame.previousElementSibling
					
					//If you're deleting the selected frame, select the "next" frame
					if (me._IsSelected(frame)) 
						me._SelectFrame(toSelect)
					
					frame.remove()
				}
			})
		})
		
		frameControls.appendChild(frameTime)
		frameControls.appendChild(frameCopy)
		frameControls.appendChild(frameDelete)
		frameControls.appendChild(framePaste)
		frame.appendChild(canvas)
		frame.appendChild(frameControls)
		
		this._FillFrameWithData(frame, frameData)
		
		let frames = this._GetAllFrameElements()
		
		if (index >= frames.length)
			index = frames.length - 1
		
		if (frames.length === 0 || index < 0)
			this.container.prepend(frame)
		else
			frames[index].after(frame)
		
		if (selectNow) this._SelectFrame(frame)
		
		return frameData
	}
	
	GetFrame(index) {
		if (index === undefined) index = this.GetSelectedFrameIndex()
		let frames = this._GetAllFrameElements()
		return this._GetDataFromFrame(frames[index])
	}
	
	SetFrame(frame, index) {
		if (index === undefined) index = this.GetSelectedFrameIndex()
		let frames = this._GetAllFrameElements()
		this._FillFrameWithData(frames[index], frame)
		if (index === this.GetSelectedFrameIndex())
			this.SelectFrameIndex(index)
	}
	
	GetSelectedFrameIndex() {
		let allFrames = this._GetAllFrameElements()
		
		for (let i = 0; i < allFrames.length; i++) {
			if (allFrames[i].hasAttribute(this.SelectedAttribute))
				return i
		}
		
		return -1
	}
	
	SelectFrameIndex(index) {
		let allFrames = this._GetAllFrameElements()
		this._SelectFrame(allFrames[index])
	}
	
	GetAllFrames() {
		let allFrames = []
		let allElements = this._GetAllFrameElements()
		
		for (let i = 0; i < allElements.length; i++)
			allFrames.push(this._GetDataFromFrame(allElements[i]))
		
		return allFrames
	}
	
	GetFrameCount() {
		return this._GetAllFrameElements().length
	}
}

//An animator frame is just a container to hold data
class AnimatorFrame {
	constructor(canvas, palette, time) {
		this.canvas = canvas
		this.palette = palette
		this.time = time
	}
	
	ToString() {
		return ChatDrawUtilities.FrameToChatDraw(this)
	}
}

class AnimationPlayer {
	constructor(canvas, frames, repeatFunction, defaultTimeFunction) {
		this.canvas = canvas
		this.frames = frames
		
		this._hiddenRepeat = true
		this._hiddenDefaultTime = 3
		
		this.GetRepeat = repeatFunction || ((value)=>{ 
			if (value === undefined) 
				return this._hiddenRepeat
			else
				this._hiddenRepeat = value;      
		})
		this.GetDefaultTime = defaultTimeFunction || ((value)=>{
			if (value === undefined)
				return this._hiddenDefaultTime
			else
				this._hiddenDefaultTime = value
		})
		
		this._playing = false
		this._frameCount = 0
		this._currentFrame = 0
		
		this.OnPlay = false
		this.OnStop = false
	}
	
	IsPlaying() {
		return this._playing
	}
	
	_Animate() {
		if (this._playing) {
			let skip = this.frames[this._currentFrame - 1] && this.frames[this._currentFrame - 1].time ? 
				this.frames[this._currentFrame - 1].time : this.GetDefaultTime()
			
			if ((this._frameCount % skip) === 0) {
				this._frameCount = 0
				
				if (this._currentFrame >= this.frames.length && this.GetRepeat())
					this._currentFrame = 0
				
				if (this._currentFrame >= this.frames.length) {
					this.Stop()
					return
				}
				
				CanvasUtilities.CopyInto(this.canvas.getContext("2d"), this.frames[this._currentFrame].canvas)
				this._currentFrame++
			}
			
			this._frameCount++
			
			window.requestAnimationFrame(this._Animate.bind(this))
		}
	}
	
	Play(startFrame) {
		if (this.OnPlay) {
			if (this.OnPlay(this) === false) {
				console.debug("Play was cancelled by OnPlay")
				return
			}
		}
		
		this._playing = true
		this._frameCount = 0
		this._currentFrame = 0
		if (startFrame !== undefined) this._currentFrame = startFrame
		
		this._Animate()
	}
	
	Stop() {
		this._playing = false
		if (this.OnStop) this.OnStop(this)
	}
	
	FromStorageObject(storeObject) {
		if (storeObject.version !== 2) {
			throw "Storage object must be converted to the latest version!"
		}
		
		this.frames = []
		
		for (let i = 0; i < storeObject.data.length; i++) {
			this.frames[i] = ChatDrawUtilities.ChatDrawToFrame(storeObject.data[i])
			this.frames[i].time = storeObject.times[i]
		}
		
		this.GetRepeat(storeObject.repeat)
		this.GetDefaultTime(storeObject.defaultFrames)
	}
	
	ToStorageObject(pngs) {
		let baseData = { 
			version: 2,
			defaultFrames: this.GetDefaultTime(), 
			repeat: this.GetRepeat(),
			times: [],
			data: []
		}
		
		for (let i = 0; i < this.frames.length; i++) {
			if (this.frames[i].time)
				baseData.times.push(this.frames[i].time)
			else
				baseData.times.push(0)
			
			if (pngs)
				baseData.data.push(this.frames[i].canvas.toDataURL("image/png"))
			else
				baseData.data.push(this.frames[i].ToString())
		}
		
		return baseData
	}
	
	//To
}

let ChatDrawUtilities = {
	DefaultWidth: 200,
	DefaultHeight: 100,
	ClipboardKey: "chatdrawClipboard",
	ExportBucket: ()=>{
		return "chatDrawAnimations"
	},
	
	BaseColors: [
		new Color(255,255,255),
		new Color(0, 0, 0),
		new Color(255, 0, 0),
		new Color(0, 0, 255)
	],
	LegacyColors: [
		new Color(255,255,255),
		new Color(0, 0, 0),
		new Color(255, 0, 0),
		new Color(0, 0, 255)
	],
	
	PaletteToString: (palette)=>{
		let colorSet = ""
		
		for (let i = 0; i < palette.length; i++) {
			colorSet += palette[i].ToRGBString()
			if (i !== palette.length - 1) colorSet += "/"
		}
		
		return colorSet
	},
	StringToPalette: (string)=>{
		let colors = string.split("/")
		let result = []
		
		for (let i = 0; i < colors.length; i++)
			result.push(StyleUtilities.GetColor(colors[i]))
		
		return result
	},
	
	GetClearColor: (palette)=>{
		let max = 0
		let clearColor = 0
		
		for (let i = 0; i < palette.length; i++) {
			let full = Math.pow((palette[i].r + palette[i].g + palette[i].b - (255 * 3 / 2 - 0.1)), 2)
			
			if (full > max) {
				max = full
				clearColor = i
			}
		}
		
		return palette[clearColor]
	},
	
	CreateCanvas: ()=>{
		let canvas = document.createElement("canvas")
		canvas.width = ChatDrawUtilities.DefaultWidth
		canvas.height = ChatDrawUtilities.DefaultHeight
		canvas.getContext("2d").imageSmoothingEnabled = false
		return canvas
	},
	
	//First canvas is bottom
	CreateLightbox: (frames, destination, opacities)=>{
		CanvasUtilities.Clear(destination)
		
		let context = destination.getContext("2d")
		
		for (let i = 0; i < frames.length; i++) {
			//This might be expensive! Make sure the browser doesn't slow down
			//from all these created canvases!
			let copy = CanvasUtilities.CreateCopy(frames[i].canvas, frames[i].canvas)
			let clearColor = ChatDrawUtilities.GetClearColor(frames[i].palette)
			CanvasUtilities.SwapColor(copy.getContext("2d"), clearColor, 
			                          new Color(clearColor.r, clearColor.g, clearColor.b, 0), 0)
			//context.globalAlpha = MathUtilities.Lerp(minAlpha, maxAlpha, (i + 1) / frames.length)
			context.globalAlpha = opacities[i]
			context.drawImage(copy,0,0)
		}
	},
	
	FrameToChatDraw: (frame)=>{
		let time = performance.now()
		
		let canvas = frame.canvas
		let palette = frame.palette
		
		//Get that 2d context yo. Oh and also, the pixel data and whatever.
		let context = canvas.getContext("2d")
		let imageData = context.getImageData(0,0,canvas.width,canvas.height)
		let pixelData = imageData.data
		let bitsPerPixel = Math.ceil(Math.log2(palette.length))
		let pixelsPerByte = Math.floor(8 / bitsPerPixel)
		let currentPalette = 0
		let currentByte = 0
		let baseData = ""
		let i = 0, j = 0, k = 0
		
		let paletteArray = []
		
		for (i = 0; i < palette.length; i++)
			paletteArray.push(palette[i].ToArray())
		
		//Go by 4 because RGBA. Data is encoded in row-major order.
		for (i = 0; i < pixelData.length; i+=4) {
			//Shift is how much to shift the current palette value. All this math
			//and we still can't add up T_T
			shift = ((i / 4) % pixelsPerByte) * bitsPerPixel
			
			//Merge character into base data string.
			if (i !== 0 && shift === 0) {
				baseData += String.fromCharCode(currentByte)
				currentByte = 0
			}
			
			//This is the palette representation of the current pixel.
			currentPalette = 0
			
			//Check pixel color against palette colors to get palette value.
			for (j = 0; j < paletteArray.length; j++) {
				if (paletteArray[j][0] === pixelData[i] &&
				    paletteArray[j][1] === pixelData[i + 1] &&
				    paletteArray[j][2] === pixelData[i + 2]) {
					currentPalette = j
					break
				}
			}
			
			//Add palette to current byte.
			currentByte += currentPalette << shift
		}
		
		//ALWAYS add the last byte because no matter what, there WILL be extra
		//data leftover, since the current byte is added at the start of the loop
		baseData += String.fromCharCode(currentByte)
		
		//OY! Before you go, add all the palette data. Yeah that's right, we
		//encode the full RGB color space in the palette data. So what?
		for (i = 0; i < paletteArray.length; i++)
			for (j = 0; j < 3; j++) //DO NOT INCLUDE THE ALPHA CHANNEL!
				baseData += String.fromCharCode(paletteArray[i][j])
		
		baseData += String.fromCharCode(paletteArray.length)
		
		let encodedString = LZString.compressToBase64(baseData)
		
		return encodedString
	},
	
	ChatDrawToFrame: (string)=>{
		//Legacy images need their original palette. The new images will have the
		//palette encoded within them.
		let width = ChatDrawUtilities.DefaultWidth
		let height = ChatDrawUtilities.DefaultHeight
		let palette = ChatDrawUtilities.LegacyColors; //ChatDrawUtilities.BaseColors; //legacyPalette.slice()
		let realData = LZString.decompressFromBase64(string)
		let i, j, k
		
		//Fix up the palette data based on legacy support. If legacy is detected
		//(ie we have less than or equal to the minimum amount of bytes necessary) 
		//then use default palette. Otherwise, the number of bytes afterwards 
		//determines how the data is encoded.
		if (realData.length > Math.ceil((width * height)/ 4)) {
			//The very last byte tells us how many palette colors there are. 
			let paletteCount = realData.charCodeAt(realData.length - 1)
			
			palette = []
			
			//Now read all the "apparent" palette bytes.
			for (i = 0; i < paletteCount; i++) {
				let color = []
				
				//build color from 3 channels
				for (j = 0; j < 3; j++)
					color.push(realData.charCodeAt(realData.length - 1 - (paletteCount - i) * 3 + j));   
				
				palette.push(new Color(color[0], color[1], color[2]))
			}
		}
		
		let canvas = document.createElement("canvas")
		canvas.width = width
		canvas.height = height
		
		let context = canvas.getContext("2d")
		
		let imageData = context.getImageData(0, 0, canvas.width, canvas.height)
		let pixelData = imageData.data
		let totalPixels = Math.floor(pixelData.length / 4)
		
		let currentByte
		let currentPalette
		let currentPixel = 0
		let bitsPerPixel = Math.ceil(Math.log2(palette.length))
		let pixelsPerByte = Math.floor(8 / bitsPerPixel)
		
		byte_loop: //loop over all the bytes.
		for (i = 0; i < realData.length; i++) {
			currentByte = realData.charCodeAt(i)
			
			//Loop over the pixels within the bytes! Usually 4 for legacy
			for (j = 0; j < pixelsPerByte; j++) {
				//AND out the bits that we actually want.
				currentPalette = currentByte & ((1 << bitsPerPixel) - 1)
				
				//That times 4 is because pixels are 4 bytes and whatever.
				pixelData[currentPixel * 4] =     palette[currentPalette].r; //[0]
				pixelData[currentPixel * 4 + 1] = palette[currentPalette].g; //[1]
				pixelData[currentPixel * 4 + 2] = palette[currentPalette].b; //[2]
				pixelData[currentPixel * 4 + 3] = 255
				
				//Shift over to get the next set of bits.
				currentByte = currentByte >> bitsPerPixel;   
				currentPixel++
				
				//Stop entire execution when we reach the end of the pixels.
				if (currentPixel >= totalPixels)
					break byte_loop
			}
		}
		
		// Draw the ImageData at the given (x,y) coordinates.
		context.putImageData(imageData, 0, 0)
		return new AnimatorFrame(canvas, palette, 0)
	}
}
