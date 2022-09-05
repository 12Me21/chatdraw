'use strict'

//Carlos Sanchez - 2016
//randomouscrap98@aol.com
//-Yo, check it out. Drawing. In chat. 

class ChatDraw {
	constructor() {
		this.width = 200
		this.height = 100
		
		this.$root = document.createElement('chat-draw')
		
		this.drawArea = document.createElement("draw-area")
		
		this.drawer = new CanvasDrawer()
		
		let frameContainer = document.createElement("animate-frames")
		this.animateFrames = new AnimatorFrameSet(this, frameContainer)
		
		let repeatAnimation = HTMLUtilities.CreateUnsubmittableButton("→")
		let frameSkip = document.createElement("input")
		this.animationPlayer = new AnimationPlayer(canvas, false, (newValue)=>{
			let rep = repeatAnimation.hasAttribute("data-repeat")
			if (newValue === undefined) {
				return rep
			} else if (newValue != rep) {
				repeatAnimation.click()
			}
		}, (newValue)=>{ 
			if (newValue === undefined)
				return frameSkip.value
			else
				frameSkip.value = newValue
		})
		
		this.colorPicker = document.createElement('input')
		
		this.maxLineWidth = 7
		
		let hideCharacters = 20
		let maxScale = 5
		let defaultLineWidth = 2
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
		
		let parseColorString = (string)=>{
			let colors = string.split("/")
			let result = []
			
			for (let i=0; i<colors.length; i++)
				result.push(fillStyleToRgb(colors[i]))
			
			return result
		}
		
		let setButtonColors = (palette)=>{
			let buttons = this.getColorButtons()
			
			for (let i=0; i<palette.length; i++) {
				if (i<buttons.length) {
					buttons[i].style.color = palette[i].ToRGBString()
					if (buttons[i].hasAttribute("data-selected"))
						this.drawer.color = buttons[i].style.color
				}
			}
			
			this.drawer.moveToolClearColor = rgbToFillStyle(this.getClearColor())
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
		let freehandButton = this.createToolButton(["✏️","✒️","🚿️"], ["freehand","slow","spray"]); //["✏","✒"], 
		let lineButton = this.createToolButton(["📏️","🔲️"], ["line", "square"])
		let fillButton = this.createToolButton(["🪣️","❎️"], ["fill","clear"])
		let moveButton = this.createToolButton(["↔️"], ["mover"])
		let canvas = this.CreateCanvas()
		this.lightbox = this.CreateCanvas()
		this.lightbox.className = "lightbox"
		
		this.animateFrames.OnFrameSelected = (data)=>{
			setButtonColors(data.palette)
			this.drawer.buffers[0].canvas = data.canvas
			this.drawer.ClearUndoBuffer()
			this.drawer.Redraw()
			
			let lightboxFrames = []
			let lightboxCount = Number(lightboxButton.textContent)
			let selectedIndex = this.animateFrames.GetSelectedFrameIndex()
			let totalFrames = this.animateFrames.GetFrameCount()
			
			if (lightboxCount > 0) {
				for (let i = Math.max(0, selectedIndex - lightboxCount); i < selectedIndex; i++)
					lightboxFrames.push(this.animateFrames.GetFrame(i))
			} else {
				for (let i = Math.min(totalFrames - 1, selectedIndex - lightboxCount); i > selectedIndex; i--)
					lightboxFrames.push(this.animateFrames.GetFrame(i))
			}
			
			let opacities = [0.03, 0.12, 0.25]
			this.CreateLightbox(lightboxFrames, opacities.slice(-lightboxFrames.length))
		}
		
		let firstFrame = this.animateFrames.InsertNewFrame(0)
		
		this.drawer.Attach(canvas, [firstFrame.canvas], 5)
		this.drawer.OnUndoStateChange = ()=>{
			undoButton.disabled = !this.drawer.CanUndo()
			redoButton.disabled = !this.drawer.CanRedo()
		}
		// URGENT TODO: this is inefficient, since it captures all mouse moves and etc. we need to fix the inner stroke detector to work with shadow DOM.
		//drawer.onlyInnerStrokes = false
		
		//Set up the color picker
		this.colorPicker.type = 'color'
		this.colorPicker.style.position = "absolute"
		this.colorPicker.style.left = "-10000px"
		this.colorPicker.style.top = "-10000px"
		this.colorPicker.style.width = "0"
		this.colorPicker.style.height = "0"
		this.colorPicker.onchange = event=>{
			let frame = this.animateFrames.GetFrame(); //GetSelectedFrame()
			let newColor = StyleUtilities.GetColor(event.target.value)
			CanvasUtilities.SwapColor(frame.canvas.getContext("2d"), StyleUtilities.GetColor(event.target.associatedButton.style.color), newColor, 0)
			event.target.associatedButton.style.color = newColor.ToRGBString()
			this.drawer.color = newColor.ToRGBString()
			this.drawer.moveToolClearColor = rgbToFillStyle(this.getClearColor())
			this.drawer.Redraw()
			
			//TODO: Fix this later! Buttons should only be proxies for the real
			//colors stored in each frame! Don't set the palette based on the
			//buttons, set the palette when the user changes the color and ping
			//the palette back to the buttons (maybe with a call to "select" again)
			frame.palette = ChatDrawUtilities.StringToPalette(this.getButtonColorString())
			this.animateFrames.SetFrame(frame)
		}
		
		//Set up the various control buttons (like submit, clear, etc.)
		clearButton.textContent = "❌️"
		clearButton.onclick = ev=>{
			if (this.drawer.StrokeCount())
				this.drawer.UpdateUndoBuffer()
			CanvasUtilities.Clear(this.animateFrames.GetFrame().canvas, rgbToFillStyle(this.getClearColor()))
			this.drawer.Redraw()
		}
		this.$root.setAttribute("tabindex", "-1")
		this.$root.addEventListener("keydown", ev=>{
			if (this.drawArea.dataset.hidden)
				return
			if (ev.key === 'ArrowUp')
				this.selectNextRadio()
			if (ev.key === 'ArrowDown')
				this.selectPreviousRadio()
		})
		widthButton.textContent = defaultLineWidth - 1
		widthButton.dataset.width = defaultLineWidth - 1
		widthButton.onclick = ev=>{ this.widthToggle(widthButton) }
		sendButton.textContent = "➥"
		sendButton.dataset.button = "sendDrawing"
		sendButton.onclick = ev=>{ this.sendDrawing() }
		toggleButton.textContent = "✎"
		toggleButton.onclick = ev=>{this.toggleInterface()}
		cSizeButton.textContent = "◲"
		cSizeButton.onclick = ev=>{this.scaleInterface()}
		undoButton.textContent = "↶"
		undoButton.onclick = ev=>{
			this.drawer.Undo()
		}
		redoButton.textContent = "↷"
		redoButton.onclick = ev=>{
			this.drawer.Redo()
		}
		this.drawer.DoUndoStateChange()
		
		//These are the only elements that will be displayed if the drawing area
		//goes hidden. CSS doesn't have to look at these, ofc.
		toggleButton.dataset.keep = true
		buttonArea2.dataset.keep = true
		
		buttonArea.append(cSizeButton, undoButton, redoButton)
		
		//Create the color picking buttons
		for (let i = 0; i < ChatDrawUtilities.BaseColors.length; i++) {
			let colorButton = HTMLUtilities.CreateUnsubmittableButton(); //makeUnsubmittableButton()
			
			colorButton.textContent = "■"
			colorButton.className = 'colorChange'
			colorButton.onclick = ev=>{
				this.colorButtonSelect(colorButton, canvas)
			}
			
			buttonArea.append(colorButton)
			
			if (i == 1)
				colorButton.click()
		}
		
		buttonArea.append(sendButton)
		buttonArea2.append(
			moveButton,
			clearButton,
			widthButton,
			fillButton,
			lineButton,
			freehandButton,
			toggleButton
		)
		canvasContainer.append(canvas, this.lightbox)
		this.drawArea.append(
			canvasContainer,
			buttonArea,
			buttonArea2,
			this.colorPicker,
		)
		
		//Before we finish entirely, set up the animation area.
		let animateArea = document.createElement("animate-area")
		let animateScroller = document.createElement("animate-scroller")
		let animateControls = document.createElement("button-area")
		let animateSave = document.createElement("button-area")
		let newFrame = HTMLUtilities.CreateUnsubmittableButton("+")
		let lightboxButton = HTMLUtilities.CreateUnsubmittableButton("0")
		
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
		
		lightboxButton.onclick = event=>{
			let next = +lightboxButton.textContent + 1
			if (next > 3)
				next = -3
			lightboxButton.textContent = next
			this.animateFrames.SelectFrameIndex(this.animateFrames.GetSelectedFrameIndex())
		}
		
		let saveAnimationWrapper = (name)=>{
			UXUtilities.Toast("Saving... please wait")
			this.animationPlayer.frames = this.animateFrames.GetAllFrames()
			let object = this.animationPlayer.ToStorageObject()
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
								this.loadAnimation(value)
								UXUtilities.Toast("Loaded animation '" + name + "'")
							}
						})
						/* jshint ignore:end */
					}
				} else {
					this.loadAnimation(value)
					UXUtilities.Toast("Loaded animation '" + name + "'")
				}
			})
		}
		
		saveAnimationButton.onclick = (event)=>{
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
		}
		
		listAnimations.onclick = event=>{
			getAnimations((anims)=>{
				localModuleMessage("Your animations: \n" + anims.join("\n"))
			}, listAnimations)
		}
		
		loadAnimationButton.onclick = event=>{
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
		}
		
		newFrame.onclick = event=>{
			this.animateFrames.InsertNewFrame(this.animateFrames.GetSelectedFrameIndex(), true)
		}
		
		repeatAnimation.onclick = event=>{
			if (repeatAnimation.hasAttribute("data-repeat")) {
				delete repeatAnimation.dataset.repeat
				repeatAnimation.textContent = "→"
			} else {
				repeatAnimation.dataset.repeat = true
				repeatAnimation.textContent = "⟲"
			}
		}
		
		sendAnimation.onclick = event=>{
			UXUtilities.Confirm("A copy of your current animation will be created and become publicly available. Animation will use the currently selected frame as a title card. Are you sure you want to post your animation?", (confirmed)=>{
				if (!confirmed)
					return
				UXUtilities.Toast("Uploading animation... please wait")
				this.animationPlayer.frames = this.animateFrames.GetAllFrames()
				let animation = this.animationPlayer.ToStorageObject()
				let uploadData = new FormData()
				uploadData.append("text", JSON.stringify(animation))
				RequestUtilities.XHRSimple(location.protocol + "//kland.smilebasicsource.com/uploadtext", (response)=>{
					if (response.startsWith("http")) {
						this.sendDrawing(response)
					} else {
						UXUtilities.Toast("The animation failed to upload! " + response)
					}
				}, uploadData)
			})
		}
		
		exportAnimation.onclick = ev=>{
			UXUtilities.Confirm("Your animation will be captured as-is and turned into a gif. Frame timings may be slightly off due to gif timings, particularly lower frame times. Are you ready to export your animation?", (confirmed)=>{
				if (!confirmed)
					return
				UXUtilities.Toast("Exporting animation... please wait")
				this.animationPlayer.frames = this.animateFrames.GetAllFrames()
				let animation = this.animationPlayer.ToStorageObject(true)
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
		}
		
		this.animationPlayer = 
		
		this.animationPlayer.OnPlay = (player)=>{
			if (!frameSkip.value) {
				UXUtilities.Toast("Invalid frametime value")
				return false
			}
			
			player.frames = this.animateFrames.GetAllFrames()
			
			player.disabledAction = this.drawer.OnAction
			this.drawer.OnAction = ()=>{}
			newFrame.disabled = true
			buttonArea.disabled = true
			playPause.textContent = "■"
			this.lightbox.style.display = "none"
		}
		
		this.animationPlayer.OnStop = (player)=>{
			playPause.textContent = "►"
			this.drawer.OnAction = player.disabledAction
			newFrame.disabled = false
			buttonArea.disabled = false
			this.drawer.Redraw()
			this.lightbox.style.display = ""
		}
		
		playPause.onclick = event=>{
			if (this.animationPlayer.IsPlaying())
				this.animationPlayer.Stop()
			else
				this.animationPlayer.Play(this.animateFrames.GetSelectedFrameIndex())
		}
		
		animateControls.append(
			newFrame,
			frameSkip,
			lightboxButton,
			repeatAnimation,
			exportAnimation,
			sendAnimation,
			playPause
		)
		animateScroller.append(
			frameContainer
		)
		animateSave.append(
			saveInput,
			saveAnimationButton,
			loadAnimationButton,
			listAnimations
		)
		animateArea.append(
			animateControls,
			animateScroller,
			animateSave
		)
		
		this.$root.attachShadow({mode: 'open'})
		let shadow = this.$root.shadowRoot
		
		let style = document.createElement('link')
		style.rel = 'stylesheet'
		style.href = 'chatdraw.css'
		shadow.append(style)
		
		shadow.append(this.drawArea)
		if (allowAnimation)
			shadow.append(animateArea)
		
		//Make sure the interface is hidden, since we create it exposed.
		this.animateFrames.SelectFrameIndex(0)
		widthButton.click()
		freehandButton.click()
		this.toggleInterface()
		
		let scale = Math.floor((window.screen.width - 200) / 200)
		this.$root.style.setProperty('--scale', MathUtilities.MinMax(scale, 1, 3))
		
		this.drawer.moveToolClearColor = rgbToFillStyle(this.getClearColor())
	}
	
	getButtonColorString() {
		let getColorString = (colors)=>{
			let colorSet = ""
			
			for (let i = 0; i < colors.length; i++) {
				colorSet += rgbToFillStyle(colors[i])
				if (i !== colors.length - 1)
					colorSet += "/"
			}
			
			return colorSet
		}
		return getColorString(this.getButtonColors())
	}
	
	//Send the current drawing to the chat.
	sendDrawing(animationLink) {
		try {
			let message = this.animateFrames.GetFrame().ToString()
			if (animationLink)
				message = "(" + animationLink + ")" + message
			sendMessage("/drawsubmit " + message, false)
		} catch(ex) {
			console.error("Error while sending drawing: " + ex)
		}
	}
	
	widthToggle(widthButton) {
		let width = (+widthButton.dataset.width % this.maxLineWidth) + 1
		widthButton.textContent = width
		widthButton.dataset.width = width
		this.drawer.lineWidth = width
	}
	
	selectNextRadio() {
		let index = this.animateFrames.GetSelectedFrameIndex()
		if (index < this.animateFrames.GetFrameCount() - 1)
			this.animateFrames.SelectFrameIndex(index + 1)
	}
	
	selectPreviousRadio() {
		let index = this.animateFrames.GetSelectedFrameIndex()
		if (index > 0)
			this.animateFrames.SelectFrameIndex(index - 1)
	}
		
	//Get the color that is best suited to be a clearing color (the color that
	//is closest to either white or black, whichever comes first)
	getClearColor() {
		let colors = this.getButtonColors()
		let max = 0
		let clearColor = 0
		
		for (let i=0; i<colors.length; i++) {
			let full = Math.pow((colors[i][0] + colors[i][1] + colors[i][2] - (255 * 3 / 2 - 0.1)), 2)
			
			if (full > max) {
				max = full
				clearColor = i
			}
		}
		
		return colors[clearColor]
	}
	
	//The function that is called when the given colorButton is selected. The
	//canvas is also given so that colors may be swapped if necessary
	colorButtonSelect(colorButton, canvas) {
		let alreadySelected = colorButton.dataset.selected
		let buttons = this.getColorButtons()
		
		//Reset everything
		for (let i = 0; i < buttons.length; i++) {
			delete buttons[i].dataset.selected
		}
		
		//Set current button to this one.
		colorButton.dataset.selected = true
		
		//If this button was already selected, perform the color swap.
		if (alreadySelected) {
			this.colorPicker.associatedButton = colorButton
			this.colorPicker.value = rgbToHex(fillStyleToRgb(colorButton.style.color))
			this.colorPicker.focus()
			this.colorPicker.click()
		} else {
			this.drawer.color = colorButton.style.color
		}
	}
		
	toggleInterface() {
		if (this.$root.dataset.hidden)
			delete this.$root.dataset.hidden
		else
			this.$root.dataset.hidden = true
	}
	
	scaleInterface() {
		try {
			let rect = this.$root.getBoundingClientRect()
			
			let scale = +this.$root.style.getPropertyValue('--scale') || 1
			let originalWidth = rect.width / scale
			
			//Figure out the NEXT scale.
			if (scale < maxScale && window.screen.width - (originalWidth) * (scale + 1) - 200 > 5)
				scale++
			else
				scale = 1
			
			this.$root.style.setProperty('--scale', scale)
		} catch(ex) {
			console.error("Error while scaling drawing interface: " + ex)
		}
	}
	
	//Once you have a compliant v2 object, this is the actual load function.
	loadAnimation(storeObject) {
		this.animationPlayer.FromStorageObject(storeObject)
		this.animateFrames.ClearAllFrames()
		
		for (let i=0; i<this.animationPlayer.frames.length; i++) {
			this.animateFrames.InsertNewFrame(i-1)
			this.animateFrames.SetFrame(this.animationPlayer.frames[i], i)
		}
		
		this.animateFrames.SelectFrameIndex(0)
	}
	
	createToolButton(displayCharacters, toolNames) {
		if (!Array.isArray(displayCharacters))
			displayCharacters = [displayCharacters]
		if (!Array.isArray(toolNames))
			toolNames = [toolNames]
		let nextTool = 0
		let tButton = HTMLUtilities.CreateUnsubmittableButton(displayCharacters[nextTool])
		tButton.className = "toolButton"
		tButton.onclick = ev=>{
			//First, deselect ALL other buttons
			let toolButtons = this.drawArea.querySelectorAll("button.toolButton")
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
			this.drawer.currentTool = toolNames[nextTool]
		}
		return tButton
	}
	
	//Get the buttons representing the color switching
	getColorButtons() {
		return this.drawArea.querySelectorAll("button-area button.colorChange")
	}
	
	//Get the colors from the drawing area buttons
	getButtonColors() {
		let colors = []
		let buttons = this.getColorButtons()
		
		for (let i=0; i<buttons.length; i++)
			colors.push(fillStyleToRgb(buttons[i].style.color))
		
		return colors
	}
	
	CreateCanvas() {
		let canvas = document.createElement('canvas')
		canvas.width = this.width
		canvas.height = this.height
		canvas.getContext("2d").imageSmoothingEnabled = false
		return canvas
	}
	
	
	//First canvas is bottom
	CreateLightbox(frames, opacities) {
		CanvasUtilities.Clear(this.lightbox)
		
		let context = this.lightbox.getContext('2d')
		
		for (let i=0; i<frames.length; i++) {
			//This might be expensive! Make sure the browser doesn't slow down
			//from all these created canvases!
			let copy = CanvasUtilities.CreateCopy(frames[i].canvas, frames[i].canvas)
			let clearColor = ChatDrawUtilities.GetClearColor(frames[i].palette)
			CanvasUtilities.SwapColor(copy.getContext("2d"), clearColor, new Color(clearColor.r, clearColor.g, clearColor.b, 0), 0)
			context.globalAlpha = opacities[i]
			context.drawImage(copy, 0, 0)
		}
	}
}

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
	constructor(chatdraw, container) {
		this.container = container
		this.chatdraw = chatdraw
		
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
		let canvas = this.chatdraw.CreateCanvas()
		let me = this
		
		try {
			palette = this.GetFrame().palette
		} catch (ex) {
			palette = ChatDrawUtilities.BaseColors
		}
		
		CanvasUtilities.Clear(canvas, ChatDrawUtilities.GetClearColor(palette).ToRGBString())
		
		let frameData = new AnimatorFrame(canvas, palette, 0)
		
		let frame = document.createElement(this.FrameTag)
		frame.onclick = ev=>{
			me._SelectFrame(frame)
		}
		frame.append(canvas)
		
		let frameControls = document.createElement(this.FrameControlTag)
		frame.append(frameControls)
		
		let frameTime = document.createElement("input")
		frameTime.setAttribute(this.FrameTimeAttribute, "")
		frameTime.title = "Individual frame time"
		frameControls.append(frameTime)
		
		let frameCopy = HTMLUtilities.CreateUnsubmittableButton("📋")
		frameCopy.title = "Copy frame content"
		frameCopy.onclick = event=>{
			StorageUtilities.WriteLocal(ChatDrawUtilities.ClipboardKey, me._GetDataFromFrame(frame).ToString())
			UXUtilities.Toast("Copied frame to clipboard (chatdraw only!)")
		}
		frameControls.append(frameCopy)
		
		frameControls.append(document.createElement('spacer'))
		
		let framePaste = HTMLUtilities.CreateUnsubmittableButton("📤")
		framePaste.title = "Paste frame content"
		framePaste.onclick = event=>{
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
		}
		frameControls.append(framePaste)
		
		let frameDelete = HTMLUtilities.CreateUnsubmittableButton("✖")
		frameDelete.className = "alerthover"
		frameDelete.title = "Delete frame (cannot be undone!)"
		frameDelete.onclick = event=>{
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
		}
		frameControls.append(frameDelete)
		
		this._FillFrameWithData(frame, frameData)
		
		let frames = this._GetAllFrameElements()
		
		if (index >= frames.length)
			index = frames.length - 1
		
		if (frames.length === 0 || index < 0)
			this.container.prepend(frame)
		else
			frames[index].after(frame)
		
		if (selectNow)
			this._SelectFrame(frame)
		
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
	
	PaletteToString(palette) {
		let colorSet = ""
		
		for (let i = 0; i < palette.length; i++) {
			colorSet += palette[i].ToRGBString()
			if (i !== palette.length - 1) colorSet += "/"
		}
		
		return colorSet
	},
	StringToPalette(string) {
		let colors = string.split("/")
		let result = []
		
		for (let i = 0; i < colors.length; i++)
			result.push(StyleUtilities.GetColor(colors[i]))
		
		return result
	},
	
	GetClearColor(palette) {
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
}
