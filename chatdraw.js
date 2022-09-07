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
		
		this.maxLineWidth = 7
		let defaultLineWidth = 2
		this.palette = []
		this.color_buttons = []
		
		this.canvas = this.CreateCanvas()
		this.context = this.canvas.getContext('2d')
		this.$container.append(this.canvas)
		
		this.drawer = new CanvasDrawer()
		this.drawer.Attach(this.canvas, 5, true)
		this.drawer.undoBuffer.OnUndoStateChange = ()=>{
			this.$form.undo.disabled = !this.drawer.CanUndo()
			this.$form.redo.disabled = !this.drawer.CanRedo()
		}
		
		this.drawer.get_extra = ()=>{
			return {
				palette: this.palette.map(x=>x.to_hex())
			}
		}
		this.drawer.set_extra = ({palette})=>{
			this.restore_colors(palette)
		}
		
		// URGENT TODO: this is inefficient, since it captures all mouse moves and etc. we need to fix the inner stroke detector to work with shadow DOM.
		//drawer.onlyInnerStrokes = false
		
		let selected_color
		let selected_tool
		this.$form.onchange = ev=>{
			let name = ev.target.name
			if (name=='color') {
				selected_color = ev.target
				console.log(ev.target)
				this.colorButtonSelect(+ev.target.value)
			} else if (name=='tool') {
				selected_tool = ev.target
				this.drawer.currentTool = ev.target.value
			}
		}
		this.$form.onclick = ev=>{
			let name = ev.target.name
			if (name=='color') {
				if (ev.target === selected_color) {
					this.show_picker(+ev.target.value)
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
		
		this.$row1.append(
			this.create_button('button', 'zoom', '1', "◲").parentNode,
			this.create_button('button', 'undo', null, "↶").parentNode,
			this.create_button('button', 'redo', null, "↷").parentNode
		)
		
		for (let i=0; i<BaseColors.length; i++) {
			let input = this.create_button('radio', 'color', i, "■")
			this.color_buttons.push(input)
			this.palette.push(null)
			this.set_color(i, BaseColors[i])
			this.$row1.append(input.parentNode)
		}
		
		this.$row1.append(
			this.create_button('button', 'send', null, "➥").parentNode
		)
		
		let thickness = this.create_button('button', 'thickness', defaultLineWidth-1, defaultLineWidth-1)
		
		this.$row2.append(
			this.createToolButton(["↔️"], ['mover']),
			this.create_button('button', 'clear', null, "❌️").parentNode,
			thickness.parentNode
		)
		
		let def_tool = this.createToolButton(["✏️", "✒️","🚿️"], ['freehand', 'slow', 'spray'])
		this.$row2.append(
			this.createToolButton(["🪣️", "❎️"], ['fill', 'clear']),
			this.createToolButton(["📏️", "🔲️"], ['line',' square']),
			def_tool,
			this.create_button('button', 'toggle', null, "✎")
		)
		
		this.drawer.undoBuffer.DoUndoStateChange()
		def_tool.firstChild.click()
		thickness.click()
		this.color_buttons[1].click()
		this.drawer.moveToolClearColor = this.getClearColor().to_hex()
		this.clear()
	}
	
	clear() {
		CanvasUtilities.Clear(this.context, this.getClearColor().to_hex())
	}
	
	restore_colors(list) {
		for (let i=0; i<this.palette.length; i++) {
			this.set_color(i, Color.from_hex(list[i]))
		}
	}
	
	set_color(index, color, swap=false) {
		if (swap) {
			this.drawer.UpdateUndoBuffer()
			this.drawer.SwapColor(this.palette[index], color)
		}
		
		this.palette[index] = color
		
		let btn = this.color_buttons[index]
		let hex = color.to_hex()
		btn.nextSibling.style.color = hex
		if (btn.checked)
			this.drawer.color = hex
		
		if (swap) {
			this.drawer.moveToolClearColor = this.getClearColor().to_hex()
		}
	}
	
	show_picker(index) {
		let picker = this.$color_picker
		picker.value = this.palette[index].to_hex()
		picker.onchange = ev=>{
			picker.onchange = null
			let e = ev.target
			this.set_color(index, Color.from_hex(picker.value), true)
		}
		picker.click()
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
	
	widthToggle(input) {
		let width = (+input.value % this.maxLineWidth) + 1
		input.nextSibling.textContent = width
		input.value = width
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
	
	create_button(type, name, value, text=null) {
		let cont = document.createElement('label')
		let input = document.createElement('input')
		let btn = document.createElement('span')
		input.type = type
		input.name = name
		input.value = value
		input.hidden = true
		cont.append(input, btn)
		btn.textContent = text
		return input
	}
	
	createToolButton(labels, toolNames) {
		let input = this.create_button('radio', 'tool', toolNames[0], labels[0])
		input.dataset.tools = toolNames.join(",")
		input.dataset.labels = labels.join(",")
		return input.parentNode
	}
	
	cycle_tool(btn) {
		let tools = btn.dataset.tools.split(",")
		let labels = btn.dataset.labels.split(",")
		let tool = btn.value
		let index = tools.indexOf(tool)
		index = (index+1) % tools.length
		btn.value = tools[index]
		btn.nextSibling.textContent = labels[index]
		this.drawer.currentTool = btn.value
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
<form $=form class=controls autocomplete=off>
	<div $=row1></div>
	<div $=row2></div>
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

.controls > div {
	display: flex;
	justify-content: flex-end;
	background: #E9E9E6;
}

.controls label {
	display: contents;
}

.controls label > span {
	flex: none;
	text-align: center;
	width: calc(var(--scale) * 25px);
	height: calc(var(--scale) * 25px);
	font-size: calc(var(--scale) * 14px);
	line-height: calc(var(--scale) * 25px);
	cursor: pointer;
	background: ButtonFace;
	-webkit-user-select: none; -moz-user-select: none; user-select: none;
}

.controls label > span:hover {
	background: #2929291A;
}

.controls label > :disabled + span {
	color: #666;
	background: #2929291A;
}

.controls label > :checked + span {
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
