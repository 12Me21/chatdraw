'use strict'

class CanvasPerformer {
	constructor() {
		this.DragButton = 1
		
		this.canvas = null
		this._oldStyle = ""
		
		this.action = {
			Start: false, End: false, Drag: false,
			x: 0, y: 0, onTarget: false,
			ctrlKey: false,
		}
		
		// todo: maybe allow tracking multiple concurrent action paths (like, mouse and touch used at the same time) and store their action data separately. per path not per  device i guess,
		let last_mouse_action = null
		let lta = null
		this.last_touch = [-1, -1]
		
		let evtc = ev=>{
			let nextAction = this.TouchesToAction(ev.touches.length)
			
			let interrupt = lta && nextAction
			
			//If we enter evTC and there is a last_touch_action, that means that last action has ended. Either we went from 1 touch to 0 or maybe 2 touches to 1 touch. Either way, that specific action has ended (2 touches is a zoom, 1 touch is a drag, etc.).
			if (lta)
				this.Continue(ev, true, interrupt, lta)
			
			//if the user is ACTUALLY performing something (and this isn't just a 0 touch event), THEN we're starting something here.
			lta = nextAction
			if (lta) {
				this.last_touch = ev.touches[0]
				this.Begin(ev, interrupt, lta)
			}
		}
		
		let evpd = ev=>{ev.preventDefault()}
		
		this._listeners = [
			['mousedown', true, ev=>{
				last_mouse_action = this.ButtonsToAction([1,4,2,8,16][ev.button])
				this.Begin(ev, false, last_mouse_action)
			}],
			['mousemove', true, ev=>{
				this.Continue(ev, false, false, last_mouse_action)
			}],
			['mouseup', true, ev=>{
				this.Continue(ev, true, false, last_mouse_action)
				last_mouse_action = null
			}],
			['contextmenu', false, evpd],
			
			/*['wheel', false, ev=>{
				let z = -Math.sign(ev.deltaY) * this.WheelZoom
				this.Perform(ev, 1, 1, 0, CanvasPerformer.ZOOM, z)
			}],*/
			
			['touchstart', true, evtc],
			['touchstart', false, evpd],
			['touchmove', true, ev=>{
				let action = this.TouchesToAction(ev.touches.length)
				if (action) {
					this.last_touch = ev.touches[0]
					this.Continue(ev, false, false, action)
				}
			}],
			['touchend', true, evtc],
			['touchcancel', true, evtc],
		]
	}
	
	get_pos(ev) {
		let s = ev.type.startsWith("touch") ? this.last_touch : ev
		let [x, y] = [s.clientX, s.clientY]
		
		let rect = this.canvas.getBoundingClientRect()
		if (rect.width <= 0 || rect.height <= 0)
			return null
		
		let sx = rect.width / this.canvas.width
		let sy = rect.height / this.canvas.height
		
		x = (x - rect.x + 0.5/(sx*window.devicePixelRatio)) / sx
		y = (y - rect.y + 0.5/(sy*window.devicePixelRatio)) / sy
		
		return [x, y]
	}
	
	//Convert the "buttons" field of a mouse event to the appropriate action
	ButtonsToAction(buttons) {
		if (buttons & this.DragButton)
			return CanvasPerformer.DRAG
	}
	
	//Convert the touch count to an appropriate action
	TouchesToAction(touch_count) {
		if (touch_count == 1)
			return CanvasPerformer.DRAG
		return 0
	}
	
	do_listeners(state) {
		for (let [type, is_doc, func] of this._listeners) {
			let target = is_doc ? document : this.canvas
			target[state?'addEventListener':'removeEventListener'](type, func)
		}
	}
	
	Attach(canvas) {
		if (this.canvas)
			throw "This CanvasPerformer is already attached to an canvas!"
		
		this.canvas = canvas
		canvas.style.touchAction = 'none'
		
		this.do_listeners(true)
	}
	
	Detach() {
		if (!this.canvas)
			throw "This CanvasPerformer is is not attached to an canvas!"
		
		this.do_listeners(false)
		
		this.canvas = null
	}
	
	Begin(ev, interrupt, action) {
		let data = this.action
		let on_target = ev.composedPath()[0]===this.canvas
		if (interrupt || !on_target) {
			data.Alive = false
			return
		}
		let [x, y] = this.get_pos(ev)
		data.x = data.startX = data.oldX = x
		data.y = data.startY = data.oldY = y
		
		data.Start = true
		data.End = false
		data.Alive = true
		data.Drag = action
		
		data.onTarget = on_target
		data.ctrlKey = ev.ctrlKey
		
		if (ev && data.onTarget)
			ev.preventDefault()
		
		this.OnAction()
	}
	
	Continue(ev, end, interrupt, action) {
		let data = this.action
		if (!data.Alive)
			return
		if (interrupt) {
			data.Alive = false
			this.EndStroke(true)
			return
		}
		let on_target = ev.composedPath()[0]===this.canvas
		
		data.oldX = data.x
		data.oldY = data.y
		0,[data.x, data.y] = this.get_pos(ev)
		
		data.Start = false
		data.End = end
		data.Drag = action
		
		data.onTarget = on_target
		data.ctrlKey = ev.ctrlKey
		
		if (ev && data.onTarget)
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
