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
		ChatDraw.template(this)
		
		this.width = 200
		this.height = 100
		
		this.drawer = new CanvasDrawer()
		
		this.maxLineWidth = 7
		let defaultLineWidth = 2
		
		let maxScale = 5
		
		this.tool_buttons = []
		let freehandButton = this.createToolButton(["✏️","✒️","🚿️"], ["freehand","slow","spray"])
		let lineButton = this.createToolButton(["📏️","🔲️"], ["line", "square"])
		let fillButton = this.createToolButton(["🪣️","❎️"], ["fill","clear"])
		let moveButton = this.createToolButton(["↔️"], ["mover"])
		this.canvas = this.CreateCanvas()
		this.$container.append(this.canvas)
		
		this.drawer.Attach(this.canvas, 5, true)
		this.drawer.OnUndoStateChange = ()=>{
			this.$undo.disabled = !this.drawer.CanUndo()
			this.$redo.disabled = !this.drawer.CanRedo()
		}
		// URGENT TODO: this is inefficient, since it captures all mouse moves and etc. we need to fix the inner stroke detector to work with shadow DOM.
		//drawer.onlyInnerStrokes = false
		
		//Set up the color picker
		this.$color_picker.onchange = event=>{
			let newColor = Color.from_input(event.target.value)
			console.log(newColor, StyleUtilities.GetColor(event.target.associatedButton.style.color))
			
			CanvasUtilities.SwapColor(
				this.canvas.getContext("2d"),
				StyleUtilities.GetColor(event.target.associatedButton.style.color),
				newColor,
				0
			)
			event.target.associatedButton.style.color = newColor.ToRGBString()
			this.drawer.color = newColor.ToRGBString()
			this.drawer.moveToolClearColor = rgbToFillStyle(this.getClearColor())
			this.drawer.Redraw()
		}
		
		//Set up the various control buttons (like submit, clear, etc.)
		this.$clear.onclick = ev=>{
			if (this.drawer.StrokeCount())
				this.drawer.UpdateUndoBuffer()
			CanvasUtilities.Clear(this.canvas, rgbToFillStyle(this.getClearColor()))
			this.drawer.Redraw()
		}
		this.$thickness.textContent = defaultLineWidth - 1
		this.$thickness.dataset.width = defaultLineWidth - 1
		this.$thickness.onclick = ev=>{ this.widthToggle() }
		this.$send.onclick = ev=>{ this.sendDrawing() }
		this.$toggle.onclick = ev=>{ this.toggleInterface() }
		this.$zoom.onclick = ev=>{ this.scaleInterface() }
		this.$undo.onclick = ev=>{ this.drawer.Undo() }
		this.$redo.onclick = ev=>{ this.drawer.Redo() }
		this.drawer.DoUndoStateChange()
		
		this.color_buttons = []
		this.palette = []
		this.current_color = -1
		
		//Create the color picking buttons
		for (let i=0; i<BaseColors.length; i++) {
			let btn = HTMLUtilities.CreateUnsubmittableButton()
			
			btn.textContent = "■"
			btn.className = 'colorChange'
			btn.onclick = ev=>{
				this.colorButtonSelect(ev.target.dataset.index)
			}
			
			btn.dataset.index = i
			this.color_buttons.push(btn)
			this.palette.push(BaseColors[i])
		}
		this.$color_p.replaceWith(...this.color_buttons)
		this.colorButtonSelect(1)
		
		this.$tool1.replaceWith(moveButton)
		this.$tool2.replaceWith(fillButton, lineButton, freehandButton)
		
		let elem = document.createElement('chat-draw')
		elem.attachShadow({mode: 'open'})
		elem.shadowRoot.append(this.$root)
		this.$root = elem
		
		this.$thickness.click()
		freehandButton.click()
		this.toggleInterface()
		
		let scale = Math.floor((window.screen.width - 200) / 200)
		this.$root.style.setProperty('--scale', MathUtilities.MinMax(scale, 1, 3))
		
		this.drawer.moveToolClearColor = rgbToFillStyle(this.getClearColor())
	}
	
	setButtonColors(palette) {
		let buttons = this.color_buttons
		
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
	
	widthToggle() {
		let width = (+this.$thickness.dataset.width % this.maxLineWidth) + 1
		this.$thickness.textContent = width
		this.$thickness.dataset.width = width
		this.drawer.lineWidth = width
	}
	
	//Get the color that is best suited to be a clearing color (the color that
	//is closest to either white or black, whichever comes first)
	getClearColor() {
		let colors = this.palette
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
	
	colorButtonSelect(index) {
		for (let i=0; i<this.palette.length; i++) {
			let btn = this.color_buttons[i]
			if (i==index) {
				if (btn.hasAttribute('aria-selected')) {
					this.$color_picker.associatedButton = btn
					this.$color_picker.value = this.palette[i].ToHexString()
					this.$color_picker.click()
				} else {
					btn.setAttribute('aria-selected', true)
				}
			} else
				btn.removeAttribute('aria-selected')
		}
		this.drawer.color = this.palette[index].ToHexString()
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
		this.tool_buttons.push(tButton)
		tButton.className = "toolButton"
		tButton.onclick = ev=>{
			//First, deselect ALL other buttons
			let toolButtons = this.tool_buttons
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
	
	CreateCanvas() {
		let canvas = document.createElement('canvas')
		canvas.width = this.width
		canvas.height = this.height
		canvas.getContext("2d").imageSmoothingEnabled = false
		return canvas
	}
}

ChatDraw.template = HTML`
<canvas-container $=container></canvas-container>
<button-area>
	<button $=zoom>◲</button>
	<button $=undo>↶</button>
	<button $=redo>↷</button>
	<br $=color_p>
	<button $=send data-button="sendDrawing">➥</button>
</button-area>
<button-area>
	<br $=tool1>
	<button $=clear>❌️</button>
	<button $=thickness>0</button>
	<br $=tool2>
	<button $=toggle>✎</button>
</button-area>
<input $=color_picker type=color hidden>
<style>
:host {
	display: flex;
	flex-flow: column;
	--scale: 1;
	width: min-content;
}

canvas-container {
	position: relative;
}

canvas {
	display: inline-block;
	margin: 0.0rem;
	padding: 0;
	box-sizing: content-box;
	vertical-align: bottom;
	image-rendering: -moz-crisp-edges;
	image-rendering: crisp-edges;
	image-rendering: optimizespeed;
	image-rendering: pixelated;
	border: 1px solid #BBB;
	width: calc(var(--scale) * 200px);
	cursor: crosshair;
}

.overlay {
	position: absolute;
	left: 0;
	top: 0;
}

button-area {
	display: flex;
	justify-content: flex-end;
	font-size: 0;
	background: #E9E9E6;
	border: 1px #BBB;
	border-style: none solid;
}

button-area button {
	flex: none;
	appearance: none;
	border: none;
	border-radius: unset;
	outline: none;
	width: calc(var(--scale) * 25px);
	height: calc(var(--scale) * 25px);
	font-size: calc(var(--scale) * 14px);
	cursor: pointer;
}

button-area button:hover {
	background: #2929291A;
}

button-area button:disabled {
	color: #666;
	background: #2929291A;
}

button-area button[aria-selected] {
	color: #E9E9E6;
	background: #666;
}
</style>
`
//#A7E258
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

let rgbToHex=(channels)=>{
	return "#" + ((1 << 24) + (channels[0] << 16) + (channels[1] << 8) + channels[2]).toString(16).slice(1)
}

let BaseColors = [
	new Color(255,255,255),
	new Color(0, 0, 0),
	new Color(255, 0, 0),
	new Color(0, 0, 255)
]
