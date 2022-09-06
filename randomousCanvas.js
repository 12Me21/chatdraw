'use strict'

// Carlos Sanchez - 2017
// randomouscrap98@aol.com
// An enormous library full of canvas garbage
// NOTE: THIS LIBRARY REQUIRES randomous.js!

// --- CursorActionData ---
// Auxiliary object for describing generic cursor actions and data. Useful for
// unified mouse/touch systems (like CanvasPerformer)

console.trace = ()=>{}

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
	Start: 1,
	End: 2,
	Drag: 4,
	Zoom: 8,
	Pan: 16,
	Interrupt: 32,
	EndInterrupt: 2|32,
}

const CursorModifiers = {
	Ctrl: 1, Alt: 2,
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
		
		let lastMAction = 0
		let lastTAction = 0
		let startZDistance = 0
		let lastZDistance = 0
		let lastTPosition = [-1, -1]
		
		//Event for "mouse down". Creates a generic "cursor" action
		this._evMD = e=>{
			console.trace("CanvasPerformer mouse down")
			let action = CursorActions.Start
			let buttons = e.buttons || [1,4,2,8,16][e.button]
			
			lastMAction = this.ButtonsToAction(buttons)
			this.Perform(e, new CursorActionData(action | lastMAction, e.clientX, e.clientY), this._canvas)
		}
		//Event for "mouse up". Creates a generic "cursor" action
		this._evMU = e=>{
			console.trace("CanvasPerformer mouse up")
			this.Perform(e, new CursorActionData(CursorActions.End | lastMAction, e.clientX, e.clientY), this._canvas)
			lastMAction = 0
		}
		//Event for the "wheel". Creates a generic "cursor" action
		this._evMW = e=>{
			this.Perform(e, new CursorActionData(CursorActions.Start | CursorActions.End | CursorActions.Zoom, e.clientX, e.clientY, -Math.sign(e.deltaY) * this.WheelZoom), this._canvas)
		}
		//Event for both "touch start" and "touch end". Creates a generic "cursor" action
		//Event for "touch start". Creates a generic "cursor" action
		this._evTC = e=>{
			console.trace("CanvasPerformer touch start/end event [" + e.touches.length + "]")
			if (this.ZoomTouches !== 2)
				throw "Zoom must use 2 fingers!"
			
			let extraAction = 0
			let nextAction = this.TouchesToAction(e.touches.length)
			
			//If we enter evTC and there is a lastTAction, that means that last
			//action has ended. Either we went from 1 touch to 0 or maybe 2 touches
			//to 1 touch. Either way, that specific action has ended (2 touches is a
			//zoom, 1 touch is a drag, etc.).
			if (lastTAction) {
				if (nextAction)
					extraAction |= CursorActions.Interrupt
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
		this._evMM = e=>{
			this.Perform(e, new CursorActionData(this.ButtonsToAction(e.buttons), e.clientX, e.clientY), this._canvas)
		}
		//Event for "touch move". Creates a generic "cursor" action.
		this._evTM = e=>{
			let action = this.TouchesToAction(e.touches.length)
			lastTPosition = this.TouchesToXY(action, e.touches)
			
			if (action & CursorActions.Zoom) {
				let startZoomDiff = this.PinchZoom(this.PinchDistance(e.touches), startZDistance)
				this.Perform(e, new CursorActionData(action, lastTPosition[0], lastTPosition[1], startZoomDiff - lastZDistance), this._canvas)
				lastZDistance = startZoomDiff
			} else {
				this.Perform(e, new CursorActionData(action, lastTPosition[0], lastTPosition[1]), this._canvas)
			}
		}
		this._evPrevent = e=>{
			e.preventDefault()
		}
	}
	
	GetModifiedCursorData(data, e) {
		if (!e)
			return data
		if (e.ctrlKey)
			data.modifiers |= CursorModifiers.Ctrl
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
		let action = 0
		
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
		canvas.addEventListener("mousedown", this._evMD)
		canvas.addEventListener("touchstart", this._evTC)
		canvas.addEventListener("touchstart", this._evPrevent); //Stops initial tuochmove distance cutoff
		canvas.addEventListener("wheel", this._evMW)
		canvas.addEventListener("contextmenu", this._evPrevent)
		document.addEventListener("mouseup", this._evMU)
		document.addEventListener("touchend", this._evTC)
		document.addEventListener("touchcancel", this._evTC)
		document.addEventListener("mousemove", this._evMM)
		document.addEventListener("touchmove", this._evTM)
	}
	
	Detach() {
		if (!this._canvas)
			throw "This CanvasPerformer is is not attached to a canvas!"
		
		canvas.removeEventListener("mousedown", this._evMD)
		canvas.removeEventListener("touchstart", this._evTC)
		canvas.removeEventListener("wheel", this._evMW)
		canvas.removeEventListener("touchstart", this._evPrevent)
		canvas.removeEventListener("contextmenu", this._evPrevent)
		document.removeEventListener("mouseup", this._evMU)
		document.removeEventListener("touchend", this._evTC)
		document.removeEventListener("touchcancel", this._evTC)
		document.removeEventListener("mousemove", this._evMM)
		document.removeEventListener("touchmove", this._evTM)
		
		this._canvas.style.touchAction = this._oldStyle
		this._canvas = false
	}
	
	Perform(e, cursorData, canvas) {
		let context = canvas.getContext("2d")
		let clientRect = canvas.getBoundingClientRect()
		//let clientStyle = window.getComputedStyle(canvas)
		let scalingX = canvas.clientWidth / canvas.width
		let scalingY = canvas.clientHeight / canvas.height
		
		//Do NOTHING if the canvas is non-existent
		if (scalingX <= 0 || scalingY <= 0)
			return
		
		cursorData = this.GetModifiedCursorData(cursorData, e)
		// assumes 1px border
		cursorData.x = (cursorData.x - (clientRect.left + 1)) / scalingX
		cursorData.y = (cursorData.y - (clientRect.top + 1)) / scalingY
		
		//console.log(scalingX + ", " + scalingY + ", " + cursorData.x + ", " + cursorData.y)
		cursorData.targetElement = canvas
		
		cursorData.onTarget = (e.target === canvas)
		//console.log("onTarget: " + cursorData.onTarget)
		//cursorData.onTarget = (cursorData.x >= 0 && cursorData.y >= 0 &&
		//   cursorData.x < canvas.width && cursorData.y < canvas.height)
		cursorData.time = Date.now()
		
		if (e && this.ShouldCapture(cursorData)) {
			e.preventDefault()
		}
		
		if (this.OnAction)
			this.OnAction(cursorData, context)
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
		
		this.frameActions = []
		this.undoBuffer = false
		this.tools = {
			freehand: new CanvasDrawerTool(CanvasDrawer.FreehandTool),
			eraser: new CanvasDrawerTool(CanvasDrawer.EraserTool),
			slow: new CanvasDrawerTool(CanvasDrawer.SlowTool),
			spray: new CanvasDrawerTool(CanvasDrawer.SprayTool),
			line: new CanvasDrawerTool(CanvasDrawer.LineTool, CanvasDrawer.LineOverlay),
			square: new CanvasDrawerTool(CanvasDrawer.SquareTool, CanvasDrawer.SquareOverlay),
			clear: new CanvasDrawerTool(CanvasDrawer.ClearTool),
			fill: new CanvasDrawerTool(CanvasDrawer.FillTool),
			dropper: new CanvasDrawerTool(CanvasDrawer.DropperTool),
			mover: new CanvasDrawerTool(CanvasDrawer.MoveTool, CanvasDrawer.MoveOverlay)
		}
		
		this.tools.slow.stationaryReportInterval = 1
		this.tools.spray.stationaryReportInterval = 1
		this.tools.slow.frameLock = 1
		this.tools.spray.frameLock = 1
		this.tools.dropper.updateUndoBuffer = 0
		this.tools.mover.interrupt = CanvasDrawer.MoveInterrupt
		
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
			if (this.CheckToolValidity('tool') && (data.action & CursorActions.Drag)) {
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
				
				//Replace this with some generic cursor drawing thing that takes both
				//strings AND functions to draw the cursor.
				if (!this.CheckToolValidity("cursor") && (data.action & CursorActions.Start)) 
					;//this._canvas.style.cursor = this.defaultCursor
				
				if (data.action & CursorActions.Start) {
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
				
				if (this.CheckToolValidity('frameLock'))
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
				for (let i=0; i < this.frameActions.length; i++) {
					if (this.frameActions[i].data.action & (CursorActions.Start | CursorActions.End) || i === this.frameActions.length - 1) {
						this.PerformDrawAction(this.frameActions[i].data, this.frameActions[i].context)
					}
				}
				
				this.frameActions = []
			}
			//Only reperform the last action if there was no action this frame, both the tool and the reportInterval are valid, there even WAS a lastAction which had Drag but not Start/End, and it's far enough away from the last stationary report.
			else if (this.CheckToolValidity("stationaryReportInterval") && this.CheckToolValidity("tool") && this.lastAction && (this.lastAction.action & CursorActions.Drag) && !(this.lastAction.action & (CursorActions.End)) && (frameCount % this.tools[this.currentTool].stationaryReportInterval) === 0) {
				this.PerformDrawAction(this.lastAction, this.GetCurrentCanvas().getContext("2d"))
			}
			
			requestAnimationFrame(this._doFrame)
		}
	}
	
	//Get the canvas that the user should currently be drawing on. 
	GetCurrentCanvas() {
		return this._canvas
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
		//Ensure the drawing canvases are properly set up before we hand the data
		//off to a tool action thingy.
		let bcontext = this.GetCurrentCanvas().getContext("2d")
		context.fillStyle = this.color
		bcontext.fillStyle = this.color
		context.globalAlpha = 1.0; //this.opacity
		bcontext.globalAlpha = this.opacity
		
		if ((data.action & CursorActions.Interrupt)) {
			//Interrupted? Clear the overlay... don't know what we were doing
			//but whatever, man. Oh and call the tool's interrupt function...
			this.overlay.active = false
			let interruptHandler = this.CheckToolValidity("interrupt")
			if (interruptHandler)
				interruptHandler(data, bcontext, this)
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
		if (!this.ignoreCurrentStroke && (data.action & CursorActions.EndInterrupt) === CursorActions.EndInterrupt && this.CheckToolValidity("updateUndoBuffer")) {
			this.ignoreCurrentStroke = true
			this.Undo()
			this.undoBuffer.ClearRedos()
			this.DoUndoStateChange()
		}
		
		//Now actually perform the action.
		if (!this.ignoreCurrentStroke) {
			let bounding = this.tools[this.currentTool].tool(data, bcontext, this)
			let overlay = this.CheckToolValidity("overlay")
			
			if (overlay && this.overlay.canvas) {
				let overlayContext = this.overlay.canvas.getContext("2d")
				overlayContext.fillStyle = this.color
				overlayContext.globalAlpha = this.opacity
				overlayContext.clearRect(0, 0, this.overlay.canvas.width, this.overlay.canvas.height)
				this.overlay.active = (overlay(data, overlayContext, this) !== false)
			}
		}
		
		if (data.action & CursorActions.End) {
			if (this.ignoreCurrentStroke)
				console.debug("No longer ignoring stroke")
			this.ignoreCurrentStroke = false
		}
		
		this.lastAction = data
	}
	
	ResetUndoBuffer(size, canvasBlueprint) {
		canvasBlueprint = canvasBlueprint || this._canvas
		size = size || (this.undoBuffer.staticBuffer.length - 1)
		this.undoBuffer = new UndoBuffer(size, size + 1)
		this.undoBuffer.staticBuffer = []
		for (let i = 0; i < size + 1; i++) {
			let layer = new CanvasDrawerLayer(CanvasUtilities.CreateCopy(canvasBlueprint), -1)
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
			this.overlay = new CanvasDrawerLayer(CanvasUtilities.CreateCopy(mainCanvas), -1)
		else
			this.overlay = new CanvasDrawerLayer(false, -1)
		
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
		
		//Version 1 assumes you will already have set up your canvasdrawer in a way
		//that you like, so the buffers and overlay canvas better be the same as
		//what the stored object was.
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
			return CanvasUtilities.DrawHollowRectangle(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
		}
	}
	
	static SquareOverlay(data, context) {
		if ((data.action & CursorActions.End) === 0) {
			return CanvasUtilities.DrawHollowRectangle(context, data.startX, data.startY, data.x, data.y, data.lineWidth)
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
			CanvasUtilities.OptimizedDrawImage(context, drawer.moveToolLayer, drawer.moveToolOffset[0], drawer.moveToolOffset[1])
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
	//               s[0], s[1], s[2], s[3])
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
		if (drawer.spraySpread === undefined)
			drawer.spraySpread = 2
		if (drawer.sprayRate === undefined)
			drawer.sprayRate = 1 / 1.5
		
		if (data.action & CursorActions.Drag) {
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
	
	static FillTool(data, context, drawer) {
		if (data.action & CursorActions.End) {
			let sx = Math.floor(data.x)
			let sy = Math.floor(data.y)
			console.debug("Flood filling starting from " + sx + ", " + sy)
			
			let originalColor = CanvasUtilities.GetColor(context, sx, sy)
			let color = Color.from_input(data.color)
			let ocolorArray = originalColor.ToArray()
			let colorArray = color.ToArray()
			
			check: {
				for (let j=0; j<4; j++)
					if (colorArray[j] != ocolorArray[j])
						break check
				return
			}
			
			CanvasUtilities.GenericFlood(context, sx, sy, (c, x, y, d)=>{
				let i = CanvasUtilities.ImageDataCoordinate(c, x, y)
				for (let j=0; j<4; j++)
					if (d[i+j] != ocolorArray[j])
						return false
				for (let j = 0; j < 4; j++)
					d[i+j] = colorArray[j]
				return true
			})
		}
	}
	
	static DropperTool(data, context, drawer) {
		if (data.action & CursorActions.End) {
			let sx = Math.floor(data.x)
			let sy = Math.floor(data.y)
			let canvasCopy = CanvasUtilities.CreateCopy(drawer._canvas)
			drawer.DrawIntoCanvas(undefined, canvasCopy, 1, 0, 0)
			let copyContext = canvasCopy.getContext("2d")
			let pickupColor = CanvasUtilities.GetColor(copyContext, sx, sy)
			drawer.SetColor(pickupColor.ToHexString())
		}
	}
}
