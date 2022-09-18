'use strict'

class CanvasPerformer {
	constructor() {
		this.DragButton = 1
		
		this.canvas = null
		
		this.action = {
			Start: false, End: false,
			x: 0, y: 0,
			ctrlKey: false,
		}
		
		this._listeners = {
			pointerdown: ev=>this.Begin(ev),
			pointermove: ev=>this.Continue(ev, false),
			pointerup: ev=>this.Continue(ev, true),
			contextmenu: ev=>ev.preventDefault(),
		}
	}
	
	get_pos(ev) {
		let rect = this.canvas.getBoundingClientRect()
		let sx = rect.width / this.canvas.width
		let sy = rect.height / this.canvas.height
		return [
			(ev.offsetX + 0.5/(sx*window.devicePixelRatio)) / sx,
			(ev.offsetY + 0.5/(sy*window.devicePixelRatio)) / sy,
		]
	}
	
	//Convert the "buttons" field of a mouse event to the appropriate action
	ButtonsToAction(buttons) {
		if (buttons & this.DragButton)
			return CanvasPerformer.DRAG
	}
	
	do_listeners(state) {
		for (let [type, func] of Object.entries(this._listeners))
			this.canvas[state?'addEventListener':'removeEventListener'](type, func)
	}
	
	Attach(canvas) {
		if (this.canvas)
			throw "This CanvasPerformer is already attached to an canvas!"
		this.canvas = canvas
		this.canvas.style.touchAction = 'none'
		this.do_listeners(true)
	}
	
	Detach() {
		if (!this.canvas)
			throw "This CanvasPerformer is is not attached to an canvas!"
		
		this.do_listeners(false)
		
		this.canvas = null
	}
	
	Begin(ev) {
		this.canvas.setPointerCapture(ev.pointerId)
		
		let data = this.action
		let [x, y] = this.get_pos(ev)
		data.x = data.startX = data.oldX = x
		data.y = data.startY = data.oldY = y
		
		data.Start = true
		data.End = false
		data.Alive = true
		
		data.ctrlKey = ev.ctrlKey
		
		ev.preventDefault()
		
		this.OnAction()
	}
	
	Continue(ev, end) {
		let data = this.action
		if (!data.Alive)
			return
		
		data.oldX = data.x
		data.oldY = data.y
		0,[data.x, data.y] = this.get_pos(ev)
		
		data.Start = false
		data.End = end
		
		data.ctrlKey = ev.ctrlKey
		
		ev.preventDefault()
		
		this.OnAction()
		
		if (end) {
			data.Alive = false
			this.EndStroke(false)
		}
	}
}
CanvasPerformer.prototype.OnAction = null

CanvasPerformer.DRAG = 1
