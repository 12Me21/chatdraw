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

/*let endian=()=>{
	return new Uint8Array(new Uint32Array([1]).buffer)[0]
}*/

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
		this.drawer.undoBuffer.OnUndoStateChange = ()=>{
			this.$form.undo.disabled = !this.drawer.CanUndo()
			this.$form.redo.disabled = !this.drawer.CanRedo()
		}
		this.drawer.undoBuffer.DoUndoStateChange()
		
		// URGENT TODO: this is inefficient, since it captures all mouse moves and etc. we need to fix the inner stroke detector to work with shadow DOM.
		//drawer.onlyInnerStrokes = false
		
		this.$color_picker.onchange = ev=>{
			let e = ev.target
			this.set_color(+e.dataset.index, Color.from_hex(e.value))
		}
		let selected_color
		let selected_tool
		
		this.$form.onchange = ev=>{
			let name = ev.target.name
			if (name=='color') {
				selected_color = ev.target
				this.colorButtonSelect(+ev.target.dataset.index)
			} else if (name=='tool') {
				selected_tool = ev.target
				this.drawer.currentTool = ev.target.dataset.tool
			}
		}
		this.$form.onclick = ev=>{
			let name = ev.target.name
			if (name=='color') {
				if (ev.target === selected_color) {
					this.show_picker(+ev.target.dataset.index)
				}
			} else if (name=='tool') {
				if (ev.target === selected_tool) {
					this.cycle_tool(ev.target)
				}
			} else if (name=='thickness') {
				this.widthToggle(ev.target)
			} else if (name=='send') {
				this.sendDrawing()
			} else if (name=='zoom') {
				this.scaleInterface()
			} else if (name=='undo') {
				this.drawer.Undo()
			} else if (name=='redo') {
				this.drawer.Redo()
			} else if (name=='clear') {
				if (this.drawer.strokeCount)
					this.drawer.UpdateUndoBuffer()
				this.clear()
			}
		}
		
		this.maxLineWidth = 7
		let defaultLineWidth = 2
		this.$thickness.value = defaultLineWidth - 1
		this.$thickness.dataset.width = defaultLineWidth - 1
		this.$thickness.click()
		
		this.palette = []
		this.color_buttons = []
		
		//Create the color picking buttons
		for (let i=0; i<BaseColors.length; i++) {
			let btn = document.createElement('input')
			btn.type = 'radio'
			btn.name = 'color'
			btn.textContent = "■"
			btn.dataset.index = i
			
			this.color_buttons.push(btn)
			this.palette.push(null)
			this.set_color(i, BaseColors[i])
		}
		this.$colors.replaceWith(...this.color_buttons)
		
		
		this.$tool1.replaceWith(
			this.createToolButton(["↔️"], ['mover'])
		)
		let def_tool = this.createToolButton(["✏️", "✒️","🚿️"], ['freehand', 'slow', 'spray'])
		this.$tool2.replaceWith(
			this.createToolButton(["🪣️", "❎️"], ['fill', 'clear']),
			this.createToolButton(["📏️", "🔲️"], ['line',' square']),
			def_tool
		)
		
		def_tool.click()
		this.color_buttons[1].click()
		this.drawer.moveToolClearColor = this.getClearColor().to_hex()
		this.clear()
	}
	
	clear() {
		CanvasUtilities.Clear(this.canvas, this.getClearColor().to_hex())
	}
	
	set_color(index, color, init) {
		let oldColor = this.palette[index]
		color.color[0] &= ~1
		color.color[0] |= (index>>1&1)
		color.color[2] &= ~1 
		color.color[2] |= (index&1)
		if (oldColor)
			this.drawer.SwapColor(oldColor, color)
		this.palette[index] = color
		let btn = this.color_buttons[index]
		btn.style.color = color.to_hex()
		btn.value = color.to_hex()
		if (btn.checked)
			this.drawer.color = color.to_hex()
		if (!init)
			this.drawer.moveToolClearColor = this.getClearColor().to_hex()
	}
	
	show_picker(index) {
		this.$color_picker.dataset.index = index
		this.$color_picker.value = this.palette[index].to_hex()
		this.$color_picker.click()
	}
	
	connectedCallback() {
		let scale = Math.floor((window.screen.width - this.width) / this.width)
		this.style.setProperty('--scale', Math.min(Math.max(scale, 1), 3))
		this.style.setProperty('--width', this.width)
		this.style.setProperty('--height', this.height)
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
	
	widthToggle(button) {
		let width = (+button.dataset.width % this.maxLineWidth) + 1
		button.value = width
		button.dataset.width = width
		this.drawer.lineWidth = width
	}
	
	//Get the color that is best suited to be a clearing color (the color that is closest to either white or black, whichever comes first)
	getClearColor() {
		let [col] = MathUtilities.FindBest(this.palette, (col)=>{
			return col.clear_score()
		})
		return col
	}
	
	colorButtonSelect(index) {
		this.drawer.color = this.palette[index].to_hex()
	}
	
	scaleInterface() {
		let rect = super.getBoundingClientRect()
		
		let scale = +super.style.getPropertyValue('--scale') || 1
		let originalWidth = rect.width / scale
		
		let maxScale = 5
		//Figure out the NEXT scale.
		if (scale < maxScale && window.screen.width - (originalWidth) * (scale + 1) - this.width > 5)
			scale++
		else
			scale = 1
		
		super.style.setProperty('--scale', scale)
	}
	
	createToolButton(labels, toolNames) {
		let nextTool = 0
		let btn = document.createElement('input')
		btn.type = 'radio'
		btn.name = 'tool'
		
		btn.dataset.tools = toolNames.join(",")
		btn.dataset.labels = labels.join(",")
		btn.dataset.tool = toolNames[nextTool]
		btn.textContent = labels[nextTool]
		
		return btn
	}
	
	cycle_tool(btn) {
		let tools = btn.dataset.tools.split(",")
		let labels = btn.dataset.labels.split(",")
		let tool = btn.dataset.tool
		let index = tools.indexOf(tool)
		index = (index+1) % tools.length
		btn.dataset.tool = tools[index]
		btn.textContent = labels[index]
		this.drawer.currentTool = btn.dataset.tool
		console.log(this.drawer.currentTool, 'current tool')
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
<form $=form class=controls>
	<fieldset>
		<input type=button name=zoom value="◲">
		<input type=button name=undo value="↶">
		<input type=button name=redo value="↷">
		<br $=colors>
		<input type=button name=send value="➥">
	</fieldset>
	<fieldset>
		<br $=tool1>
		<input type=button name=clear value="❌️">
		<input type=button name=thickness value="0" $=thickness>
		<br $=tool2>
		<input type=button name=toggle value="✎">
	</fieldset>
</form>
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
	width: calc(var(--scale) * var(--width) * 1px);
	height: calc(var(--scale) * var(--height) * 1px);
}

canvas-container canvas {
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

.controls {
	display: contents;
}

.controls fieldset {
	border: none;
	margin: 0;
	padding: 0;
	display: flex;
	justify-content: flex-end;
	background: #E9E9E6;
}

.controls input {
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
	line-height: calc(var(--scale) * 25px);
	cursor: pointer;
	background: ButtonFace;
}

.controls input:hover {
	background: #2929291A;
}

.controls input:disabled {
	color: #666;
	background: #2929291A;
}

.controls input:checked {
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
