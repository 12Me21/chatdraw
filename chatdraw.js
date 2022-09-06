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

class ChatDraw extends HTMLElement {
	constructor() {
		super()
		new.target.template(this)
		this.attachShadow({mode: 'open'})
		this.shadowRoot.append(this.$root)
		
		this.width = 200
		this.height = 100
		
		this.canvas = this.CreateCanvas()
		this.context = this.canvas.getContext('2d')
		this.$container.append(this.canvas)
		
		this.drawer = new CanvasDrawer()
		this.drawer.Attach(this.canvas, 5, true)
		
		this.maxLineWidth = 7
		let defaultLineWidth = 2
		
		let maxScale = 5
		
		this.tool_buttons = []
		let freehandButton = this.createToolButton(["✏️","✒️","🚿️"], ["freehand","slow","spray"])
		let lineButton = this.createToolButton(["📏️","🔲️"], ["line", "square"])
		let fillButton = this.createToolButton(["🪣️","❎️"], ["fill","clear"])
		let moveButton = this.createToolButton(["↔️"], ["mover"])
		
		this.drawer.OnUndoStateChange = ()=>{
			this.$undo.disabled = !this.drawer.CanUndo()
			this.$redo.disabled = !this.drawer.CanRedo()
		}
		
		// URGENT TODO: this is inefficient, since it captures all mouse moves and etc. we need to fix the inner stroke detector to work with shadow DOM.
		//drawer.onlyInnerStrokes = false
		
		this.$color_picker.onchange = event=>{
			let e = event.currentTarget
			let index = +e.dataset.index
			let oldColor = this.palette[index]
			let newColor = Color.from_hex(e.value)
			
			this.SwapColor(oldColor, newColor)
			this.setButtonColor(index, newColor)
			this.drawer.moveToolClearColor = this.getClearColor().to_hex()
		}
		
		//Set up the various control buttons (like submit, clear, etc.)
		this.$clear.onclick = ev=>{
			if (this.drawer.StrokeCount())
				this.drawer.UpdateUndoBuffer()
			CanvasUtilities.Clear(this.canvas, this.getClearColor().to_hex())
		}
		this.$thickness.textContent = defaultLineWidth - 1
		this.$thickness.dataset.width = defaultLineWidth - 1
		this.$thickness.onclick = ev=>{ this.widthToggle() }
		this.$send.onclick = ev=>{ this.sendDrawing() }
		/*this.$toggle.onclick = ev=>{ this.toggleInterface() }*/
		this.$zoom.onclick = ev=>{ this.scaleInterface() }
		this.$undo.onclick = ev=>{ this.drawer.Undo() }
		this.$redo.onclick = ev=>{ this.drawer.Redo() }
		this.drawer.DoUndoStateChange()
		
		this.color_buttons = []
		this.palette = []
		
		//Create the color picking buttons
		for (let i=0; i<BaseColors.length; i++) {
			let btn = document.createElement('button')
			
			btn.textContent = "■"
			btn.className = 'colorChange'
			btn.onclick = ev=>{
				this.colorButtonSelect(ev.target.dataset.index)
			}
			
			btn.dataset.index = i
			this.color_buttons.push(btn)
			this.palette.push(null)
			this.setButtonColor(i, BaseColors[i])
		}
		this.$color_p.replaceWith(...this.color_buttons)
		this.colorButtonSelect(1)
		
		this.$tool1.replaceWith(moveButton)
		this.$tool2.replaceWith(fillButton, lineButton, freehandButton)
		
		this.$thickness.click()
		freehandButton.click()
		this.drawer.moveToolClearColor = this.getClearColor().to_hex()
		CanvasUtilities.Clear(this.canvas, this.getClearColor().to_hex())
	}
	
	SwapColor(original, newColor) {
		let iData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height)
		let data = iData.data
		
		for (let i=0; i<data.length; i+=4) {
			if (original.compare_data(data, i))
				newColor.write_data(data, i)
		}
		
		this.context.putImageData(iData, 0, 0)
	}
	
	connectedCallback() {
		let scale = Math.floor((window.screen.width - 200) / 200)
		this.style.setProperty('--scale', Math.min(Math.max(scale, 1), 3))
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
	
	setButtonColor(index, color) {
		this.palette[index] = color
		let btn = this.color_buttons[index]
		btn.style.color = color.to_hex()
		if (btn.hasAttribute('aria-selected'))
			this.drawer.color = color.to_hex()
	}
	
	colorButtonSelect(index) {
		for (let i=0; i<this.palette.length; i++) {
			let btn = this.color_buttons[i]
			if (i==index) {
				if (btn.hasAttribute('aria-selected')) {
					this.$color_picker.dataset.index = i
					this.$color_picker.value = this.palette[i].to_hex()
					this.$color_picker.click()
				} else {
					btn.setAttribute('aria-selected', true)
				}
			} else
				btn.removeAttribute('aria-selected')
		}
		this.drawer.color = this.palette[index].to_hex()
	}
	
	scaleInterface() {
		try {
			let rect = super.getBoundingClientRect()
			
			let scale = +super.style.getPropertyValue('--scale') || 1
			let originalWidth = rect.width / scale
			
			//Figure out the NEXT scale.
			if (scale < maxScale && window.screen.width - (originalWidth) * (scale + 1) - 200 > 5)
				scale++
			else
				scale = 1
			
			super.style.setProperty('--scale', scale)
		} catch(ex) {
			console.error("Error while scaling drawing interface: " + ex)
		}
	}
	
	createToolButton(labels, toolNames) {
		let nextTool = 0
		let btn = document.createElement('button')
		btn.textContent = labels[nextTool]
		
		this.tool_buttons.push(btn)
		btn.className = "toolButton"
		btn.onclick = ev=>{
			//First, deselect ALL other buttons
			let toolButtons = this.tool_buttons
			for (let i=0; i<toolButtons.length; i++) {
				if (toolButtons[i]!==btn) {
					toolButtons[i].removeAttribute("aria-selected")
				}
			}
			//Now figure out if we're just selecting this button or cycling
			//through the available tools
			if (btn.hasAttribute("aria-selected"))
				nextTool = (nextTool + 1) % toolNames.length
			
			btn.textContent = labels[nextTool]
			btn.setAttribute('aria-selected', true)
			this.drawer.currentTool = toolNames[nextTool]
		}
		return btn
	}
	
	CreateCanvas() {
		let canvas = document.createElement('canvas')
		canvas.width = this.width
		canvas.height = this.height
		canvas.getContext('2d').imageSmoothingEnabled = false
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
	background: #BBB;
	padding: 1px;
}

canvas-container {
	position: relative;
	margin-bottom: 1px;
	cursor: crosshair;
	box-sizing: content-box;
	width: calc(var(--scale) * 200px);
	height: calc(var(--scale) * 100px);
}

canvas {
	position: absolute;
	width: 100%;
	height: 100%;
	margin: 0;
	padding: 0;
	border: none;
	image-rendering: -moz-crisp-edges;
	image-rendering: crisp-edges;
	image-rendering: optimizespeed;
	image-rendering: pixelated;
}

button-area {
	display: flex;
	justify-content: flex-end;
	background: #E9E9E6;
}

button-area button {
	flex: none;
	appearance: none;
	border: none;
	border-radius: unset;
	outline: none;
	padding: 0;
	margin: 0;
	text-align: center;
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

let BaseColors = [
	new Color(255,255,255),
	new Color(0, 0, 0),
	new Color(255, 0, 0),
	new Color(0, 0, 255)
]

customElements.define('chat-draw', ChatDraw)

// todo: why don't we just use radio buttons for tools and colors?

// erode/dilate tool would be neat

// what if fills and strokes used different colors like
// you could draw a red circle outline, fill it with red, and then fill it with some other color and the red would be back?
