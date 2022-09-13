'use strict'

class CanvasPerformer {
	constructor() {
		this.DragButton = 1
		this.PanButton = 2
		this.DragTouches = 1
		this.ZoomTouches = 2
		this.PanTouches = 2
		this.WheelZoom = 0.5
		
		this.canvas = null
		this._oldStyle = ""
		
		let last_mouse_action = null
		let lta = null
		let startZDistance = 0
		let lastZDistance = 0
		this.last_touch = [-1, -1]
		
		let evtc = ev=>{
			if (this.ZoomTouches !== 2)
				throw "Zoom must use 2 fingers!"
			
			let nextAction = this.TouchesToAction(ev.touches.length)
			
			let interrupt = lta && nextAction
			
			//If we enter evTC and there is a last_touch_action, that means that last action has ended. Either we went from 1 touch to 0 or maybe 2 touches to 1 touch. Either way, that specific action has ended (2 touches is a zoom, 1 touch is a drag, etc.).
			if (lta) {
				this.Perform(ev, 0, 1, interrupt, lta)
			}
			
			//if the user is ACTUALLY performing something (and this isn't just a 0 touch event), THEN we're starting something here.
			lta = nextAction
			if (lta) {
				if (lta & CanvasPerformer.ZOOM) {
					startZDistance = this.PinchDistance(ev.touches)
					lastZDistance = 0
				}
				this.last_touch = this.TouchesToXY(lta, ev.touches)
				this.Perform(ev, 1, 0, interrupt, lta)
			}
		}
		
		let evpd = ev=>{ev.preventDefault()}
		
		this._listeners = [
			['mousedown', true, ev=>{
				last_mouse_action = this.ButtonsToAction([1,4,2,8,16][ev.button])
				this.Perform(ev, 1, 0, 0, last_mouse_action)
			}],
			['mousemove', true, ev=>{
				this.Perform(ev, 0, 0, 0, this.ButtonsToAction(ev.buttons))
			}],
			['mouseup', true, ev=>{
				this.Perform(ev, 0, 1, 0, last_mouse_action)
				last_mouse_action = null
			}],
			['contextmenu', false, evpd],
			
			['wheel', false, ev=>{
				let z = -Math.sign(ev.deltaY) * this.WheelZoom
				this.Perform(ev, 1, 1, 0, CanvasPerformer.ZOOM, z)
			}],
			
			['touchstart', true, evtc],
			['touchstart', false, evpd],
			['touchmove', true, ev=>{
				let action = this.TouchesToAction(ev.touches.length)
				this.last_touch = this.TouchesToXY(action, ev.touches)
				
				let dz = undefined
				if (action & CanvasPerformer.ZOOM) {
					dz = this.PinchZoom(this.PinchDistance(ev.touches), startZDistance) - lastZDistance
					lastZDistance += dz
				}
				this.Perform(ev, 0, 0, 0, action, dz)
			}],
			['touchend', true, evtc],
			['touchcancel', true, evtc],
		]
	}
	
	event_pos(ev) {
		if (ev.type.startsWith("touch"))
			return this.last_touch
		return [ev.clientX, ev.clientY]
	}
	
	//Convert the "buttons" field of a mouse event to the appropriate action
	ButtonsToAction(buttons) {
		if (buttons & this.DragButton)
			return CanvasPerformer.DRAG
		else if (buttons & this.PanButton)
			return CanvasPerformer.PAN
	}
	
	//Convert the touch count to an appropriate action
	TouchesToAction(touch_count) {
		let action = 0
		if (touch_count == this.DragTouches)
			action |= CanvasPerformer.DRAG
		if (touch_count == this.ZoomTouches)
			action |= CanvasPerformer.ZOOM
		if (touch_count == this.PanTouches)
			action |= CanvasPerformer.PAN
		return action
	}
	
	//Convert a touch array into a certain XY position based on the given action.
	TouchesToXY(action, touches) {
		let {clientX:x, clientY:y} = touches[0]
		if (action & CanvasPerformer.ZOOM)
			return Math2.Midpoint(x, y, touches[1].clientX, touches[1].clientY)
		return [x, y]
	}

	//Figure out the distance of a pinch based on the given touches.
	PinchDistance([t0, t1]) {
		return Math2.distance(t0.clientX, t0.clientY, t1.clientX, t1.clientY)
	}
	
	//Figure out the zoom difference (from the original) for a pinch. This is NOT the delta zoom between actions, just the delta zoom since the start of the pinch (or whatever is passed for oDistance)
	PinchZoom(distance, oDistance) {
		return Math.log2(distance / oDistance)
	}
	
	//System uses this function to determine if touches should be captured. Users can override this function to give their own rules for captured touches. Capturing a touch prevents scrolling.
	ShouldCapture(data) {
		return data.onTarget
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
	
	Perform(ev, start, end, interrupt, action, zoomDelta) {
		let [x, y] = this.event_pos(ev)
		
		let rect = this.canvas.getBoundingClientRect()
		if (rect.width <= 0 || rect.height <= 0)
			return
		
		let sx = rect.width / this.canvas.width
		let sy = rect.height / this.canvas.height
		
		let data = {
			Start: start,
			End: end,
			Interrupt: interrupt,
			
			Drag: (action & 1)==1,
			Zoom: (action & 2)==2,
			Pan: (action & 4)==4,
			
			// adjust the position of the cursor within the pixel to account for the fact that the cursor is 1×1px, not a point.
			// so if scale is 3 and dpr is 2, and the cursor is "at" (0,0) then,
			// the cursor's tip pixel will span from (0,0) to (1/(3*2),1/(3*2)) (in canvas pixels)
			// ...well actually we don't know whether a cursor pixel will scale with DPR.
			// it's possible that the cursor's tip is 2x2 pixels in that case,
			x: (x - rect.x + 0.5/(sx*devicePixelRatio)) / sx,
			y: (y - rect.y + 0.5/(sy*devicePixelRatio)) / sy,
			zoomDelta,
			
			onTarget: ev.composedPath()[0]===this.canvas,
			ctrlKey: ev.ctrlKey,
		}
		
		if (ev && this.ShouldCapture(data))
			ev.preventDefault()
		
		if (this.OnAction)
			this.OnAction(data)
	}
}
CanvasPerformer.prototype.OnAction = null

CanvasPerformer.DRAG = 1
CanvasPerformer.ZOOM = 2
CanvasPerformer.PAN = 4
