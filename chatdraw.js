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
		
		// URGENT TODO: this is inefficient, since it captures all mouse moves and etc. we need to fix the inner stroke detector to work with shadow DOM.
		//drawer.onlyInnerStrokes = false
		
		this.$form.onchange = ev=>{
			let e = ev.target
			if (e.dataset.timer) {
				clearTimeout(e.dataset.timer)
				delete e.dataset.timer
			}
			if (e.name=='color') {
				this.use_color(+e.value)
			} else if (e.name=='tool') {
				this.use_tool(e.value)
			}
		}
		this.$form.oncontextmenu = ev=>ev.preventDefault()
		this.$form.onauxclick = this.$form.onclick = ev=>{
			let e = ev.target
			if (e.type=='radio') {
				if (ev.type=='click')
					e.dataset.timer = setTimeout(()=>{
						if (e.name=='color') {
							this.show_picker(+e.value)
						} else if (e.name=='tool') {
							this.cycle_tool(e)
						}
					})
				else {
					if (e.name=='tool') {
						this.cycle_tool(e, -1)
					}
				}
			}
			let p = e.onplay
			if (p)
				p(ev)
		}
		
		this.$row1.append(
			this.button('zoom', '1', "🔍", ev=>{ this.scaleInterface() }).parentNode,
			this.button('undo', null, "↶", ev=>{ this.drawer.Undo() }).parentNode,
			this.button('redo', null, "↷", ev=>{ this.drawer.Redo() }).parentNode
		)
		
		for (let i=0; i<BaseColors.length; i++) {
			let input = this.button('color', i, "■")
			this.color_buttons.push(input)
			this.palette.push(null)
			this.set_color(i, BaseColors[i])
			this.$row1.append(input.parentNode)
		}
		
		this.$row1.append(
			this.button('send', null, "➥", ev=>{ this.sendDrawing() }).parentNode
		)
		
		// todo: make this like toolbutotn
		let thickness = this.button('thickness', 1, 1, ev=>{
			let e = ev.target
			let dir = ev.button==2 ? -1 : 1
			let width = (+e.value-1 + dir + this.maxLineWidth) % this.maxLineWidth + 1
			e.nextSibling.textContent = width
			e.value = width
			this.drawer.lineWidth = width
		})
		
		this.$row2.append(
			this.button('clear', null, "❌️", ev=>{
				if (this.drawer.strokeCount)
					this.drawer.UpdateUndoBuffer()
				this.clear()
			}).parentNode,
			thickness.parentNode
		)
		
		let def_tool = this.createToolButton(["✏️", "✒️","🚿️"], ['freehand', 'slow', 'spray'])
		let p = this.createToolButton(["🤚"], ['mover'])
		p.style.order = "-1"
		this.$row2.append(
			p,
			this.createToolButton(["🪣️", "❎️"], ['fill', 'clear']),
			this.createToolButton(["📏️", "🔲️", "🔵"], ['line', 'square', 'disc']),
			def_tool,
			this.button('toggle', null, "✎", ev=>{	/* ... */ }).parentNode
		)
		
		def_tool.firstChild.click()
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
	
	cycle_tool(btn, dir=1) {
		let tools = btn.dataset.tools.split(",")
		let labels = btn.dataset.labels.split(",")
		let tool = btn.value
		let index = tools.indexOf(tool)
		index = (index+dir+tools.length) % tools.length
		btn.value = tools[index]
		btn.nextSibling.textContent = labels[index]
		//btn.nextSibling.title = tools[index]
		if (btn.checked)
			this.use_tool(btn.value)
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
	
	// could be separate class?
	button(name, value, text, onplay=null) {
		let input = document.createElement('input')
		Object.assign(input, {type:onplay?'button':'radio', name, value, onplay})
		
		let btn = document.createElement('span')
		btn.textContent = text
		//btn.title = onplay?name:value
		
		document.createElement('label').append(input, btn)
		
		return input
	}
	
	createToolButton(labels, tools) {
		let input = this.button('tool', tools[0], labels[0])
		input.dataset.tools = tools.join(",")
		input.dataset.labels = labels.join(",")
		return input.parentNode
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
	new Color(50,50,50), // 0 - 63.5 (#000-#333)
	new Color(100,100,100), // 63.75 - 127.5 (#444-#777)
	new Color(150,150,150), // 127.5 - 191.25 (#888-#BBB)
	new Color(200,200,200), // 191.25 - 255 (#CCC-#FFF)
]

customElements.define('chat-draw', ChatDraw)

// erode/dilate tool would be neat

// what if fills and strokes used different colors like
// you could draw a red circle outline, fill it with red, and then fill it with some other color and the red would be back?
