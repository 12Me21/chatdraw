'use strict'

// Carlos Sanchez - 2017
// randomouscrap98@aol.com
// An enormous library full of canvas garbage
// NOTE: THIS LIBRARY REQUIRES randomous.js!

console.trace = ()=>{}


// --- CanvasPerformer ---
// Allows simple actions using unified touch and mouse on a canvas. Useful for drawing applications

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
		let {clientX, clientY} = touches[0]
		if (action & CanvasPerformer.ZOOM)
			return Math2.Midpoint(clientX, clientY, touches[1].clientX, touches[1].clientY)
		return [clientX, clientY]
	}

	//Figure out the distance of a pinch based on the given touches.
	PinchDistance(touches) {
		return Math.hypot(touches[1].clientX-touches[0].clientX, touches[1].clientY-touches[0].clientY)
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
		let sx = rect.width / this.canvas.width
		let sy = rect.height / this.canvas.height
		if (sx <= 0 || sy <= 0)
			return
		
		let data = {
			Start: start,
			End: end,
			Interrupt: interrupt,
			
			Drag: (action & 1)==1,
			Zoom: (action & 2)==2,
			Pan: (action & 4)==4,
			
			x: (x - rect.x) / sx,
			y: (y - rect.y) / sy,
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


class CanvasDrawerTool {
}
// why isn't there a syntax for this?
CanvasDrawerTool.prototype.tool = null
CanvasDrawerTool.prototype.cursor = null
CanvasDrawerTool.prototype.overlay = null
CanvasDrawerTool.prototype.interrupt = null
CanvasDrawerTool.prototype.stationaryReportInterval = null
CanvasDrawerTool.prototype.frameLock = false
CanvasDrawerTool.prototype.updateUndoBuffer = true

class CanvasDrawerOverlayTool extends CanvasDrawerTool {
	tool(data, context) {
		if (data.End)
			return this._draw(data, context)
	}
	overlay(data, context) {
		if (!data.End)
			return this._draw(data, context)
		return false
	}
}
CanvasDrawerOverlayTool.prototype._draw = null

class CanvasDrawer extends CanvasPerformer {
	constructor() {
		super()
		
		this.undoBuffer = null
		this.tools = {}
		for (let tool of ['freehand','slow','spray','line','square','clear','fill','mover','disc']) {
			this.tools[tool] = new CanvasDrawer.tools[tool]()
		}
		
		this.overlay = null
		this.overlayActive = false
		
		this.onlyInnerStrokes = true
		
		this.currentTool = null
		this.color = null
		this.lineWidth = null
		
		this.frameActions = []
		this.lastAction = null
		this.ignoreCurrentStroke = false
		this.frameCount = 0
		
		this.strokeCount = 0
	}
	
	OnAction(data) {
		let tool = this.tools[this.currentTool]
		if (!tool)
			return
		if (!data.Drag)
			return
		
		//Replace this with some generic cursor drawing thing that takes both strings AND functions to draw the cursor.
		if (!tool.cursor && data.Start) 
			;//this.canvas.style.cursor = this.defaultCursor
		
		if (data.Start) {
			data.oldX = data.x
			data.oldY = data.y
			data.startX = data.x
			data.startY = data.y
			this.strokeCount++
		} else {
			data.oldX = this.lastAction.x
			data.oldY = this.lastAction.y
			data.startX = this.lastAction.startX
			data.startY = this.lastAction.startY
		}
		
		if (tool.framelock)
			this.frameActions.push(data)
		else
			this.PerformDrawAction(data)
	}
	
	do_frame() {
		this.frameCount++
		//Only reperform the last action if there was no action this frame, both the tool and the reportInterval are valid, there even WAS a lastAction which had Drag but not Start/End, and it's far enough away from the last stationary report.
		let fa = this.frameActions
		if (!fa.length) {
			let tool = this.tools[this.currentTool]
			if (tool.stationaryReportInterval && tool.tool) {
				let data = this.lastAction
				if (data && data.Drag && !data.End)
					if (this.frameCount % tool.stationaryReportInterval == 0)
						fa.push(data)
			}
		}
		//I don't care what the tool wants or what the settings are, all I care about is whether or not there are actions for me to perform. Maybe some other thing added actions; I shouldn't ignore those.
		while (fa.length) {
			let data = fa.shift()
			if (data.Start || data.End || fa.length==0)
				this.PerformDrawAction(data)
		}
	}
	
	SwapColor(original, newColor) {
		this.grp.fill_color = newColor
		this.grp.replace_color(original)
	}
	
	CanUndo() {
		return this.undoBuffer && this.undoBuffer.UndoCount() > 0
	}
	
	CanRedo() {
		return this.undoBuffer && this.undoBuffer.RedoCount() > 0
	}
	
	get_state_data() {
		let data = this.grp.get_data()
		let extra = null
		if (this.get_extra)
			extra = this.get_extra()
		return {data, extra}
	}
	
	//This is for both undos and redos
	_PerformUndoRedoSwap(which) {
		let current = this.get_state_data()
		let next = this.undoBuffer[which](current)
		if (next) {
			this.grp.putImageData(next.data, 0, 0)
			if (this.set_extra)
				this.set_extra(next.extra)
		}
	}
	
	Undo() {
		if (!this.CanUndo())
			return
		this._PerformUndoRedoSwap('Undo')
	}
	
	Redo() {
		if (!this.CanRedo())
			return
		this._PerformUndoRedoSwap('Redo')
	}
	
	ClearUndoBuffer() {
		this.undoBuffer.Clear()
	}
	
	UpdateUndoBuffer() {
		if (this.undoBuffer) {
			console.trace("Updating undo buffer")
			this.undoBuffer.Add(this.get_state_data())
		}
	}
	
	PerformDrawAction(data) {
		//Ensure the drawing canvases are properly set up before we hand the data off to a tool action thingy.
		this.grp.fill_color = this.color
		this.grp.lineWidth = this.lineWidth
		let tool = this.tools[this.currentTool]
		
		if (data.Interrupt) {
			//Interrupted? Clear the overlay... don't know what we were doing but whatever, man. Oh and call the tool's interrupt function...
			this.overlayActive = false
			if (tool.interrupt)
				tool.interrupt(data, this.grp, this)
			//CanvasUtilities.Clear(this.overlay)
		}
		
		// TODO: ignoreCurrentStroke should be handled by the CanvasPerformer class yes?
		if (data.Start) {
			if (data.Interrupt || (this.onlyInnerStrokes && !data.onTarget)) {
				this.ignoreCurrentStroke = true
				//console.debug("ignoring stroke. Interrupt: " + data.Interrupt)
			} else {
				if (tool.updateUndoBuffer)
					this.UpdateUndoBuffer()
			}
		}
		
		//A special case: The last stroke that was valid was interrupted, so we need to undo the stroke (only if the stroke wasn't ignored in the first place)
		if (!this.ignoreCurrentStroke && (data.End && data.Interrupt) && tool.updateUndoBuffer) {
			this.ignoreCurrentStroke = true
			this.Undo()
			this.undoBuffer.ClearRedos()
		}
		
		//Now actually perform the action.
		if (!this.ignoreCurrentStroke) {
			tool.tool(data, this.grp, this)
			
			if (tool.overlay && this.overlay) {
				let oc = this.overlay
				oc.fill_color = this.color
				oc.lineWidth = this.lineWidth
				oc.clearRect(0, 0, oc.width, oc.height)
				this.overlayActive = tool.overlay(data, oc, this)!==false
			}
		}
		
		if (data.End) {
			if (this.ignoreCurrentStroke)
				;//console.debug("No longer ignoring stroke")
			this.ignoreCurrentStroke = false
		}
		
		this.lastAction = data
	}
	
	ResetUndoBuffer(size) {
		this.undoBuffer = new UndoBuffer(size)
	}
	
	Attach(context, useToolOverlay=true) {
		if (useToolOverlay)
			this.overlay = context.create_copy()
		this.grp = context
		super.Attach(context.canvas)
		
		let do_frame = ()=>{
			if (!this.grp)
				return
			this.do_frame()
			requestAnimationFrame(do_frame)
		}
		do_frame()
	}
	
	Detach() {
		this.overlay = null
		this.grp = null
		super.Detach()
	}
}

CanvasDrawer.tools = {
	freehand: class extends CanvasDrawerTool {
		tool({Start, x, y, oldX, oldY}, context) {
			context.draw_round_line(oldX, oldY, x, y)
		}
	},
	slow: class extends CanvasDrawerTool {
		constructor() {
			super()
			this.speed = 0.15
			this.avg = {x:0,y:0}
		}
		tool({Start, End, Drag, x, y}, context) {
			if (Start) {
				this.avg = {x,y}
			} else {
				x = x*this.speed + this.avg.x*(1-this.speed)
				y = y*this.speed + this.avg.y*(1-this.speed)
			}
			if (Drag || End)
				context.draw_round_line(this.avg.x, this.avg.y, x, y)
			this.avg = {x,y}
		}
	},
	spray: class extends CanvasDrawerTool {
		constructor() {
			super()
			this.spread = 2
			this.rate = 2/3
		}
		tool({Drag, x, y}, context) {
			if (!Drag)
				return
			let lw = context.lineWidth
			let radius = lw * this.spread
			let count = lw * this.rate
			for (let i=0; i<count*10; i++) {
				if (Math.random()<0.1) {
					let [ox, oy] = Math2.random_in_circle(radius)
					context.fillRect(Math.floor(x+ox), Math.floor(y+oy), 1, 1)
				}
			}
		}
	},
	
	fill: class extends CanvasDrawerTool {
		tool({Start, x, y}, context) {
			if (Start) {
				// even though linewidth doesn't matter, this is to align with the cursor maybe..
				let [sx, sy] = Math2.correct_pos(x, y, 1/*context.lineWidth*/)
				console.debug("Flood filling starting from " + sx + ", " + sy)
				context.flood_fill(sx, sy)
			}
		}
	},
	clear: class extends CanvasDrawerTool {
		tool({End, onTarget}, context) {
			if (End && onTarget)
				context.clear()
		}
	},
	mover: class extends CanvasDrawerTool {
		constructor() {
			super()
			this.data = null
		}
		tool({Start, Drag, End, x, y, startX, startY}, context) {
			if (Start) {
				this.data = context.get_data()
				return false
			}
			if (Drag || End) {
				let dx = x - startX
				let dy = y - startY
				let w = context.width
				let h = context.height
				while (dx < 0) dx += w
				while (dx >= w) dx -= w
				while (dy < 0) dy += h
				while (dy >= h) dy -= h
				context.putImageData(this.data, dx, dy)
				context.putImageData(this.data, dx-w, dy)
				context.putImageData(this.data, dx, dy-h)
				context.putImageData(this.data, dx-w, dy-h)
				if (End) // todo: actually make sure we always get rid of this layer all the time (actually why dont we just use the overlay layer?)
					this.data = null
				return true
			}
		}
	},
	
	line: class extends CanvasDrawerOverlayTool {
		_draw({startX, startY, x, y}, context) {
			context.draw_round_line(startX, startY, x, y)
		}
	},
	square: class extends CanvasDrawerOverlayTool {
		_draw({startX, startY, x, y}, context) {
			context.draw_box(startX, startY, x, y)
		}
	},
	disc: class extends CanvasDrawerOverlayTool {
		_draw({startX, startY, x, y}, context) {
			let rad = Math2.distance(x,y,startX,startY)/2
			0,[x,y] = Math2.Midpoint(x,y,startX,startY)
			context.draw_circle(x, y, rad, rad)
		}
	},
}
CanvasDrawer.tools.slow.prototype.stationaryReportInterval = 1
CanvasDrawer.tools.slow.prototype.frameLock = true
CanvasDrawer.tools.spray.prototype.stationaryReportInterval = 1
CanvasDrawer.tools.spray.prototype.frameLock = true
