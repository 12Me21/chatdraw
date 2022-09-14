'use strict'

// button
// features:
// - cycling (cycles between options when clicked while already selected (or always, if normal button))
// - toggle (is checkbox)
// - radio (is radio)
// - special action when selected radio button clicked
// - regular button (performs action when clicked)

// click: when a momentary button is clicked
// reclick: when a selected radio button is clicked again
// (we can merge the above)

// choose: when a radio button is selected
// valuechange: when the value of a button changes (due to cycling or otherwise)
// maybe merge those 2 into onchange. with a flag saying whether the value changed or a different button was selected (so the palette btns can swap colors when needed)

// zoom button: ('zoom', 'button', [...], [...], x=>x.cycle(), x=>set_zoom())
// tool button: ('tool', 'radio', [...], [...], x=>x.cycle(), x=>currentTool=x)
// clear button: ('clear', 'button', "X", null, x=>clear(), null)
// color button: ('color', 'radio', "o", "#000000", x=>picker(x), (x,change)=>{if (change){swap_colors()} currentColor=x})

class Button extends HTMLInputElement {
	constructor(name, type, label, value, click, change) {
		let x = Object.setPrototypeOf(document.createElement('input'), new.target.prototype)
		x.name = name
		x.type = type
		if (Array.isArray(value)) {
			x._values = value
			x._labels = label
			value = value[0]
			label = label[0]
		}
		//x.textContent = label
		x.value = value
		x._click = click
		x._change = change
		if (type=='radio') {
			x.onclick = ev=>{
				x._timeout = setTimeout(()=>{
					x._click(x)
				})
			}
			x.onchange = ev=>{
				if (x._timeout) {
					clearTimeout(x._timeout)
					x._timeout = null
				}
				x._change(x, false)
			}
		} else {
			x.onclick = ev=>{
				x._click(x)
			}
		}
		
		let btn = document.createElement('span')
		btn.textContent = label
		document.createElement('label').append(x, btn)
		
		return x
	}
	cycle(dir=1) {
		let n = this._values.indexOf(this.value)
		if (n<0)
			n=0
		n = (n+dir+this._values.length) % this._values.length
		this.value = this._values[n]
		this.nextSibling.textContent = this._labels[n]
		if (this._change)
			this._change(this, true)
	}
	set(value) {
		this.value = value
		if (this._change)
			this._change(this, true)
	}
	select() {
		if (!this.checked) {
			this.checked = true
			this._change(this, false)
		} else
			this.checked = true
	}
}

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
		super.attachShadow({mode: 'open'})
		super.shadowRoot.append(
			new.target.style.cloneNode(true),
			this.$root
		)
		
		this.width = 200
		this.height = 100
		
		this.maxLineWidth = 7
		
		this.palette = []
		this.color_buttons = []
		
		this.grp = new Grp(this.width, this.height)
		this.$container.append(this.grp.canvas)
		
		this.drawer = new CanvasDrawer()
		
		this.drawer.ResetUndoBuffer(10)
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
		
		let make_cursor=(size=1)=>{
			this.grp.canvas.style.cursor = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size+2}" height="${size+2}"><rect x="${size/2+0.5}" y="${size/2+0.5}" width="1" height="1"/><rect x="0.5" y="0.5" width="${size+1}" height="${size+1}" fill="none" stroke="red"/></svg>') ${size/2+0.5} ${size/2+0.5}, none`
		}
		
		make_cursor(3)
		
		this.$row1.append(
			new Button('zoom', 'button', "🔍", 1, e=>{
				this.scaleInterface()
			}, ev=>{}).parentNode,
			new Button('undo', 'button', "↶", null, e=>{ this.drawer.Undo() }).parentNode,
			new Button('redo', 'button', "↷", null, e=>{ this.drawer.Redo() }).parentNode,
		)
		
		for (let i=0; i<BaseColors.length; i++) {
			let input = new Button('color', 'radio', "■", i, e=>{
				this.show_picker(+e.value)
			}, (e,nw)=>{
				if (nw) {
					//
				} else
					this.use_color(+e.value)
			})
			this.color_buttons.push(input)
			this.palette.push(null)
			this.set_color(i, BaseColors[i])
			this.$row1.append(input.parentNode)
		}
		
		this.$row1.append(
			new Button('send', 'button', "➥", null, ev=>{ this.sendDrawing() }).parentNode
		)
		
		// todo: make this like toolbutotn
		let sizes = ['1','2','3','4','5','6','7']
		let thickness = new Button('thickness', 'button', sizes, sizes, x=>{
			x.cycle()
		}, x=>{
			this.drawer.lineWidth = +x.value
		})
		
		this.$row2.append(
			new Button('clear', 'button', "❌️", null, e=>{
				if (this.drawer.strokeCount)
					this.drawer.UpdateUndoBuffer()
				this.clear()
			}).parentNode,
			thickness.parentNode
		)
		
		let tool_click = e=>{
			e.cycle()
		}
		let tool_change = (e,nw)=>{
			if (!nw || e.checked)
				this.use_tool(e.value)
		}
		
		let def_tool = new Button('tool', 'radio', ["✏️", "✒️","🚿️"], ['freehand', 'slow', 'spray'], tool_click, tool_change)
		let p = new Button('tool', 'radio', ["🤚️"], ['mover'], tool_click, tool_change)
		p.parentNode.style.order = "-1"
		this.$row2.append(
			p.parentNode,
			new Button('tool', 'radio', ["🪣️", "❎️"], ['fill', 'clear'], tool_click, tool_change).parentNode,
			new Button('tool', 'radio', ["📏️", "🔲️", "🔵"], ['line', 'square', 'disc'], tool_click, tool_change).parentNode,
			def_tool.parentNode,
			new Button('toggle', 'button', "✎", null, ev=>{ /* ... */ }).parentNode
		)
		
		def_tool.click()
		thickness.click()
		this.color_buttons[1].click()
		this.clear()
		this.drawer.undoBuffer.DoUndoStateChange()
		
		this.drawer.Attach(this.grp, true)
		
		this.overlay = this.drawer.overlay.canvas
		this.overlay.style.pointerEvents = 'none'
		this.$container.append(this.overlay)
	}
	
	connectedCallback() {
		let scale = Math.floor((window.screen.width - this.width) / this.width)
		this.style.setProperty('--scale', Math.min(Math.max(scale, 1), 3))
		this.style.setProperty('--width', this.width)
		this.style.setProperty('--height', this.height)
	}
	
	disconnectedCallback() {
	}
	
	clear() {
		this.grp.save()
		this.grp.fill_color = this.getClearColor()
		this.grp.clear()
		this.grp.restore()
	}
	
	restore_colors(list) {
		for (let i=0; i<this.palette.length; i++) {
			this.set_color(i, Color.from_hex(list[i]))
		}
	}
	
	use_color(index) {
		this.drawer.color = this.palette[index]
	}
	use_tool(name) {
		this.drawer.currentTool = name
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
			this.use_color(index)
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
	
	//Send the current drawing to the chat.
	sendDrawing(animationLink) {
		try {
			let message = this.canvas.ToString()
			sendMessage("/drawsubmit " + message, false)
		} catch(ex) {
			console.error("Error while sending drawing: " + ex)
		}
	}
	
	widthToggle(input, direction) {
	}
	
	//Get the color that is best suited to be a clearing color (the color that is closest to either white or black, whichever comes first)
	getClearColor() {
		let [col] = Math2.FindBest(this.palette, (col)=>{
			return col.clear_score()
		})
		return col
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
}
ChatDraw.style = document.createElement('style')
ChatDraw.style.textContent = `
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
	height: calc(var(--scale) * 25px);
}

.controls label {
	position: relative;
	/*display: contents;*/
}
.controls label > input {
	position: absolute;
	width: 100%;
	height: 100%;
	margin: 0;
	appearance: none;
	opacity: 0;
}
.controls label > input:focus-visible + span {
	outline: auto;
	outline-offset: -2px;
}

.controls label > span {
	display: block;
	pointer-events: none;
	text-align: center;
	box-sizing: border-box;
	width: calc(var(--scale) * 25px);
	font-size: calc(var(--scale) * 14px);
	line-height: calc(var(--scale) * 25px);
	cursor: pointer;
	background: ButtonFace;
	-webkit-user-select: none; -moz-user-select: none; user-select: none;
	color: #888;
	text-shadow:
		1px 1px 0px black;
}

.controls label > :hover + span {
	background: #2929291A;
}

.controls label > :disabled + span {
	color: #666;
	background: #2929291A;
}

.controls label > :checked + span {
	color: #E9E9E6;
	background: #888;
}
/*.controls label > [name="color"] + span {
	outline: 10px solid currentColor;
	outline-offset: -10px;
}*/
`

ChatDraw.template = HTML`
<canvas-container $=container></canvas-container>
<form $=form class=controls autocomplete=off>
	<div $=row1></div>
	<div $=row2></div>
</form>
<input $=color_picker type=color hidden>
`
//#A7E258

let BaseColors = [
	new Color(255,255,255),
	new Color(0,0,0),
	new Color(255,0,0),
	new Color(0,0,255),
]

customElements.define('chat-draw', ChatDraw)

// erode/dilate tool would be neat

// what if fills and strokes used different colors like
// you could draw a red circle outline, fill it with red, and then fill it with some other color and the red would be back?
