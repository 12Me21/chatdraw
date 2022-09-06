'use strict'

// Carlos Sanchez - 2017
// randomouscrap98@aol.com
// An enormous library full of canvas garbage
// NOTE: THIS LIBRARY REQUIRES randomous.js!

// --- CursorActionData ---
// Auxiliary object for describing generic cursor actions and data. Useful for unified mouse/touch systems (like CanvasPerformer)

console.trace = ()=>{}

class CursorActionData {
	constructor(action, [x, y], target, zoomDelta=null) {
		this.action = action
		this.x = x
		this.y = y
		this.realX = x //The real x and y relative to the canvas.
		this.realY = y
		this.zoomDelta = zoomDelta
		this.onTarget = true
		this.targetElement = target
		this.time = Date.now()
		this.modifiers = 0
		this.existent = true
		
		if (target) {
			let rect = target.getBoundingClientRect()
			let sx = rect.width / target.width
			let sy = rect.height / target.height
			
			if (sx <= 0 || sy <= 0)
				this.existent = false
			else {
				this.x = (this.x - rect.x) / sx
				this.y = (this.y - rect.y) / sy
			}
		}
	}
	get_action(bit) { return (this.action & bit)==bit }
	get Start() { return this.get_action(1) }
	get End() { return this.get_action(2) }
	get Drag() { return this.get_action(4) }
	get Zoom() { return this.get_action(8) }
	get Pan() { return this.get_action(16) }
	get Interrupt() { return this.get_action(32) }
	get EndInterrupt() { return this.get_action(2|32) }
}

const CursorModifiers = {
	Ctrl: 1, Alt: 2,
}

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
		this.OnAction = false
		
		this._canvas = false
		this._oldStyle = {}
		
		let last_mouse_action = 0
		let last_touch_action = 0
		let startZDistance = 0
		let lastZDistance = 0
		let last_touch = [-1, -1]
		
		let evtc = ev=>{
			if (this.ZoomTouches !== 2)
				throw "Zoom must use 2 fingers!"
			
			let extraAction = 0
			let nextAction = this.TouchesToAction(ev.touches.length)
			
			//If we enter evTC and there is a last_touch_action, that means that last action has ended. Either we went from 1 touch to 0 or maybe 2 touches to 1 touch. Either way, that specific action has ended (2 touches is a zoom, 1 touch is a drag, etc.).
			if (last_touch_action) {
				if (nextAction)
					extraAction |= CanvasPerformer.INTERRUPT
				let action = CanvasPerformer.END | last_touch_action | extraAction
				this.Perform(ev, action, last_touch)
			}
			
			//Move to the "next" action.
			last_touch_action = nextAction
			
			//if the user is ACTUALLY performing something (and this isn't just a 0 touch event), THEN we're starting something here.
			if (last_touch_action) {
				if (last_touch_action & CanvasPerformer.ZOOM) {
					startZDistance = this.PinchDistance(ev.touches)
					lastZDistance = 0
				}
				last_touch = this.TouchesToXY(last_touch_action, ev.touches)
				let action = CanvasPerformer.START | last_touch_action | extraAction
				this.Perform(ev, action, last_touch)
			}
		}
		
		let evpd = ev=>{ev.preventDefault()}
		
		this._listeners = [
			['mousedown', false, ev=>{
				last_mouse_action = this.ButtonsToAction([1,4,2,8,16][ev.button])
				let action = CanvasPerformer.START | last_mouse_action
				this.Perform(ev, action, this.MouseToXY(ev))
			}],
			['touchstart', false, evtc],
			['touchstart', false, evpd],
			['wheel', false, ev=>{
				let action = CanvasPerformer.START | CanvasPerformer.END | CanvasPerformer.ZOOM
				this.Perform(ev, action, this.MouseToXY(ev), -Math.sign(ev.deltaY) * this.WheelZoom)
			}],
			['contextmenu', false, evpd],
			['mouseup', true, ev=>{
				let action = CanvasPerformer.END | last_mouse_action
				this.Perform(ev, action, this.MouseToXY(ev))
				last_mouse_action = 0
			}],
			['touchend', true, evtc],
			['touchcancel', true, evtc],
			['mousemove', true, ev=>{
				let action = this.ButtonsToAction(ev.buttons)
				this.Perform(ev, action, this.MouseToXY(ev))
			}],
			['touchmove', true, ev=>{
				let action = this.TouchesToAction(e.touches.length)
				last_touch = this.TouchesToXY(action, e.touches)
				
				if (action & CanvasPerformer.ZOOM) {
					let z = this.PinchZoom(this.PinchDistance(e.touches), startZDistance)
					this.Perform(e, action, last_touch, z - lastZDistance)
					lastZDistance = z
				} else {
					this.Perform(e, action, last_touch)
				}
			}],
		]
	}
	
	MouseToXY(ev) {
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
	TouchesToAction(touches) {
		let action = 0
		
		if (touches == this.DragTouches)
			action |= CanvasPerformer.DRAG
		if (touches == this.ZoomTouches)
			action |= CanvasPerformer.ZOOM
		if (touches == this.PanTouches)
			action |= CanvasPerformer.PAN
		
		return action
	}
	
	//Convert a touch array into a certain XY position based on the given action.
	TouchesToXY(action, touchArray) {
		if (action & CanvasPerformer.ZOOM) {
			return MathUtilities.Midpoint(touchArray[0].clientX, touchArray[0].clientY, touchArray[1].clientX, touchArray[1].clientY)
		}
		
		return [touchArray[0].clientX, touchArray[0].clientY]
	}

	//Figure out the distance of a pinch based on the given touches.
	PinchDistance(touchArray) {
		return MathUtilities.Distance(touchArray[0].clientX, touchArray[0].clientY, touchArray[1].clientX, touchArray[1].clientY)
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
			let target = is_doc ? document : this._canvas
			target[state?'addEventListener':'removeEventListener'](type, func)
		}
	}
	
	Attach(canvas) {
		if (this._canvas)
			throw "This CanvasPerformer is already attached to a canvas!"
		
		this._canvas = canvas
		this._oldStyle = canvas.style.touchAction
		canvas.style.touchAction = "none"
		
		this.do_listeners(true)
	}
	
	Detach() {
		if (!this._canvas)
			throw "This CanvasPerformer is is not attached to a canvas!"
		
		this.do_listeners(false)
		
		this._canvas.style.touchAction = this._oldStyle
		this._canvas = null
	}
	
	Perform(e, action, pos, zoomDelta) {
		let canvas = this._canvas
		let cursorData = new CursorActionData(action, pos, canvas, zoomDelta)
		
		if (!cursorData.existent)
			return
		
		if (e.ctrlKey)
			cursorData.modifiers |= CursorModifiers.Ctrl
		cursorData.onTarget = (e.target === canvas)
		
		if (e && this.ShouldCapture(cursorData))
			e.preventDefault()
		
		if (this.OnAction) {
			let context = canvas.getContext("2d")
			this.OnAction(cursorData, context)
		}
	}
}
CanvasPerformer.START = 1
CanvasPerformer.END = 2
CanvasPerformer.DRAG = 4
CanvasPerformer.ZOOM = 8
CanvasPerformer.PAN = 16
CanvasPerformer.INTERRUPT = 32
CanvasPerformer.END_INTERRUPT = 2|23

class CanvasDrawerTool {
}
CanvasDrawerTool.prototype.tool = null
CanvasDrawerTool.prototype.overlay = null
CanvasDrawerTool.prototype.interrupt = null
CanvasDrawerTool.prototype.stationaryReportInterval = null
CanvasDrawerTool.prototype.frameLock = false
CanvasDrawerTool.prototype.updateUndoBuffer = true

let Tools = {
	freehand: class extends CanvasDrawerTool {
		tool(data, context) {
			return data.lineFunction(context, data.oldX, data.oldY, data.x, data.y, data.lineWidth)
		}
	},
	eraser: class extends CanvasDrawerTool {
		tool(data, context) {
			return data.lineFunction(context, data.oldX, data.oldY, data.x, data.y, data.lineWidth, true)
		}
	},
	line: class extends CanvasDrawerTool {
		tool(data, context) {
			if (data.End)
				return data.lineFunction(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
		}
		overlay(data, context) {
			if (!data.End)
				return data.lineFunction(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
			else
				return false
		}
	},
	square: class extends CanvasDrawerTool {
		tool(data, context) {
			if (data.End) {
				return CanvasUtilities.DrawHollowRectangle(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
			}
		}
		overlay(data, context) {
			if (!data.End) {
				return CanvasUtilities.DrawHollowRectangle(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
			} else {
				return false
			}
		}
	},
	clear: class extends CanvasDrawerTool {
		tool(data, context) {
			if (data.End && data.onTarget)
				CanvasUtilities.Clear(context.canvas, data.color)
		}
	},
	mover: class extends CanvasDrawerTool {
		tool(data, context, drawer) {
			if (data.Start) {
				drawer.moveToolLayer = CanvasUtilities.CreateCopy(context.canvas, true)
				drawer.moveToolOffset = [0,0]
				CanvasUtilities.Clear(context.canvas, drawer.moveToolClearColor)
				return true; //just redraw everything. No point optimizing
			} else if (data.End) {
				CanvasUtilities.OptimizedDrawImage(context, drawer.moveToolLayer, drawer.moveToolOffset[0], drawer.moveToolOffset[1])
				drawer.moveToolLayer = false
				return true; //just redraw everything. No point optimizing.
			} else {
				drawer.moveToolOffset[0] += (data.x - data.oldX)
				drawer.moveToolOffset[1] += (data.y - data.oldY)
				return false
			}
		}
		overlay(data, context, drawer) {
			if (!data.End) {
				CanvasUtilities.OptimizedDrawImage(context, drawer.moveToolLayer, drawer.moveToolOffset[0], drawer.moveToolOffset[1])
				return true
			} else {
				return false
			}
		}
		interrupt(data, context, drawer) {
			//Just put the layer back.
			CanvasUtilities.OptimizedDrawImage(context, drawer.moveToolLayer)
			return true
		}
	},
	slow: class extends CanvasDrawerTool {
		tool(data, context, drawer) {
			if (drawer.slowAlpha == undefined)
				drawer.slowAlpha = 0.15
			
			if (data.Start) {
				drawer.avgX = data.x
				drawer.avgY = data.y
			}
			drawer.oldX = drawer.avgX
			drawer.oldY = drawer.avgY
			if (data.Drag && !data.End) {
				//var alpha=0.1
				drawer.avgX = drawer.avgX*(1-drawer.slowAlpha)+data.x*drawer.slowAlpha
				drawer.avgY = drawer.avgY*(1-drawer.slowAlpha)+data.y*drawer.slowAlpha
			}
			if (data.End) {
				drawer.oldX = data.x
				drawer.oldY = data.y
			}
			if (data.Drag || data.End) {
				return data.lineFunction(context, drawer.oldX, drawer.oldY, drawer.avgX, drawer.avgY, data.lineWidth)
			}
		}
	},
	
	spray: class extends CanvasDrawerTool {
		tool(data, context, drawer) {
			if (drawer.spraySpread == undefined)
				drawer.spraySpread = 2
			if (drawer.sprayRate == undefined)
				drawer.sprayRate = 1 / 1.5
			
			if (data.Drag) {
				let x, y, radius=data.lineWidth*drawer.spraySpread
				let count = data.lineWidth * drawer.sprayRate
				//Math.max(MathUtilities.Distance(data.x,data.y,data.oldX,data.oldY), 1) * 
				//data.lineWidth * drawer.sprayRate
				for (let i=0;i<count;i+=0.1) {
					if (MathUtilities.IntRandom(10))
						continue
					do {
						x = (Math.random()*2-1)*radius
						y = (Math.random()*2-1)*radius
					} while (x*x+y*y>radius*radius)
					CanvasUtilities.DrawSolidCenteredRectangle(context, data.x+x, data.y+y, 1, 1)
				}
			}
		}
	},
	
	fill: class extends CanvasDrawerTool {
		tool(data, context, drawer) {
			if (data.End) {
				let sx = Math.floor(data.x)
				let sy = Math.floor(data.y)
				console.debug("Flood filling starting from " + sx + ", " + sy)
				
				let originalColor = CanvasUtilities.GetColor(context, sx, sy)
				let color = Color.from_hex(data.color)
				
				if (originalColor.compare_data(color.ToArray()))
					return
				
				CanvasUtilities.GenericFlood(context, sx, sy, (c, x, y, d)=>{
					let i = CanvasUtilities.ImageDataCoordinate(c, x, y)
					if (originalColor.compare_data(d, i)) {
						color.write_data(d, i)
						return true
					}
					return false
				})
			}
		}
	},
	
	dropper: class extends CanvasDrawerTool {
		tool(data, context, drawer) {
			if (data.End) {
				let sx = Math.floor(data.x)
				let sy = Math.floor(data.y)
				let canvasCopy = CanvasUtilities.CreateCopy(drawer._canvas)
				drawer.DrawIntoCanvas(undefined, canvasCopy, 1, 0, 0)
				let copyContext = canvasCopy.getContext('2d')
				let pickupColor = CanvasUtilities.GetColor(copyContext, sx, sy)
				drawer.SetColor(pickupColor.to_hex())
			}
		}
	},
	
	t: class extends CanvasDrawerTool {
		tool(data, context) {
		}
	},
}
Tools.slow.prototype.stationaryReportInterval = 1
Tools.slow.prototype.frameLock = true
Tools.spray.prototype.stationaryReportInterval = 1
Tools.spray.prototype.frameLock = true
Tools.dropper.prototype.updateUndoBuffer = false

class CanvasDrawerLayer {
	constructor(canvas) {
		this.canvas = canvas
		this.opacity = 1.0
		this.id = 0
	}
}

class CanvasDrawer extends CanvasPerformer {
	constructor() {
		super()
		
		this.frameActions = []
		this.undoBuffer = false
		this.tools = {}
		for (let tool of ['freehand','eraser','slow','spray','line','square','clear','fill','dropper','mover']) {
			this.tools[tool] = new Tools[tool]()
		}
		
		this.overlay = false; //overlay is set with Attach. This false means nothing.
		this.onlyInnerStrokes = true
		this.defaultCursor = 'crosshair'
		this.currentLayer = 0
		this.currentTool = 'freehand'
		this.color = "#000000"
		this.opacity = 1
		this.lineWidth = 2
		//this.cursorColor = "rgb(128,128,128)"
		this.lineShape = 'hardcircle'
		
		this.lastAction = false
		this.ignoreCurrentStroke = false
		
		//All private stuff that's only used for our internal functions.
		let strokeCount = 0
		let frameCount = 0
		
		this.StrokeCount = ()=>strokeCount
		
		this.OnUndoStateChange = false
		this.OnColorChange = false
		this.OnAction = (data, context)=>{
			if (this.tool_has('tool') && (data.Drag)) {
				data.color = this.color
				data.lineWidth = this.lineWidth
				data.lineShape = this.lineShape
				data.opacity = this.opacity
				
				if (this.lineShape === 'hardcircle')
					data.lineFunction = CanvasUtilities.DrawSolidRoundLine
				else if (this.lineShape === 'hardsquare')
					data.lineFunction = CanvasUtilities.DrawSolidSquareLine
				else if (this.lineShape === 'normalsquare')
					data.lineFunction = CanvasUtilities.DrawNormalSquareLine
				else
					data.lineFunction = CanvasUtilities.DrawNormalRoundLine
				
				//Replace this with some generic cursor drawing thing that takes both strings AND functions to draw the cursor.
				if (!this.tool_has("cursor") && (data.Start)) 
					;//this._canvas.style.cursor = this.defaultCursor
				
				if (data.Start) {
					data.oldX = data.x
					data.oldY = data.y
					data.startX = data.x
					data.startY = data.y
					strokeCount++
				} else {
					data.oldX = this.lastAction.x
					data.oldY = this.lastAction.y
					data.startX = this.lastAction.startX
					data.startY = this.lastAction.startY
				}
				
				if (this.tool_has('frameLock'))
					this.frameActions.push({data, context})
				else
					this.PerformDrawAction(data, context)
			}
		}
		this._doFrame = ()=>{
			frameCount++
			
			//Oh look, we were detached. How nice.
			if (!this._canvas)
				return
			
			//I don't care what the tool wants or what the settings are, all I care about is whether or not there are actions for me to perform. Maybe some other thing added actions; I shouldn't ignore those.
			if (this.frameActions.length) {
				for (let i=0; i<this.frameActions.length; i++) {
					let data = this.frameActions[i].data
					if (data.Start || data.End || i==this.frameActions.length-1) {
						this.PerformDrawAction(this.frameActions[i].data, this.frameActions[i].context)
					}
				}
				
				this.frameActions = []
			}
			//Only reperform the last action if there was no action this frame, both the tool and the reportInterval are valid, there even WAS a lastAction which had Drag but not Start/End, and it's far enough away from the last stationary report.
			else if (this.tool_has('stationaryReportInterval') && this.tool_has('tool') && this.lastAction && this.lastAction.Drag && !this.lastAction.End && (frameCount % this.tools[this.currentTool].stationaryReportInterval)==0) {
				this.PerformDrawAction(this.lastAction, this.GetCurrentCanvas().getContext("2d"))
			}
			
			requestAnimationFrame(this._doFrame)
		}
	}
	
	//Get the canvas that the user should currently be drawing on. 
	GetCurrentCanvas() {
		return this._canvas
	}
	
	tool_has(field) { 
		let curr = this.tools[this.currentTool]
		return curr && (!field || curr[field])
	}
	
	SupportsUndo() {
		return (this.undoBuffer ? true : false)
	}
	
	CanUndo() {
		return this.SupportsUndo() && this.undoBuffer.UndoCount() > 0
	}
	
	CanRedo() {
		return this.SupportsUndo() && this.undoBuffer.RedoCount() > 0
	}
	
	DoUndoStateChange() {
		if (this.OnUndoStateChange)
			this.OnUndoStateChange()
	}
	
	DoColorChange() {
		if (this.OnColorChange)
			this.OnColorChange(this.color)
	}
	
	SetColor(color) {
		this.color= color
		this.DoColorChange()
	}
	
	//This is for both undos and redos
	_PerformUndoRedoSwap(which) {
		//Figure out which static canvas we're going to use to store our current state.
		let currentState = this.undoBuffer.staticBuffer[this.undoBuffer.virtualIndex]
		//Perform the actual action with a non-filled current state (just to get it in there)
		let nextState = this.undoBuffer[which](currentState)
		//The reason we don't fill in currentState until now is because we need the nextState data
		currentState.id = nextState.id
		this.currentLayer = nextState.id
		//Now we simply put our current drawing into the buffer and apply the bufferr's state
		CanvasUtilities.CopyInto(currentState.canvas.getContext("2d"), this.GetCurrentCanvas())
		CanvasUtilities.CopyInto(this.GetCurrentCanvas().getContext("2d"), nextState.canvas)
		this.DoUndoStateChange()
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
		this.DoUndoStateChange()
	}
	
	UpdateUndoBuffer() {
		if (!this.SupportsUndo())
			return
		console.trace("Updating undo buffer")
		let currentState = this.undoBuffer.staticBuffer[this.undoBuffer.virtualIndex]
		currentState.id = this.currentLayer
		CanvasUtilities.CopyInto(currentState.canvas.getContext("2d"), this.GetCurrentCanvas())
		this.undoBuffer.Add(currentState)
		this.DoUndoStateChange()
	}
	
	PerformDrawAction(data, context) {
		//Ensure the drawing canvases are properly set up before we hand the data off to a tool action thingy.
		let bcontext = this.GetCurrentCanvas().getContext("2d")
		context.fillStyle = this.color
		bcontext.fillStyle = this.color
		context.globalAlpha = 1.0; //this.opacity
		bcontext.globalAlpha = this.opacity
		
		if (data.Interrupt) {
			//Interrupted? Clear the overlay... don't know what we were doing but whatever, man. Oh and call the tool's interrupt function...
			this.overlay.active = false
			let interruptHandler = this.tool_has("interrupt")
			if (interruptHandler)
				interruptHandler(data, bcontext, this)
			//CanvasUtilities.Clear(this.overlay.canvas)
			//UXUtilities.Toast("Disabling overlay")
		}
		
		if (data.Start) {
			if (data.Interrupt || (this.onlyInnerStrokes && !data.onTarget)) {
				this.ignoreCurrentStroke = true
				//console.debug("ignoring stroke. Interrupt: " + data.Interrupt)
			} else {
				if (this.tool_has('updateUndoBuffer'))
					this.UpdateUndoBuffer()
			}
		}
		
		//A special case: The last stroke that was valid was interrupted, so we need to undo the stroke (only if the stroke wasn't ignored in the first place)
		if (!this.ignoreCurrentStroke && data.EndInterrupt && this.tool_has('updateUndoBuffer')) {
			this.ignoreCurrentStroke = true
			this.Undo()
			this.undoBuffer.ClearRedos()
			this.DoUndoStateChange()
		}
		
		//Now actually perform the action.
		if (!this.ignoreCurrentStroke) {
			let bounding = this.tools[this.currentTool].tool(data, bcontext, this)
			let overlay = this.tool_has('overlay')
			
			if (overlay && this.overlay.canvas) {
				let overlayContext = this.overlay.canvas.getContext("2d")
				overlayContext.fillStyle = this.color
				overlayContext.globalAlpha = this.opacity
				overlayContext.clearRect(0, 0, this.overlay.canvas.width, this.overlay.canvas.height)
				this.overlay.active = (overlay(data, overlayContext, this) !== false)
			}
		}
		
		if (data.End) {
			if (this.ignoreCurrentStroke)
				;//console.debug("No longer ignoring stroke")
			this.ignoreCurrentStroke = false
		}
		
		this.lastAction = data
	}
	
	ResetUndoBuffer(size, canvasBlueprint=this._canvas) {
		size = size || (this.undoBuffer.staticBuffer.length-1)
		this.undoBuffer = new UndoBuffer(size, size+1)
		this.undoBuffer.staticBuffer = []
		for (let i=0; i<size+1; i++) {
			let layer = new CanvasDrawerLayer(CanvasUtilities.CreateCopy(canvasBlueprint))
			this.undoBuffer.staticBuffer.push(layer)
		}
	}
	
	//Assumes mainCanvas is the same size as all the layers. All undo buffers and
	//overlays will be the same size as mainCanvas.
	Attach(mainCanvas, undoCount, useToolOverlay) {
		let i
		
		if (undoCount === undefined)
			undoCount = 5
		if (useToolOverlay === undefined)
			useToolOverlay = true
		
		if (useToolOverlay)
			this.overlay = new CanvasDrawerLayer(CanvasUtilities.CreateCopy(mainCanvas))
		else
			this.overlay = new CanvasDrawerLayer(null)
		
		if (undoCount)
			this.ResetUndoBuffer(undoCount, mainCanvas)
		else
			this.undoBuffer = false
		
		//mainCanvas.setAttribute("tabindex", "-1")
		super.Attach(mainCanvas)
		//this._canvas.style.cursor = this.defaultCursor; //Assume the default cursor will do. Fix later!
		this._doFrame()
	}
	
	Detach() {
		this.undoBuffer = false
		this.overlay = false
		super.Detach()
	}
	
	ToString() {
		//Version 1-2 assumes the width and height of all layers are the same.
		let object = {version:2, width: this._canvas.width, height: this._canvas.height}
		let layers = []
		
		let layerToObject = (layer)=>{
			return {
				canvas: CanvasUtilities.ToString(layer.canvas),
				opacity: layer.opacity
			}
		}
		
		object.buffered = false
		layers.push({
			canvas: CanvasUtilities.ToString(this._canvas),
			opacity: 1.0
		})
		
		object.layers = layers
		
		return JSON.stringify(object)
	}
	
	FromString(string, callback) {
		let object = JSON.parse(string)
		
		//Version 1 stuff. May be used in other versions as well.
		let version1LoadComplete = ()=>{
			this.ResetUndoBuffer()
			if (callback)
				callback(this, object)
		}
		let version1LayerLoad = (layer, buffer, redrawCheck)=>{
			CanvasUtilities.DrawDataURL(layer, buffer.canvas, 0, 0, redrawCheck)
		}
		let version1BufferLoad = (layerLoadFunction)=>{
			let loadedBuffers = 0
			let redrawCheck = ()=>{
				loadedBuffers++
				if (loadedBuffers >= object.layers.length)
					version1LoadComplete()
			}
			for (let i = 0; i < object.layers.length; i++) {
				this.buffers[i].canvas.width = object.width
				this.buffers[i].canvas.height = object.height
				layerLoadFunction(object.layers[i], this.buffers[i], redrawCheck)
			}
		}
		
		let version2LayerLoad = (layer, buffer, redrawCheck)=>{
			buffer.opacity = layer.opacity
			CanvasUtilities.DrawDataURL(layer.canvas, buffer.canvas, 0, 0, redrawCheck)
		}
		
		//Version 1 assumes you will already have set up your canvasdrawer in a way that you like, so the buffers and overlay canvas better be the same as what the stored object was.
		if (object.version === 1 || object.version == 2) {
			this._canvas.width = object.width
			this._canvas.height = object.height
			
			let loadLayerFunction = version1LayerLoad
			if (object.version === 2)
				loadLayerFunction = version2LayerLoad
			
			if (object.buffered) {
				version1BufferLoad(loadLayerFunction)
			} else {
				loadLayerFunction(object.layers[0], {canvas:this._canvas}, version1LoadComplete)
			}
		} else {
			throw "Unknown CanvasDrawer version: " + object.version
		}
	}
}
