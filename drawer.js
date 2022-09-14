'use strict'

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
			if (tool && tool.stationaryReportInterval && tool.tool) {
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
		this.grp.fillStyle = newColor
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
			this.undoBuffer.Add(this.get_state_data())
		}
	}
	
	PerformDrawAction(data) {
		//Ensure the drawing canvases are properly set up before we hand the data off to a tool action thingy.
		this.grp.fillStyle = this.color
		this.grp.lineWidth = this.lineWidth
		let tool = this.tools[this.currentTool]
		
		if (data.Interrupt) {
			//Interrupted? Clear the overlay... don't know what we were doing but whatever, man. Oh and call the tool's interrupt function...
			this.overlayActive = false
			if (tool && tool.interrupt)
				tool.interrupt(data, this.grp, this)
			//CanvasUtilities.Clear(this.overlay)
		}
		
		// TODO: ignoreCurrentStroke should be handled by the CanvasPerformer class yes?
		if (data.Start) {
			if (data.Interrupt || (this.onlyInnerStrokes && !data.onTarget)) {
				this.ignoreCurrentStroke = true
				//console.debug("ignoring stroke. Interrupt: " + data.Interrupt)
			} else {
				if (tool && tool.updateUndoBuffer)
					this.UpdateUndoBuffer()
			}
		}
		
		//A special case: The last stroke that was valid was interrupted, so we need to undo the stroke (only if the stroke wasn't ignored in the first place)
		if (!this.ignoreCurrentStroke && (data.End && data.Interrupt) && tool && tool.updateUndoBuffer) {
			this.ignoreCurrentStroke = true
			this.Undo()
			this.undoBuffer.ClearRedos()
		}
		
		//Now actually perform the action.
		if (!this.ignoreCurrentStroke && tool) {
			tool.tool(data, this.grp, this)
			
			if (tool.overlay && this.overlay) {
				let oc = this.overlay
				oc.fillStyle = this.color
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
