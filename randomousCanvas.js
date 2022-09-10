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
		
		this.element = null
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
			return MathUtilities.Midpoint(clientX, clientY, touches[1].clientX, touches[1].clientY)
		return [clientX, clientY]
	}

	//Figure out the distance of a pinch based on the given touches.
	PinchDistance(touches) {
		return MathUtilities.Distance(touches[0].clientX, touches[0].clientY, touches[1].clientX, touches[1].clientY)
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
			let target = is_doc ? document : this.element
			target[state?'addEventListener':'removeEventListener'](type, func)
		}
	}
	
	Attach(element) {
		if (this.element)
			throw "This CanvasPerformer is already attached to an element!"
		
		this.element = element
		element.style.touchAction = 'none'
		
		this.do_listeners(true)
	}
	
	Detach() {
		if (!this.element)
			throw "This CanvasPerformer is is not attached to an element!"
		
		this.do_listeners(false)
		
		this.element = null
	}
	
	Perform(ev, start, end, interrupt, action, zoomDelta) {
		let [x, y] = this.event_pos(ev)
		
		let rect = this.element.getBoundingClientRect()
		let sx = rect.width / this.element.width
		let sy = rect.height / this.element.height
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
			
			onTarget: ev.composedPath()[0]===this.element,
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
		
		this.currentTool = 'freehand'
		this.color = "#000000"
		this.lineWidth = 2
		this.lineShape = 'hardcircle'
		
		this.frameActions = []
		this.lastAction = null
		this.ignoreCurrentStroke = false
		this.frameCount = 0
		
		//All private stuff that's only used for our internal functions.
		this.strokeCount = 0
	}
	
	OnAction(data) {
		let tool = this.tools[this.currentTool]
		if (!tool)
			return
		if (!data.Drag)
			return
		data.lineShape = this.lineShape
		
		if (this.lineShape === 'hardcircle')
			data.lineFunction = CanvasUtilities.DrawLine2
		
		//Replace this with some generic cursor drawing thing that takes both strings AND functions to draw the cursor.
		if (!tool.cursor && data.Start) 
			;//this.element.style.cursor = this.defaultCursor
		
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
		CanvasUtilities.SwapColor(this.context, original, newColor)
	}
	
	CanUndo() {
		return this.undoBuffer && this.undoBuffer.UndoCount() > 0
	}
	
	CanRedo() {
		return this.undoBuffer && this.undoBuffer.RedoCount() > 0
	}
	
	get_state_data() {
		let data = CanvasUtilities.GetAllData(this.context)
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
			this.context.putImageData(next.data, 0, 0)
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
		this.context.fillStyle = this.color
		this.context.lineWidth = this.lineWidth
		let tool = this.tools[this.currentTool]
		
		if (data.Interrupt) {
			//Interrupted? Clear the overlay... don't know what we were doing but whatever, man. Oh and call the tool's interrupt function...
			this.overlayActive = false
			if (tool.interrupt)
				tool.interrupt(data, this.context, this)
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
			let bounding = tool.tool(data, this.context, this)
			
			if (tool.overlay && this.overlay) {
				let oc = this.overlay
				oc.fillStyle = this.color
				oc.lineWidth = this.lineWidth
				oc.clearRect(0, 0, oc.canvas.width, oc.canvas.height)
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
			this.overlay = CanvasUtilities.CreateCopy(context.canvas)
		this.context = context
		super.Attach(context.canvas)
		
		let do_frame = ()=>{
			if (!this.context)
				return
			this.do_frame()
			requestAnimationFrame(do_frame)
		}
		do_frame()
	}
	
	Detach() {
		this.overlay = null
		this.context = null
		super.Detach()
	}
}

CanvasDrawer.tools = {
	freehand: class extends CanvasDrawerTool {
		tool({x, y, oldX, oldY, lineFunction}, context) {
			lineFunction(context, oldX, oldY, x, y)
		}
	},
	slow: class extends CanvasDrawerTool {
		constructor() {
			super()
			this.smoothing = 0.15
			this.avgX = this.avgY = null
		}
		tool(data, context) {
			if (data.Start) {
				this.avgX = data.x
				this.avgY = data.y
			}
			let oldX = this.avgX
			let oldY = this.avgY
			if (data.Drag && !data.End) {
				this.avgX = this.avgX*(1-this.smoothing)+data.x*this.smoothing
				this.avgY = this.avgY*(1-this.smoothing)+data.y*this.smoothing
			}
			if (data.End) {
				oldX = data.x
				oldY = data.y
			}
			if (data.Drag || data.End) {
				data.lineFunction(context, oldX, oldY, this.avgX, this.avgY)
			}
		}
	},
	spray: class extends CanvasDrawerTool {
		constructor() {
			super()
			this.spread = 2
			this.rate = 1 / 1.5
		}
		tool(data, context) {
			if (data.Drag) {
				let w = context.lineWidth
				let radius = w*this.spread
				let count = w*this.rate
				for (let i=0; i<count*10; i++) {
					if (Math.random()<0.1) {
						let x, y
						do {
							x = (Math.random()*2-1)*radius
							y = (Math.random()*2-1)*radius
						} while (x*x+y*y>radius*radius)
						CanvasUtilities.DrawSolidCenteredRectangle(context, data.x+x, data.y+y, 1, 1)
					}
				}
			}
		}
	},
	
	fill: class extends CanvasDrawerTool {
		tool(data, context) {
			if (data.Start) {
				let [sx, sy] = CanvasUtilities.correct_pos(data.x, data.y, 1)
				console.debug("Flood filling starting from " + sx + ", " + sy)
				
				let originalColor = CanvasUtilities.GetColor(context, sx, sy)
				let color = Color.from_hex(context.fillStyle)
				
				if (originalColor.color == color.color)
					return
				console.log(originalColor, color)
				CanvasUtilities.GenericFlood(context, sx, sy, (i32, w, h, x, y)=>{
					let i = y*w + x
					if (i32[i] == originalColor.color) {
						i32[i] = color.color
						return true
					}
					return false
				})
			}
		}
	},
	clear: class extends CanvasDrawerTool {
		tool(data, context) {
			if (data.End && data.onTarget)
				CanvasUtilities.Clear(context, context.fillStyle)
		}
	},
	mover: class extends CanvasDrawerTool {
		constructor() {
			super()
			this.data = null
		}
		tool(data, context) {
			if (data.Start) {
				this.data = CanvasUtilities.GetAllData(context)
				return false
			}
			if (data.Drag || data.End) {
				let x = data.x - data.startX
				let y = data.y - data.startY
				let w = context.canvas.width
				let h = context.canvas.height
				while (x < 0) x += w
				while (x >= w) x -= w
				while (y < 0) y += h
				while (y >= h) y -= h
				CanvasUtilities.Clear(context, "#000000")
				context.putImageData(this.data, x, y)
				context.putImageData(this.data, x-w, y)
				context.putImageData(this.data, x, y-h)
				context.putImageData(this.data, x-w, y-h)
				if (data.End) // todo: actually make sure we always get rid of this layer all the time
					this.data = null
				return true
			}
		}
	},
	
	line: class extends CanvasDrawerOverlayTool {
		_draw(data, context) {
			data.lineFunction(context, data.startX, data.startY, data.x, data.y)
		}
	},
	square: class extends CanvasDrawerOverlayTool {
		_draw(data, context) {
			CanvasUtilities.DrawHollowRectangle(context, data.startX, data.startY, data.x, data.y)
		}
	},
	disc: class extends CanvasDrawerOverlayTool {
		_draw(data, context) {
			let rad = MathUtilities.Distance(data.x, data.y, data.startX, data.startY)/2
			let [x,y] = MathUtilities.Midpoint(data.x, data.y, data.startX, data.startY)
			CanvasUtilities.DrawSolidEllipse(context, x, y, rad, rad)
		}
	},
}
CanvasDrawer.tools.slow.prototype.stationaryReportInterval = 1
CanvasDrawer.tools.slow.prototype.frameLock = true
CanvasDrawer.tools.spray.prototype.stationaryReportInterval = 1
CanvasDrawer.tools.spray.prototype.frameLock = true
