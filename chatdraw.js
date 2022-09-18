'use strict'

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
				x._change(x, null)
			}
		} else {
			x.onclick = ev=>{
				x._click(x)
			}
		}
		
		let btn = document.createElement('span')
		btn.textContent = label
		let outer = document.createElement('label')
		outer.className = "btn layered"
		outer.append(x, btn)
		
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
			this._change(this, null)
		} else
			this.checked = true
	}
}

//Carlos Sanchez - 2016
//randomouscrap98@aol.com
//-Yo, check it out. Drawing. In chat. 

class ChatDraw extends HTMLElement {
	constructor() {
		super()
		super.attachShadow({mode: 'open'})
		
		this.$container = document.createElement('div')
		this.$container.className = "layered"
		
		this.$form = document.createElement('form')
		this.$form.className = "controls"
		
		this.$picker = document.createElement('input')
		this.$picker.hidden = true
		this.$picker.type = 'color'
		
		super.shadowRoot.append(
			new.target.style.cloneNode(true),
			this.$container,
			this.$form,
			this.$picker
		)
		
		this.width = 200
		this.height = 100
		
		this.maxLineWidth = 7
		
		this.color_buttons = []
		
		this.grp = new Grp(this.width, this.height)
		
		this.$container.append(this.grp.canvas)
		
		this.drawer = new CanvasDrawer()
		
		this.drawer.ResetUndoBuffer(10) // why is this called here?
		this.drawer.undoBuffer.onchange = ()=>{
			this.$form.undo.disabled = !this.drawer.CanUndo()
			this.$form.redo.disabled = !this.drawer.CanRedo()
		}
		
		this.drawer.get_extra = ()=>{
			return {
				palette: this.color_buttons.map(x=>x.dataset.color)
			}
		}
		this.drawer.set_extra = ({palette})=>{
			this.restore_colors(palette)
		}
		
		let make_cursor=(size=1)=>{
			this.grp.canvas.style.cursor = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${size+2}" height="${size+2}"><rect x="${size/2+0.5}" y="${size/2+0.5}" width="1" height="1"/><rect x="0.5" y="0.5" width="${size+1}" height="${size+1}" fill="none" stroke="red"/></svg>') ${size/2+0.5} ${size/2+0.5}, none`
		}
		
		make_cursor(3)
		
		let row1 = document.createElement('menu')
		let row2 = document.createElement('menu')
		this.$form.append(row1, row2)
		
		row1.append(
			new Button('zoom', 'button', "🔍", 1, e=>{
				this.scaleInterface()
			}, ev=>{}).parentNode,
			new Button('undo', 'button', "↶", null, e=>{ this.drawer.Undo() }).parentNode,
			new Button('redo', 'button', "↷", null, e=>{ this.drawer.Redo() }).parentNode,
		)
		
		for (let i=0; i<BaseColors.length; i++) {
			let input = new Button('color', 'radio', "■", "", e=>{
				this.show_picker(e)
			}, (e, old)=>{
				if (old) {
					if (e.dataset.color != e.value) {
						this.drawer.UpdateUndoBuffer()
						this.drawer.SwapColor(e.dataset.color, e.value)
						e.dataset.color = e.value
					}
					e.nextSibling.style.color = e.value
					if (!e.checked)
						return
				}
				this.use_color(e)
			})
			this.color_buttons.push(input)
			input.dataset.color = BaseColors[i]
			input.set(BaseColors[i])
			row1.append(input.parentNode)
		}
		
		row1.append(
			new Button('send', 'button', "➥", null, ev=>{ this.sendDrawing() }).parentNode
		)
		
		// todo: make this like toolbutotn
		let sizes = ['1','2','3','4','5','6','7']
		let thickness = new Button('thickness', 'button', sizes, sizes, x=>{
			x.cycle()
		}, x=>{
			this.drawer.lineWidth = +x.value
		})
		
		row2.append(
			new Button('clear', 'button', "❌️", null, e=>{
				if (this.drawer.strokeCount)
					this.drawer.UpdateUndoBuffer()
				this.clear()
				this.drawer.strokeCount = 0 //todo: hack
			}).parentNode,
			thickness.parentNode
		)
		
		let tool_click = e=>{
			e.cycle()
		}
		let tool_change = (e, old)=>{
			if (old==null || e.checked)
				this.use_tool(e.value)
		}
		
		let def_tool = new Button('tool', 'radio', ["✏️", "✒️","🚿️"], ['freehand', 'slow', 'spray'], tool_click, tool_change)
		let p = new Button('tool', 'radio', ["🤚️"], ['mover'], tool_click, tool_change)
		p.parentNode.style.order = "-1"
		row2.append(
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
		this.grp.fillStyle = this.getClearColor()
		this.grp.clear()
		this.grp.restore()
	}
	
	restore_colors(list) {
		for (let i=0; i<this.color_buttons.length; i++) {
			let btn = this.color_buttons[i]
			btn.dataset.color = list[i]
			btn.set(list[i])
		}
	}
	
	use_color(btn) {
		this.drawer.color = btn.value
	}
	use_tool(name) {
		this.drawer.currentTool = name
	}
	
	show_picker(btn) {
		let picker = this.$picker
		picker.value = btn.value
		picker.onchange = ev=>{
			picker.onchange = null
			btn.set(picker.value)
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
		let [btn] = Math2.FindBest(this.color_buttons, (btn)=>{
			let hex = btn.value
			let x = parseInt(hex.slice(1), 16)
			let r = x>>>16 & 255
			let g = x>>>8 & 255
			let b = x & 255
			return Math.pow(r + g + b - (255 * 3/2 - 0.1), 2)
		})
		return btn.value
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
* {
	contain: strict;
}

.layered > * {
	position: absolute;
	width: 100%;
	height: 100%;
	margin: 0;
	box-sizing: border-box;
	display: block;
}

:host {
	display: inline-flex !important;
	flex-flow: column;
	--scale: 1;
	padding: 1px;
}

:host > div {
	position: relative;
	margin-bottom: 1px;
	cursor: crosshair;
	box-sizing: content-box;
	width: calc(var(--scale) * var(--width) * 1px);
	height: calc(var(--scale) * var(--height) * 1px);
}

:host > div canvas {
	padding: 0;
	border: none;
	image-rendering: -moz-crisp-edges;
	image-rendering: pixelated;
}

.controls {
	display: contents;
}

.controls > menu {
	display: flex;
	justify-content: flex-end;
	contain: content;
	padding: 0;
	margin: 0;
}

.controls .btn {
	width: calc(var(--scale) * 25px);
	height: calc(var(--scale) * 25px);
}

.btn {
	position: relative;
}

.btn > input {
	opacity: 0;
	appearance: none;
	cursor: pointer;
}

.btn > span {
	pointer-events: none;
	text-align: center;
	font-size: calc(var(--scale) * 14px);
	line-height: calc(var(--scale) * 25px);
	-webkit-user-select: none; -moz-user-select: none; user-select: none;
}

/* colors */

:host {
	background: #BBB;
}

.controls > menu {
	background: #E9E9E6;	
}

.btn > span {
	background: #F0F0F0; /*ButtonFace*/
	color: #888;
	text-shadow:
		1px 1px 0px black;
}

.btn > input:focus-visible + span {
	outline: auto;
	outline-offset: -2px;
}

.btn > :hover + span {
	background: #2929291A;
}

.btn > :disabled + span {
	color: #666;
	background: #2929291A;
}

.btn > :checked + span {
	color: #E9E9E6;
	background: #888;
}
`

//#A7E258

let BaseColors = [
	"#FFFFFF",
	"#000000",
	"#FF0000",
	"#0000FF",
]

customElements.define('chat-draw', ChatDraw)

// erode/dilate tool would be neat

// what if fills and strokes used different colors like
// you could draw a red circle outline, fill it with red, and then fill it with some other color and the red would be back?
