'use strict'

let HTML = ([html])=>{
	let temp = document.createElement('template')
	temp.innerHTML = html.replace(/\s*?\n\s*/g, "")
	let content = temp.content
	let root = content
	if (root.childNodes.length==1)
		root = root.firstChild
	let get_path = (root, node)=>{
		let path = ""
		while (node!==root) {
			let parent = node.parentNode
			let pos = [].indexOf.call(parent.childNodes, node)
			path = ".firstChild"+".nextSibling".repeat(pos) + path
			node = parent
		}
		return path
	}
	let init = `const node=document.importNode(this, true)
holder.$root=node`
	for (let node of content.querySelectorAll("[\\$]")) {
		let path = get_path(root, node)
		let id = node.getAttribute('$')
		node.removeAttribute('$')
		init += `
holder.$${id} = node${path}`
	}
	init += `
return holder`
	let c = new Function("holder={}", init).bind(root)
	return c
}

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
		
		this.colorPicker = document.createElement('input')
		
		this.maxLineWidth = 7
		
		let maxScale = 5
		let defaultLineWidth = 2
		
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
		this.canvas = this.CreateCanvas()
		this.lightbox = this.CreateCanvas()
		this.lightbox.className = "lightbox"
		
		this.drawer.Attach(this.canvas, [], 5)
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
			let newColor = StyleUtilities.GetColor(event.target.value)
			CanvasUtilities.SwapColor(this.canvas.getContext("2d"), StyleUtilities.GetColor(event.target.associatedButton.style.color), newColor, 0)
			event.target.associatedButton.style.color = newColor.ToRGBString()
			this.drawer.color = newColor.ToRGBString()
			this.drawer.moveToolClearColor = rgbToFillStyle(this.getClearColor())
			this.drawer.Redraw()
		}
		
		//Set up the various control buttons (like submit, clear, etc.)
		clearButton.textContent = "❌️"
		clearButton.onclick = ev=>{
			if (this.drawer.StrokeCount())
				this.drawer.UpdateUndoBuffer()
			CanvasUtilities.Clear(this.canvas, rgbToFillStyle(this.getClearColor()))
			this.drawer.Redraw()
		}
		this.$root.setAttribute("tabindex", "-1")
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
		
		buttonArea.append(cSizeButton, undoButton, redoButton)
		
		//Create the color picking buttons
		for (let i=0; i<BaseColors.length; i++) {
			let colorButton = HTMLUtilities.CreateUnsubmittableButton(); //makeUnsubmittableButton()
			
			colorButton.textContent = "■"
			colorButton.className = 'colorChange'
			colorButton.onclick = ev=>{
				this.colorButtonSelect(colorButton)
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
		canvasContainer.append(this.canvas, this.lightbox)
		this.drawArea.append(
			canvasContainer,
			buttonArea,
			buttonArea2,
			this.colorPicker,
		)
		
		this.$root.attachShadow({mode: 'open'})
		let shadow = this.$root.shadowRoot
		
		let style = document.createElement('link')
		style.rel = 'stylesheet'
		style.href = 'chatdraw.css'
		shadow.append(style)
		
		shadow.append(this.drawArea)
		
		widthButton.click()
		freehandButton.click()
		this.toggleInterface()
		
		let scale = Math.floor((window.screen.width - 200) / 200)
		this.$root.style.setProperty('--scale', MathUtilities.MinMax(scale, 1, 3))
		
		this.setButtonColors(BaseColors)
		this.drawer.moveToolClearColor = rgbToFillStyle(this.getClearColor())
	}
	
	setButtonColors(palette) {
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
	
	//Send the current drawing to the chat.
	sendDrawing(animationLink) {
		try {
			let message = this.canvas.ToString()
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
	colorButtonSelect(colorButton) {
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
		
		console.log('btn colors',buttons, colors)
		
		return colors
	}
	
	CreateCanvas() {
		let canvas = document.createElement('canvas')
		canvas.width = this.width
		canvas.height = this.height
		canvas.getContext("2d").imageSmoothingEnabled = false
		return canvas
	}
}

ChatDraw.template = HTML`
<chat-draw></chat-draw>
`

//Convert a 3 channel palette color into a fill style
let rgbToFillStyle=(channels)=>{
	return "rgb(" + channels[0] + "," + channels[1] + "," + channels[2] + ")"
}

//Convert back from the rgba fill style to an array
let fillStyleToRgb=(fillStyle)=>{
	let regex = /^\s*rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)\s*$/i
	let result = regex.exec(fillStyle)
	return result ? [+result[1], +result[2], +result[3]] : null
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
p
let rgbToHex=(channels)=>{
	return "#" + ((1 << 24) + (channels[0] << 16) + (channels[1] << 8) + channels[2]).toString(16).slice(1)
}

let BaseColors = [
	new Color(255,255,255),
	new Color(0, 0, 0),
	new Color(255, 0, 0),
	new Color(0, 0, 255)
]
