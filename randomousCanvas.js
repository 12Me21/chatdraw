'use strict'

// Carlos Sanchez - 2017
// randomouscrap98@aol.com
// An enormous library full of canvas garbage
// NOTE: THIS LIBRARY REQUIRES randomous.js!

// --- CursorActionData ---
// Auxiliary object for describing generic cursor actions and data. Useful for
// unified mouse/touch systems (like CanvasPerformer)

class CursorActionData {
	constructor(action, x, y, zoomDelta) {
		this.action = action
		this.x = x
		this.y = y
		this.realX = x; //The real x and y relative to the canvas.
		this.realY = y
		this.zoomDelta = zoomDelta || false
		this.onTarget = true
		this.targetElement = false
		this.time = 0; //Date.now()
		this.modifiers = 0
	}
}

const CursorActions = {
	Start: 1, End: 2, Drag: 4, Zoom: 8, Pan: 16, Interrupt: 32
}

const CursorModifiers = {
	Ctrl: 1, Alt: 2
}

// --- CanvasPerformer ---
// Allows simple actions using unified touch and mouse on a canvas. Useful for
// drawing applications

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
		
		var lastMAction = 0
		var lastTAction = 0
		var startZDistance = 0
		var lastZDistance = 0
		var lastTPosition = [-1,-1]
		
		//Event for "mouse down". Creates a generic "cursor" action
		this._evMD = e=>{
			console.trace("CanvasPerformer mouse down")
			var action = CursorActions.Start
			var buttons = e.buttons || EventUtilities.MouseButtonToButtons(e.button)
			
			lastMAction = this.ButtonsToAction(buttons)
			this.Perform(e, new CursorActionData(action | lastMAction, e.clientX, e.clientY), this._canvas)
		}
		//Event for "mouse up". Creates a generic "cursor" action
		this._evMU = (e)=>{
			console.trace("CanvasPerformer mouse up")
			this.Perform(e, new CursorActionData(CursorActions.End | lastMAction, e.clientX, e.clientY), this._canvas); 
			lastMAction = 0
		}
		//Event for the "wheel". Creates a generic "cursor" action
		this._evMW = (e)=>{
			this.Perform(e, new CursorActionData(CursorActions.Start | CursorActions.End | CursorActions.Zoom, e.clientX, e.clientY, -Math.sign(e.deltaY) * this.WheelZoom), this._canvas)
		}
		//Event for both "touch start" and "touch end". Creates a generic "cursor" action
		//Event for "touch start". Creates a generic "cursor" action
		this._evTC = (e)=>{
			console.trace("CanvasPerformer touch start/end event [" + e.touches.length + "]")
			if (this.ZoomTouches !== 2)
				throw "Zoom must use 2 fingers!"
			
			var extraAction = 0
			var nextAction = this.TouchesToAction(e.touches.length)
			
			//If we enter evTC and there is a lastTAction, that means that last
			//action has ended. Either we went from 1 touch to 0 or maybe 2 touches
			//to 1 touch. Either way, that specific action has ended (2 touches is a
			//zoom, 1 touch is a drag, etc.).
			if (lastTAction) {
				if (nextAction) extraAction |= CursorActions.Interrupt
				this.Perform(e, new CursorActionData(CursorActions.End | lastTAction | extraAction, lastTPosition[0], lastTPosition[1]), this._canvas)
			}
			
			//Move to the "next" action.
			lastTAction = nextAction
			
			//if the user is ACTUALLY performing something (and this isn't just a 0
			//touch event), THEN we're starting something here.
			if (lastTAction) {
				if (lastTAction & CursorActions.Zoom) {
					startZDistance = this.PinchDistance(e.touches)
					lastZDistance = 0
				}
				lastTPosition = this.TouchesToXY(lastTAction, e.touches)
				this.Perform(e, new CursorActionData(CursorActions.Start | lastTAction | extraAction, lastTPosition[0], lastTPosition[1]), this._canvas)
			}
		}
		//Event for "mouse move". Creates a generic "cursor" action.
		this._evMM = (e)=>{
			this.Perform(e, new CursorActionData(this.ButtonsToAction(e.buttons), e.clientX, e.clientY), this._canvas)
		}
		//Event for "touch move". Creates a generic "cursor" action.
		this._evTM = (e)=>{
			var action = this.TouchesToAction(e.touches.length)
			lastTPosition = this.TouchesToXY(action, e.touches)
			
			if (action & CursorActions.Zoom) {
				var startZoomDiff = this.PinchZoom(this.PinchDistance(e.touches), startZDistance)
				this.Perform(e, new CursorActionData(action, lastTPosition[0], lastTPosition[1], startZoomDiff - lastZDistance), this._canvas)
				lastZDistance = startZoomDiff
			} else {
				this.Perform(e, new CursorActionData(action, lastTPosition[0], lastTPosition[1]), this._canvas)
			}
		}
		this._evPrevent = (e)=>{
			e.preventDefault()
		}
	}
	
	GetModifiedCursorData(data, e) {
		if (!e) return data
		if (e.ctrlKey) data.modifiers |= CursorModifiers.Ctrl
		return data
	}
	
	//Convert the "buttons" field of a mouse event to the appropriate action
	ButtonsToAction(buttons) {
		if (buttons & this.DragButton)
			return CursorActions.Drag
		else if (buttons & this.PanButton)
			return CursorActions.Pan
	}
	
	//Convert the touch count to an appropriate action
	TouchesToAction(touches) {
		var action = 0
		
		if (touches === this.DragTouches)
			action = action | CursorActions.Drag
		if (touches === this.ZoomTouches)
			action = action | CursorActions.Zoom
		if (touches == this.PanTouches)
			action = action | CursorActions.Pan
		
		return action
	}
	
	//Convert a touch array into a certain XY position based on the given action.
	TouchesToXY(action, touchArray) {
		if (action & CursorActions.Zoom) {
			return MathUtilities.Midpoint(touchArray[0].clientX, touchArray[0].clientY, touchArray[1].clientX, touchArray[1].clientY)
		}
		
		return [touchArray[0].clientX, touchArray[0].clientY]
	}

	//Figure out the distance of a pinch based on the given touches.
	PinchDistance(touchArray) {
		return MathUtilities.Distance(touchArray[0].clientX, touchArray[0].clientY, touchArray[1].clientX, touchArray[1].clientY)
	}
	
	//Figure out the zoom difference (from the original) for a pinch. This is NOT
	//the delta zoom between actions, just the delta zoom since the start of the
	//pinch (or whatever is passed for oDistance)
	PinchZoom(distance, oDistance) {
		return Math.log2(distance / oDistance)
	}
	
	//System uses this function to determine if touches should be captured. Users
	//can override this function to give their own rules for captured touches.
	//Capturing a touch prevents scrolling.
	ShouldCapture(data) {
		return data.onTarget; //this._canvas && (this._canvas === document.activeElement);   
	}
	
	Attach(canvas) {
		if (this._canvas)
			throw "This CanvasPerformer is already attached to a canvas!"
		
		this._canvas = canvas
		this._oldStyle = canvas.style.touchAction
		
		canvas.style.touchAction = "none"
		document.addEventListener("mousedown", this._evMD)
		document.addEventListener("touchstart", this._evTC)
		canvas.addEventListener("touchstart", this._evPrevent); //Stops initial tuochmove distance cutoff
		canvas.addEventListener("wheel", this._evMW)
		canvas.addEventListener("contextmenu", this._evPrevent)
		document.addEventListener("mouseup", this._evMU); 
		document.addEventListener("touchend", this._evTC)
		document.addEventListener("touchcancel", this._evTC)
		document.addEventListener("mousemove", this._evMM)
		document.addEventListener("touchmove", this._evTM)
	}
	
	Detach() {
		if (!this._canvas)
			throw "This CanvasPerformer is is not attached to a canvas!"
		
		document.removeEventListener("mousedown", this._evMD)
		document.removeEventListener("touchstart", this._evTC)
		canvas.removeEventListener("wheel", this._evMW)
		canvas.removeEventListener("touchstart", this._evPrevent)
		canvas.removeEventListener("contextmenu", this._evPrevent)
		document.removeEventListener("mouseup", this._evMU); 
		document.removeEventListener("touchend", this._evTC)
		document.removeEventListener("touchcancel", this._evTC)
		document.removeEventListener("mousemove", this._evMM)
		document.removeEventListener("touchmove", this._evTM)
		
		this._canvas.style.touchAction = this._oldStyle
		this._canvas = false
	}
	
	Perform(e, cursorData, canvas) {
		var context = canvas.getContext("2d")
		var clientRect = canvas.getBoundingClientRect()
		//var clientStyle = window.getComputedStyle(canvas)
		var scalingX = canvas.clientWidth / canvas.width
		var scalingY = canvas.clientHeight / canvas.height
		
		//Do NOTHING if the canvas is non-existent
		if (scalingX <= 0 || scalingY <= 0) return
		
		cursorData = this.GetModifiedCursorData(cursorData, e)
		cursorData.x = (cursorData.x - (clientRect.left)) / scalingX
		cursorData.y = (cursorData.y - (clientRect.top)) / scalingY
		
		//console.log(scalingX + ", " + scalingY + ", " + cursorData.x + ", " + cursorData.y)
		cursorData.targetElement = canvas
		cursorData.onTarget = (e.target === canvas)
		//console.log("onTarget: " + cursorData.onTarget)
		//cursorData.onTarget = (cursorData.x >= 0 && cursorData.y >= 0 &&
		//   cursorData.x < canvas.width && cursorData.y < canvas.height)
		cursorData.time = Date.now()
		
		if (e && this.ShouldCapture(cursorData)) {
			e.preventDefault()
			//e.preventDefault()
			//e.stopPropagation()
			//console.log("STOP PROP: " + cursorData.Action)
			//canvas.focus()
			//if (cursorData.action & CursorActions.End) 
			//{
			//   document.body.focus()
			//   //canvas.parentNode.focus()
			//   console.log("FUCUSING")
			//}
		}
		
		if (this.OnAction) this.OnAction(cursorData, context)
	}
}

// --- CanvasDrawer ---
// Allows art programs to be created easily from an existing canvas. Full
// functionality is achieved when layers and an overlay are provided.

class CanvasDrawerTool {
	constructor(tool, overlay, cursor) {
		this.tool = tool
		this.overlay = overlay
		this.interrupt = false
		this.cursor = cursor
		this.stationaryReportInterval = 0
		this.frameLock = 0
		this.updateUndoBuffer = 1
	}
}

class CanvasDrawerLayer {
	constructor(canvas, id) {
		this.canvas = canvas
		this.opacity = 1.0
		this.id = id || 0
	}
}

class CanvasDrawer extends CanvasPerformer {
	constructor() {
		super()
		
		this.buffers = []
		this.frameActions = []
		this.undoBuffer = false
		this.tools = 
			{
				"freehand" : new CanvasDrawerTool(CanvasDrawer.FreehandTool),
				"eraser" : new CanvasDrawerTool(CanvasDrawer.EraserTool),
				"slow" : new CanvasDrawerTool(CanvasDrawer.SlowTool),
				"spray" : new CanvasDrawerTool(CanvasDrawer.SprayTool),
				"line" : new CanvasDrawerTool(CanvasDrawer.LineTool, CanvasDrawer.LineOverlay),
				"square" : new CanvasDrawerTool(CanvasDrawer.SquareTool, CanvasDrawer.SquareOverlay),
				"clear" : new CanvasDrawerTool(CanvasDrawer.ClearTool),
				"fill" : new CanvasDrawerTool(CanvasDrawer.FillTool),
				"dropper" : new CanvasDrawerTool(CanvasDrawer.DropperTool),
				"mover" : new CanvasDrawerTool(CanvasDrawer.MoveTool, CanvasDrawer.MoveOverlay)
			}
		
		this.constants = {
			"endInterrupt" : CursorActions.End | CursorActions.Interrupt
		}
		
		this.tools.slow.stationaryReportInterval = 1
		this.tools.spray.stationaryReportInterval = 1
		this.tools.slow.frameLock = 1
		this.tools.spray.frameLock = 1
		this.tools.dropper.updateUndoBuffer = 0
		this.tools.mover.interrupt = CanvasDrawer.MoveInterrupt
		
		this.overlay = false; //overlay is set with Attach. This false means nothing.
		this.onlyInnerStrokes = true
		this.defaultCursor = "crosshair"
		this.currentLayer = 0
		this.currentTool = "freehand"
		this.color = "rgb(0,0,0)"
		this.opacity = 1
		this.lineWidth = 2
		//this.cursorColor = "rgb(128,128,128)"
		this.lineShape = "hardcircle"
		
		this.lastAction = false
		this.ignoreCurrentStroke = false
		
		//All private stuff that's only used for our internal functions.
		var me = this
		var strokeCount = 0
		var frameCount = 0
		
		this.StrokeCount = function() { return strokeCount; }
		this.FrameCount = function() { return frameCount; }
		
		this.OnUndoStateChange = false
		this.OnLayerChange = false
		this.OnColorChange = false
		this.OnAction = function(data, context) {
			if (me.CheckToolValidity("tool") && (data.action & CursorActions.Drag)) {
				data.color = me.color
				data.lineWidth = me.lineWidth
				data.lineShape = me.lineShape
				data.opacity = me.opacity
				
				if (me.lineShape === "hardcircle")
					data.lineFunction = CanvasUtilities.DrawSolidRoundLine
				else if (me.lineShape === "hardsquare")
					data.lineFunction = CanvasUtilities.DrawSolidSquareLine
				else if (me.lineShape === "normalsquare")
					data.lineFunction = CanvasUtilities.DrawNormalSquareLine
				else
					data.lineFunction = CanvasUtilities.DrawNormalRoundLine; 
				
				//Replace this with some generic cursor drawing thing that takes both
				//strings AND functions to draw the cursor.
				if (!me.CheckToolValidity("cursor") && (data.action & CursorActions.Start)) 
					;//me._canvas.style.cursor = me.defaultCursor
				
				if (data.action & CursorActions.Start) {
					data.oldX = data.x; 
					data.oldY = data.y; 
					data.startX = data.x
					data.startY = data.y
					strokeCount++
				} else {
					data.oldX = me.lastAction.x
					data.oldY = me.lastAction.y
					data.startX = me.lastAction.startX
					data.startY = me.lastAction.startY
				}
				
				if (me.CheckToolValidity("frameLock"))
					me.frameActions.push({"data" : data, "context": context})
				else
					me.PerformDrawAction(data, context)
			}
		}
		this._doFrame = function() {
			frameCount++
			
			//Oh look, we were detached. How nice.
			if (!me._canvas) return
			
			//I don't care what the tool wants or what the settings are, all I care
			//about is whether or not there are actions for me to perform. Maybe some
			//other thing added actions; I shouldn't ignore those.
			if (me.frameActions.length) {
				for(var i = 0; i < me.frameActions.length; i++) {
					if (me.frameActions[i].data.action & (CursorActions.Start |
					                                      CursorActions.End) || i === me.frameActions.length - 1) {
						me.PerformDrawAction(me.frameActions[i].data,
						                     me.frameActions[i].context)
					}
				}
				
				me.frameActions = []
			}
			//Only reperform the last action if there was no action this frame, both
			//the tool and the reportInterval are valid, there even WAS a lastAction
			//which had Drag but not Start/End, and it's far enough away from the
			//last stationary report.
			else if (me.CheckToolValidity("stationaryReportInterval") && me.CheckToolValidity("tool") && 
			         me.lastAction && (me.lastAction.action & CursorActions.Drag) && 
			         !(me.lastAction.action & (CursorActions.End)) && (frameCount % me.tools[me.currentTool].stationaryReportInterval) === 0) {
				me.PerformDrawAction(me.lastAction, me.GetCurrentCanvas().getContext("2d"))
			}
			
			requestAnimationFrame(me._doFrame)
		}
	}
	
	Buffered() {
		return this.buffers.length > 0
	}
	
	//Convert layer ID (which can be anything) to actual index into layer buffer.
	//Only works if there is actually a buffer.
	LayerIDToBufferIndex(id) {
		for(var i = 0; i < this.buffers.length; i++)
			if (this.buffers[i].id === id)
				return i
		
		return -1
	}
	
	CurrentLayerIndex() {
		return this.LayerIDToBufferIndex(this.currentLayer)
	}
	
	GetLayerByID(id) {
		return this.buffers[this.LayerIDToBufferIndex(id)]
	}
	
	//Only works if it's buffered. Otherwise, you'll actually get an error.
	GetCurrentLayer() {
		return this.GetLayerByID(this.currentLayer)
	}
	
	//Get the canvas that the user should currently be drawing on. 
	GetCurrentCanvas() {
		if (this.Buffered())
			return this.GetCurrentLayer().canvas
		else
			return this._canvas
	}
	
	ClearLayer(layer) {
		this.UpdateUndoBuffer()
		if (layer !== undefined && this.Buffered())
			CanvasUtilities.Clear(this.GetLayerByID(layer).canvas, false); 
		else
			CanvasUtilities.Clear(this.GetCurrentCanvas(), false); 
		this.Redraw()
	}
	
	CheckToolValidity(field) { 
		return this.tools && this.tools[this.currentTool] && (!field || this.tools[this.currentTool][field])
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
	
	DoLayerChange() {
		if (this.OnLayerChange)
			this.OnLayerChange(this.currentLayer)
	}
	
	DoColorChange() {
		if (this.OnColorChange)
			this.OnColorChange(this.color)
	}
	
	SetLayer(layer) {
		this.currentLayer = layer
		this.DoLayerChange()
	}
	
	SetColor(color) {
		this.color= color
		this.DoColorChange()
	}
	
	//This is for both undos and redos
	_PerformUndoRedoSwap(swapFunction) {
		//Figure out which static canvas we're going to use to store our current state.
		var currentState = this.undoBuffer.staticBuffer[this.undoBuffer.virtualIndex]
		//Perform the actual action with a non-filled current state (just to get it in there)
		var nextState = swapFunction(currentState)
		//The reason we don't fill in currentState until now is because we need the nextState data
		currentState.id = nextState.id
		this.currentLayer = nextState.id
		//Now we simply put our current drawing into the buffer and apply the bufferr's state
		CanvasUtilities.CopyInto(currentState.canvas.getContext("2d"), this.GetCurrentCanvas())
		CanvasUtilities.CopyInto(this.GetCurrentCanvas().getContext("2d"), nextState.canvas)
		this.Redraw()
		this.DoLayerChange()
		this.DoUndoStateChange()
	}
	
	Undo() {
		if (!this.CanUndo())
			return
		this._PerformUndoRedoSwap(this.undoBuffer.Undo.bind(this.undoBuffer))
	}
	
	Redo() {
		if (!this.CanRedo())
			return
		this._PerformUndoRedoSwap(this.undoBuffer.Redo.bind(this.undoBuffer))
	}
	
	ClearUndoBuffer() {
		this.undoBuffer.Clear()
		this.DoUndoStateChange()
	}
	
	UpdateUndoBuffer() {
		if (!this.SupportsUndo()) return
		console.trace("Updating undo buffer")
		var currentState = this.undoBuffer.staticBuffer[this.undoBuffer.virtualIndex]
		currentState.id = this.currentLayer
		CanvasUtilities.CopyInto(currentState.canvas.getContext("2d"), this.GetCurrentCanvas())
		this.undoBuffer.Add(currentState)
		this.DoUndoStateChange()
	}
	
	//Draw all layers and whatever into the given canvas. Note that this function
	//simply doesn't work if the drawer doesn't support layers.
	DrawIntoCanvas(bounding, canvas) {
		//We can't DO anything if there are no buffers; redrawing the overlay would
		//make us lose the drawing itself!
		if (!this.Buffered() || bounding === false) return
		
		var context = canvas.getContext("2d")
		var oldComposition = context.globalCompositeOperation
		var oldAlpha = context.globalAlpha
		context.globalCompositeOperation = "source-over"
		if (!bounding) bounding = [0,0,canvas.width,canvas.height]
		bounding[0] = MathUtilities.MinMax(Math.floor(bounding[0]), 0, canvas.width - 1)
		bounding[1] = MathUtilities.MinMax(Math.floor(bounding[1]), 0, canvas.height - 1)
		//bounding[2] = MathUtilities.MinMax(Math.ceil(bounding[2]), 0, canvas.width - 1)
		//bounding[3] = MathUtilities.MinMax(Math.ceil(bounding[3]), 0, canvas.height - 1)
		bounding[2] = Math.ceil(bounding[2])
		bounding[3] = Math.ceil(bounding[3])
		if (bounding[0] + bounding[2] > canvas.width)
			bounding[2] = canvas.width - bounding[0]
		if (bounding[1] + bounding[3] > canvas.height)
			bounding[3] = canvas.height - bounding[1]
		//alert("new version")
		//alert("new version")
		//console.debug(bounding)
		//This stuff may be unnecessary, but apparently some canvases don't like
		//weird or undoable crops
		/*if (bounding[0] < 0)
		  {
		  bounding[2] += bounding[0]
		  bounding[0] = 0
		  }
		  if (bounding[0] + bounding[2] >= this._canvas.width) 
		  bounding[2] = */
		//context.clearRect(bounding[0] + offsetX, bounding[1] + offsetY, bounding[2] * zoom, bounding[3] * zoom)
		context.clearRect(bounding[0], bounding[1], bounding[2], bounding[3])
		if (this.overlay.active) this.buffers.splice(this.CurrentLayerIndex() + 1, 0, this.overlay)
		for(var i = 0; i < this.buffers.length; i++) {
			context.globalAlpha = this.buffers[i].opacity
			//context.drawImage(this.buffers[i].canvas, 
			//   bounding[0], bounding[1], bounding[2], bounding[3],
			//   bounding[0] + offsetX, bounding[1] + offsetY, bounding[2] * zoom, bounding[3] * zoom)
			//CanvasUtilities.OptimizedDrawImage(context, this.buffers[i].canvas, bounding[0], bounding[1])
			//This is... optimized??? IDK
			context.drawImage(
				this.buffers[i].canvas, 
				bounding[0], bounding[1], bounding[2], bounding[3],
				bounding[0], bounding[1], bounding[2], bounding[3])
		}
		if (this.overlay.active) this.buffers.splice(this.CurrentLayerIndex() + 1, 1)
		context.globalAlpha = oldAlpha
		context.globalCompositeOperation = oldComposition
	}
	
	Redraw(bounding) {
		this.DrawIntoCanvas(bounding, this._canvas)
	}
	
	PerformDrawAction(data, context) {
		//Ensure the drawing canvases are properly set up before we hand the data
		//off to a tool action thingy.
		var bcontext = this.GetCurrentCanvas().getContext("2d")
		context.fillStyle = this.color
		bcontext.fillStyle = this.color
		context.globalAlpha = 1.0; //this.opacity
		bcontext.globalAlpha = this.opacity
		
		if ((data.action & CursorActions.Interrupt)) {
			//Interrupted? Clear the overlay... don't know what we were doing
			//but whatever, man. Oh and call the tool's interrupt function...
			this.overlay.active = false
			var interruptHandler = this.CheckToolValidity("interrupt")
			if (interruptHandler) interruptHandler(data, bcontext, this)
			//CanvasUtilities.Clear(this.overlay.canvas)
			//UXUtilities.Toast("Disabling overlay")
			//console.log("Clearing overlay")
		}
		
		if (data.action & CursorActions.Start) {
			if ((data.action & CursorActions.Interrupt) || (this.onlyInnerStrokes && !data.onTarget)) {
				this.ignoreCurrentStroke = true
				console.debug("ignoring stroke. Interrupt: " + ((data.action & CursorActions.Interrupt) > 0))
			} else {
				if (this.CheckToolValidity("updateUndoBuffer"))
					this.UpdateUndoBuffer()
			}
		}
		
		//A special case: The last stroke that was valid was interrupted, so we need
		//to undo the stroke (only if the stroke wasn't ignored in the first place)
		if (!this.ignoreCurrentStroke && (data.action & this.constants.endInterrupt) ===
		    this.constants.endInterrupt && this.CheckToolValidity("updateUndoBuffer")) {
			this.ignoreCurrentStroke = true
			this.Undo()
			this.undoBuffer.ClearRedos()
			this.DoUndoStateChange()
		}
		
		//Now actually perform the action.
		if (!this.ignoreCurrentStroke) {
			var bounding = this.tools[this.currentTool].tool(data, bcontext, this)
			var overlay = this.CheckToolValidity("overlay")
			
			if (overlay && this.overlay.canvas) {
				var overlayContext = this.overlay.canvas.getContext("2d")
				overlayContext.fillStyle = this.color
				overlayContext.globalAlpha = this.opacity
				overlayContext.clearRect(0, 0, this.overlay.canvas.width, this.overlay.canvas.height)
				this.overlay.active = (overlay(data, overlayContext, this) !== false)
			}
			
			if (this.overlay.active)
				this.Redraw()
			else
				this.Redraw(bounding)
		}
		
		if (data.action & CursorActions.End) {
			if (this.ignoreCurrentStroke)
				console.debug("No longer ignoring stroke")
			this.ignoreCurrentStroke = false
		}
		
		this.lastAction = data; 
	}
	
	ResetUndoBuffer(size, canvasBlueprint) {
		canvasBlueprint = canvasBlueprint || this._canvas
		size = size || (this.undoBuffer.staticBuffer.length - 1)
		this.undoBuffer = new UndoBuffer(size, size + 1)
		this.undoBuffer.staticBuffer = []
		for (let i = 0; i < size + 1; i++) {
			var layer = new CanvasDrawerLayer(CanvasUtilities.CreateCopy(canvasBlueprint), -1)
			this.undoBuffer.staticBuffer.push(layer)
		}
	}
	
	//Assumes mainCanvas is the same size as all the layers. All undo buffers and
	//overlays will be the same size as mainCanvas.
	Attach(mainCanvas, layers, undoCount, useToolOverlay) {
		var i
		
		if (undoCount === undefined)
			undoCount = 5
		if (useToolOverlay === undefined)
			useToolOverlay = true
		
		if (useToolOverlay)
			this.overlay = new CanvasDrawerLayer(CanvasUtilities.CreateCopy(mainCanvas), -1)
		else
			this.overlay = new CanvasDrawerLayer(false, -1)
		
		this.buffers = []
		
		for(i = 0; i < layers.length; i++)
			this.buffers.push(new CanvasDrawerLayer(layers[i], i))
		
		if (undoCount)
			this.ResetUndoBuffer(undoCount, mainCanvas)
		else
			this.undoBuffer = false
		
		//mainCanvas.setAttribute("tabindex", "-1")
		CanvasPerformer.prototype.Attach.apply(this, [mainCanvas])
		//this._canvas.style.cursor = this.defaultCursor; //Assume the default cursor will do. Fix later!
		this._doFrame()
	}
	
	Detach= function() {
		this.undoBuffer = false
		this.buffers = false
		this.overlay = false
		CanvasPerformer.prototype.Detach.apply(this, [])
	}
	
	ToString() {
		//Version 1-2 assumes the width and height of all layers are the same.
		var object = {version:2, width: this._canvas.width, height: this._canvas.height}
		var layers = []
		
		var layerToObject = function(layer) {
			return {
				canvas:CanvasUtilities.ToString(layer.canvas),
				opacity:layer.opacity
			}
		}
		
		if (this.Buffered()) {
			object.buffered = true
			for(var i = 0; i < this.buffers.length; i++) {
				layers.push(layerToObject(this.buffers[i]))
			}
		} else {
			object.buffered = false
			layers.push({
				canvas:CanvasUtilities.ToString(this._canvas),
				opacity:1.0
			})
		}
		
		object.layers = layers
		
		return JSON.stringify(object)
	}
	
	FromString(string, callback) {
		var object = JSON.parse(string)
		var me = this
		
		//Version 1 stuff. May be used in other versions as well.
		var version1LoadComplete = function() {
			me.ResetUndoBuffer()
			me.Redraw();     
			if (callback) callback(this, object)
		}
		var version1LayerLoad = function(layer, buffer, redrawCheck) {
			CanvasUtilities.DrawDataURL(layer, buffer.canvas, 0, 0, redrawCheck)
		}
		var version1BufferLoad = function(layerLoadFunction) {
			var loadedBuffers = 0
			var redrawCheck = function() {
				loadedBuffers++
				if (loadedBuffers >= object.layers.length) version1LoadComplete()
			}
			for(var i = 0; i < object.layers.length; i++) {
				me.buffers[i].canvas.width = object.width
				me.buffers[i].canvas.height = object.height
				layerLoadFunction(object.layers[i], me.buffers[i], redrawCheck)
			}
		}
		
		var version2LayerLoad = function(layer, buffer, redrawCheck) {
			buffer.opacity = layer.opacity
			CanvasUtilities.DrawDataURL(layer.canvas, buffer.canvas, 0, 0, redrawCheck)
		}
		
		//Version 1 assumes you will already have set up your canvasdrawer in a way
		//that you like, so the buffers and overlay canvas better be the same as
		//what the stored object was.
		if (object.version === 1 || object.version == 2) {
			this._canvas.width = object.width
			this._canvas.height = object.height
			
			var loadLayerFunction = version1LayerLoad
			if (object.version === 2) loadLayerFunction = version2LayerLoad
			
			if (object.buffered) {
				version1BufferLoad(loadLayerFunction)
			} else {
				loadLayerFunction(object.layers[0], {canvas:this._canvas}, version1LoadComplete)
			}
		} else {
			throw "Unknown CanvasDrawer version: " + object.version
		}
	}
	
	// --- CanvasDrawer Tools ---
	// A bunch of predefined tools for your drawing pleasure
	
	//The most basic of tools: freehand (just like mspaint)
	static FreehandTool(data, context) {
		return data.lineFunction(context, data.oldX, data.oldY, data.x, data.y, data.lineWidth)
	}
	
	static EraserTool(data, context) {
		return data.lineFunction(context, data.oldX, data.oldY, data.x, data.y, data.lineWidth, true)
	}
	
	//Line tool (uses overlay)
	static LineTool(data, context) {
		if (data.action & CursorActions.End)
			return data.lineFunction(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
	}
	
	static LineOverlay(data, context) {
		if ((data.action & CursorActions.End) === 0)
			return data.lineFunction(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
		else
			return false
	}
	
	//Square tool (uses overlay)
	static SquareTool(data, context) {
		if (data.action & CursorActions.End) {
			return CanvasUtilities.DrawHollowRectangle(context, 
			                                           data.startX, data.startY, data.x, data.y, data.lineWidth)
		}
	}
	
	static SquareOverlay(data, context) {
		if ((data.action & CursorActions.End) === 0) {
			return CanvasUtilities.DrawHollowRectangle(context, 
			                                           data.startX, data.startY, data.x, data.y, data.lineWidth)
		} else {
			return false
		}
	}
	
	//Clear tool (just completely fills the current layer with color)
	static ClearTool(data, context) {
		if (data.action & CursorActions.End && data.onTarget) {
			CanvasUtilities.Clear(context.canvas, data.color)
		}
	}
	
	static MoveTool(data, context, drawer) {
		if (data.action & CursorActions.Start) {
			drawer.moveToolLayer = CanvasUtilities.CreateCopy(context.canvas, true)
			drawer.moveToolOffset = [0,0]
			CanvasUtilities.Clear(context.canvas, drawer.moveToolClearColor)
			return true; //just redraw everything. No point optimizing
		} else if (data.action & CursorActions.End) {
			CanvasUtilities.OptimizedDrawImage(context, drawer.moveToolLayer, 
			                                   drawer.moveToolOffset[0], drawer.moveToolOffset[1])
			drawer.moveToolLayer = false
			return true; //just redraw everything. No point optimizing.
		} else {
			drawer.moveToolOffset[0] += (data.x - data.oldX)
			drawer.moveToolOffset[1] += (data.y - data.oldY)
			return false
		}
	}
	
	static MoveOverlay(data, context, drawer) {
		if ((data.action & CursorActions.End) === 0) {
			CanvasUtilities.OptimizedDrawImage(context, drawer.moveToolLayer, drawer.moveToolOffset[0], drawer.moveToolOffset[1])
			return true
		} else {
			return false
		}
	}
	
	static MoveInterrupt(data, context, drawer) {
		//UXUtilities.Toast("Fixing move for interrupt")
		//Just put the layer back.
		CanvasUtilities.OptimizedDrawImage(context, drawer.moveToolLayer)
		return true
	}
	
	//CanvasDrawer.MoveTool = function(data, context, drawer)
	//{
	//   if (!drawer.moveToolStage) drawer.moveToolStage = 0
	//   if (!drawer.moveToolLocation) drawer.moveToolLocation = [0, 0]
	//
	//   switch(drawer.moveToolStage)
	//   {
	//      case 0: //Selecting
	//         if (data.action & CursorActions.End && data.onTarget) 
	//         {
	//            var s = MathUtilities.GetSquare(data.startX, data.startY, data.x, data.y)
	//            drawer.moveToolSelectData = CanvasUtilities.CreateCopy(context.canvas, true,
	//               s[0], s[1], s[2], s[3]); 
	//            drawer.moveToolLocation = [s[0], s[1]]
	//            context.clearRect(s[0], s[1], s[2], s[3])
	//            drawer.moveToolStage = 1
	//            drawer.moveToolIsSelected = 0
	//            console.debug("Moving to stage 1 of MoveTool. Selected area: " + s.join(","))
	//         }
	//         break
	//      case 1: //Moving
	//         if (drawer.moveToolIsSelected && (data.action & CursorActions.Start) === 0)
	//         {
	//            //Only actually move if this isn't the first data and the area is
	//            //actually selected.
	//            drawer.moveToolLocation[0] += (data.x - data.oldX)
	//            drawer.moveToolLocation[1] += (data.y - data.oldY)
	//         }
	//         else if (!drawer.moveToolIsSelected && (data.action & CursorActions.End))
	//         {
	//            drawer.moveToolStage = 0
	//            console.debug("Returning to stage 0 of MoveTool.")
	//            return CanvasUtilities.OptimizedDrawImage(context, 
	//               drawer.moveToolSelectData, drawer.moveToolLocation[0], 
	//            drawer.moveToolLocation[1])
	//         }
	//         if (data.action & CursorActions.Start) 
	//         {
	//            var point = [data.x, data.y]
	//            var square = [drawer.moveToolLocation[0], drawer.moveToolLocation[1], 
	//               drawer.moveToolSelectData.width, drawer.moveToolSelectData.height]
	//            if (!MathUtilities.IsPointInSquare(point, square)) drawer.moveToolIsSelected = 1
	//         }
	//         break
	//   }
	//}
	//
	//CanvasDrawer.MoveOverlay = function(data, context, drawer)
	//{
	//   switch(drawer.moveToolStage)
	//   {
	//      case 0:
	//         return CanvasUtilities.DrawHollowRectangle(context, 
	//            data.startX, data.startY, data.x, data.y, 1)
	//      case 1:
	//         return CanvasUtilities.OptimizedDrawImage(context, 
	//            drawer.moveToolSelectData, drawer.moveToolLocation[0], 
	//            drawer.moveToolLocation[1])
	//   }
	//}
	
	//Slow tool (courtesy of 12me21)
	static SlowTool(data, context, drawer) {
		if (drawer.slowAlpha === undefined)
			drawer.slowAlpha = 0.15
		
		if (data.action & CursorActions.Start) {
			drawer.avgX = data.x
			drawer.avgY = data.y
		}
		drawer.oldX = drawer.avgX
		drawer.oldY = drawer.avgY
		if (data.action & CursorActions.Drag && !(data.action & CursorActions.End)) {
			//var alpha=0.1
			drawer.avgX = drawer.avgX*(1-drawer.slowAlpha)+data.x*drawer.slowAlpha
			drawer.avgY = drawer.avgY*(1-drawer.slowAlpha)+data.y*drawer.slowAlpha
		}
		if (data.action & CursorActions.End) {
			drawer.oldX =  data.x
			drawer.oldY = data.y
		}
		if (data.action & (CursorActions.Drag | CursorActions.End)) {
			return data.lineFunction(context, drawer.oldX, drawer.oldY, drawer.avgX, drawer.avgY, data.lineWidth)
		}
	}
	
	//Spray tool (like mspaint)
	static SprayTool(data, context, drawer) {
		if (drawer.spraySpread === undefined) drawer.spraySpread = 2
		if (drawer.sprayRate === undefined) drawer.sprayRate = 1 / 1.5
		
		if (data.action & CursorActions.Drag) {
			var x,y,radius=data.lineWidth*drawer.spraySpread
			var count = data.lineWidth * drawer.sprayRate
			//Math.max(MathUtilities.Distance(data.x,data.y,data.oldX,data.oldY), 1) * 
			//data.lineWidth * drawer.sprayRate
			for(var i=0;i<count;i+=0.1) {
				if (MathUtilities.IntRandom(10))
					continue
				do {
					x=(Math.random()*2-1)*radius
					y=(Math.random()*2-1)*radius
				} while (x*x+y*y>radius*radius)
				CanvasUtilities.DrawSolidCenteredRectangle(context, data.x+x, data.y+y, 1, 1)
			}
		}
	}
	
	static FillTool(data, context, drawer) {
		if (data.action & CursorActions.End) {
			if (drawer.floodThreshold === undefined)
				drawer.floodThreshold = 0
			
			var sx = Math.floor(data.x); 
			var sy = Math.floor(data.y)
			console.debug("Flood filling starting from " + sx + ", " + sy)
			
			//We create a COPY so that it takes the colors from ALL layers into
			//account (not just the current one). This unfortunately means that
			//layers that are completely occluded will be filled based on the upper
			//layer's colors and shapes, not the current layer. If this is not
			//desireable, replace this fill function with the generic one from
			//CanvasUtilities.
			var canvasCopy = CanvasUtilities.CreateCopy(drawer._canvas)
			drawer.DrawIntoCanvas(undefined, canvasCopy, 1, 0, 0)
			var copyContext = canvasCopy.getContext("2d")
			var copyData = copyContext.getImageData(0,0,canvasCopy.width,canvasCopy.height).data
			
			var originalColor = CanvasUtilities.GetColor(copyContext, sx, sy)
			var color = StyleUtilities.GetColor(data.color)
			var ocolorArray = originalColor.ToArray(true)
			var colorArray = color.ToArray(true)
			if (color.MaxDifference(originalColor) <= drawer.floodThreshold) return; 
			
			CanvasUtilities.GenericFlood(context, sx, sy, function(c, x, y, d) {
				var i = CanvasUtilities.ImageDataCoordinate(c, x, y)
				var currentColor = new Color(copyData[i], copyData[i+1], copyData[i+2], copyData[i+3]/255)
				if (originalColor.MaxDifference(currentColor) <= drawer.floodThreshold) {
					for(var j = 0; j < 4; j++) {
						d[i + j] = colorArray[j]
						copyData[i + j] = colorArray[j]
					}
					return true
				} else {
					return false
				}
			})
		}
	}
	
	static DropperTool(data, context, drawer) {
		if (data.action & CursorActions.End) {
			var sx = Math.floor(data.x); 
			var sy = Math.floor(data.y)
			var canvasCopy = CanvasUtilities.CreateCopy(drawer._canvas)
			drawer.DrawIntoCanvas(undefined, canvasCopy, 1, 0, 0)
			var copyContext = canvasCopy.getContext("2d")
			var pickupColor = CanvasUtilities.GetColor(copyContext, sx, sy)
			drawer.SetColor(pickupColor.ToRGBString())
		}
	}
}
