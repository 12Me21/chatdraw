'use strict'

// Functions objects for working with colors in a generic way. Any canvas functions will use this object rather than some specific format.
class Color {
	constructor(r, g, b, a=255) {
		this.color = [r,g,b,a]
	}
	
	clear_score() { //idk
		let col = this.color
		return Math.pow((col[0] + col[1] + col[2] - (255 * 3 / 2 - 0.1)), 2)
	}
	
	ToArray() {
		return this.color
	}
	
	write_data(data, index=0) {
		for (let j=0; j<4; j++)
			data[index+j] = this.color[j]
	}
	
	compare_data(data, index=0) {
		for (let j=0; j<4; j++)
			if (data[index+j] != this.color[j])
				return false
		return true
	}
	
	to_hex(includeAlpha) {
		// todo: alpha
		let num = this.color[0]<<16 | this.color[1]<<8 | this.color[2]
		return "#"+num.toString(16).padStart(2*3, "0")
	}
	
	static from_hex(value) {
		let num = parseInt(value.slice(1), 16)
		return new this(num>>16&255, num>>8&255, num&255)
	}
}

// --- CanvasUtilities ---
// Helper functions for dealing with Canvases.

let CanvasUtilities = {
	CreateCopy(canvas, copyImage, x=0, y=0, width=canvas.width, height=canvas.height) {
		// Width and height are cropping, not scaling. X and Y are the place to start the copy within the original canvas 
		let newCanvas = document.createElement('canvas')
		newCanvas.width = width
		newCanvas.height = height
		let context = newCanvas.getContext('2d')
		if (copyImage)
			CanvasUtilities.CopyInto(context, canvas, -x, -y)
		return context
	},
	GetAllData(context) {
		let {width, height} = context.canvas
		return context.getImageData(0, 0, width, height)
	},
	CopyInto(context, source, x=0, y=0) {
		//x and y are the offset locations to place the copy into on the receiving canvas
		context.save()
		context.globalCompositeOperation = 'copy'
		context.drawImage(source, x, y)
		context.load()
	},
	OptimizedDrawImage(context, image, x, y, scaleX=image.width, scaleY=image.width) {
		context.save()
		context.imageSmoothingEnabled = false
		context.drawImage(image, Math.floor(x), Math.floor(y), Math.floor(scaleX), Math.floor(scaleY))
		context.load()
	},
	Clear(canvas, color) {
		let context = canvas.getContext("2d")
		let oldStyle = context.fillStyle
		let oldAlpha = context.globalAlpha
		if (color) {
			context.globalAlpha = 1
			context.fillStyle = color
			context.fillRect(0, 0, canvas.width, canvas.height)
		} else {
			context.clearRect(0, 0, canvas.width, canvas.height)
		}
		context.fillStyle = oldStyle
		context.globalAlpha = oldAlpha
	},
	DrawSolidCenteredRectangle(ctx, cx, cy, width, height, clear) {
		cx = Math.round(cx - width / 2)
		cy = Math.round(cy - height / 2)
		if (clear)
			ctx.clearRect(cx, cy, Math.round(width), Math.round(height))
		else
			ctx.fillRect(cx, cy, Math.round(width), Math.round(height))
		return [cx, cy, width, height]
	},
	DrawSolidEllipse(ctx, cx, cy, radius1, radius2, clear) {
		radius2 = radius2 || radius1
		let line = clear ? "clearRect" : "fillRect"
		let rs1 = radius1 * radius1
		let rs2 = radius2 * radius2
		let rss = rs1 * rs2
		let x, y
		cx -= 0.5; //A HACK OOPS
		cy -= 0.5
		
		for (y = -radius2 + 0.5; y <= radius2 - 0.5; y++) {
			for (x = -radius1 + 0.5; x <= radius1 - 0.5; x++) {
				if (x*x*rs2+y*y*rs1 <= rss) {
					ctx[line](Math.round(cx+x),Math.round(cy+y),Math.round(-x*2 + 0.5),1)
					break
				}
			}
		}
		
		return [cx - radius1, cy - radius2, radius1 * 2, radius2 * 2]
	},
	DrawNormalCenteredRectangle(ctx, cx, cy, width, height) {
		cx = cx - (width - 1) / 2
		cy = cy - (height - 1) / 2
		
		ctx.fillRect(cx, cy, width, height)
		
		return [cx, cy, width, height]
	},
	//For now, doesn't actually draw an ellipse
	DrawNormalCenteredEllipse(ctx, cx, cy, width, height) {
		ctx.beginPath()
		ctx.arc(cx, cy, width / 2, 0, Math.PI * 2, 0)
		ctx.fill()
		
		return [cx - width / 2 - 1, cy - height / 2 - 1, width, width]
	},
	//Wraps the given "normal eraser" function in the necessary crap to get the eraser to function properly. Then you just have to fill wherever necessary.
	PerformNormalEraser(ctx, func) {
		let oldStyle = ctx.fillStyle
		let oldComposition = ctx.globalCompositeOperation
		ctx.fillStyle = "#000000"
		ctx.globalCompositeOperation = "destination-out"
		let result = func()
		ctx.fillStyle = oldStyle
		ctx.globalCompositeOperation = oldComposition
		return result
	},
	//Draws a general line using the given function to generate each point.
	DrawLineRaw(ctx, sx, sy, tx, ty, width, clear, func) {
		let dist = MathUtilities.Distance(sx,sy,tx,ty);     // length of line
		let ang = MathUtilities.SlopeAngle(tx-sx,ty-sy);    // angle of line
		if (dist == 0)
			dist=0.001
		for (let i=0; i<dist; i+=0.5) {
			func(ctx, sx+Math.cos(ang)*i, sy+Math.sin(ang)*i, width, clear)
		}
		//This is just an approximation and will most likely be larger than necessary. It is the bounding rectangle for the area that was updated
		return CanvasUtilities.ComputeBoundingBox(sx, sy, tx, ty, width)
	},
	//How to draw a single point on the SolidSquare line
	_DrawSolidSquareLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawSolidCenteredRectangle(ctx, x, y, width, width, clear)
	},
	DrawSolidSquareLine(ctx, sx, sy, tx, ty, width, clear) {
		return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, clear, CanvasUtilities._DrawSolidSquareLineFunc)
	},
	//How to draw a single point on the SolidRound line
	_DrawSolidRoundLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawSolidEllipse(ctx, x, y, width / 2, width / 2, clear)
	},
	DrawSolidRoundLine(ctx, sx, sy, tx, ty, width, clear) {
		return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, clear, CanvasUtilities._DrawSolidRoundLineFunc)
	},
	//How to draw a single point on the NormalSquare line
	_DrawNormalSquareLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawNormalCenteredRectangle(ctx, x, y, width, width, clear)
	},
	DrawNormalSquareLine(ctx, sx, sy, tx, ty, width, clear) {
		if (clear) {
			return CanvasUtilities.PerformNormalEraser(ctx, function() {
				return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalSquareLineFunc)
			})
		} else {
			return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalSquareLineFunc)
		}
	},
	//How to draw a single point on the NormalRound line
	_DrawNormalRoundLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawNormalCenteredEllipse(ctx, x, y, width, width, clear)
	},
	DrawNormalRoundLine(ctx, sx, sy, tx, ty, width, clear) {
		if (clear) {
			return CanvasUtilities.PerformNormalEraser(ctx, function() {
				return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalRoundLineFunc)
			})
		} else {
			return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalRoundLineFunc)
		}
	},
	DrawHollowRectangle(ctx, x, y, x2, y2, width) {
		CanvasUtilities.DrawSolidSquareLine(ctx, x, y, x2, y, width)
		CanvasUtilities.DrawSolidSquareLine(ctx, x, y2, x2, y2, width)
		CanvasUtilities.DrawSolidSquareLine(ctx, x, y, x, y2, width)
		CanvasUtilities.DrawSolidSquareLine(ctx, x2, y, x2, y2, width)
		return CanvasUtilities.ComputeBoundingBox(x, y, x2, y2, width)
	},
	ComputeBoundingBox(x, y, x2, y2, width) {
		return [
			Math.min(x, x2) - width, Math.min(y, y2) - width,
			Math.abs(x - x2) + width * 2 + 1, Math.abs(y - y2) + width * 2 + 1
		]
	},
	ComputeTotalBoundingBox(boxes) {
		let finalBox = [ Infinity, Infinity, -Infinity, -Infinity]
		
		for (let i = 0; i < boxes.length; i++) {
			if (!boxes[i] || boxes[i].length < 4)
				return false
			finalBox[0] = Math.min(boxes[0], finalBox[0])
			finalBox[1] = Math.min(boxes[1], finalBox[1])
			finalBox[2] = Math.max(boxes[0] + boxes[2], finalBox[2])
			finalBox[3] = Math.max(boxes[1] + boxes[3], finalBox[3])
		}
		
		return finalBox
	},
	GetColor(context, x, y) {
		let data = context.getImageData(x, y, 1, 1).data
		return new Color(data[0], data[1], data[2], data[3])
	},
	//Convert x and y into an ImageDataCoordinate. Returns -1 if the coordinate falls outside the canvas.
	ImageDataCoordinate(context, x, y) {
		if (x < 0 || x >= context.canvas.width || y < 0 || y >= context.canvas.height)
			return -1
		return 4 * (x + y * context.canvas.width)
	},
	GenericFlood(context, x, y, floodFunction) {
		x = Math.floor(x)
		y = Math.floor(y)
		let canvas = context.canvas
		let iData = context.getImageData(0, 0, canvas.width, canvas.height)
		let data = iData.data
		let queueX = [], queueY = []
		let enqueue = (qx, qy)=>{
			queueX.push(qx)
			queueY.push(qy)
		}
		if (floodFunction(context, x, y, data))
			enqueue(x, y)
		while (queueX.length) {
			let column = queueX.shift()
			let row = queueY.shift()
			//Move west until it is just outside the range we want to fill. Move east in a similar manner.
			let west, east
			for (west = column-1; west>=-1 && floodFunction(context, west, row, data); west--)
				;
			for (east = column+1; east<=canvas.width && floodFunction(context, east, row, data); east++)
				;
			//Move from west to east EXCLUSIVE and fill the queue with matching north and south nodes.
			for (column = west+1; column<east; column++) {
				if (row+1 < canvas.height && floodFunction(context, column, row+1, data))
					enqueue(column, row+1)
				if (row-1 >= 0 && floodFunction(context, column, row-1, data))
					enqueue(column, row-1)
			}
		}
		context.putImageData(iData, 0, 0)
	},
	SwapColor(context, original, newColor) {
		for (let undo of this.undoBuffer.staticBuffer) {
			let iData = context.getImageData(0, 0, context.canvas.width, context.canvas.height)
			let data = iData.data
			for (let i=0; i<data.length; i+=4) {
				if (original.compare_data(data, i))
					newColor.write_data(data, i)
			}
			context.putImageData(iData, 0, 0)
		}
	}
}

// --- Math Utilities ---
// Functions which provide extra math functionality.

let MathUtilities = {
	Distance(x1, y1, x2, y2) {
		return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1))
	},
	Midpoint(x1, y1, x2, y2) {
		return [x1 + (x2 - x1) / 2, y1 + (y2 - y1) / 2]
	},
	MinMax(value, min, max) {
		if (min > max) {
			let temp = min
			min = max
			max = temp
		}
		return  Math.max(Math.min(value, max), min)
	},
	SlopeAngle(x,y) { 
		return Math.atan(y/(x===0?0.0001:x))+(x<0?Math.PI:0)
	},
	IntRandom(max, min) {
		min = min || 0; //getOrDefault(min, 0)
		
		if (min > max) {
			let temp = min
			min = max
			max = temp
		}
		
		return Math.floor((Math.random() * (max - min)) + min)
	},
	LinearInterpolate(y1, y2, mu) {
		return y1 + mu * (y2 - y1)
	},
	CosInterpolate(y1, y2, mu) {
		let mu2 = (1 - Math.cos(mu * Math.PI)) / 2
		return (y1* (1 - mu2) + y2 * mu2)
	},
	GetSquare(x, y, x2, y2) {
		return [Math.min(x, x2), Math.min(y, y2), Math.abs(x - x2), Math.abs(y - y2)]
	},
	IsPointInSquare(point, square) {
		return point[0] >= square[0] && point[0] <= square[0] + square[2] && point[1] >= square[1] && point[1] <= square[1] + square[3]
	},
	FindBest(list, func) {
		let best = -Infinity
		let besti = 0
		for (let i=0; i<list.length; i++) {
			let score = func(list[i], i, list)
			if (score > best) {
				best = score
				besti = i
			}
		}
		return [list[besti], besti]
	}
}

// --- UndoBuffer ---
// Basically all undo buffers work the same, so here's a generic object you can use for all your undo needs

class UndoBuffer {
	constructor(maxSize=5) {
		this.maxSize = maxSize
		this.OnUndoStateChange = null
		this.Clear()
	}
	
	Clear() {
		this.buffer = [[],[]] // undo, redo
		this.DoUndoStateChange()
	}
	
	UndoCount() {
		return this.buffer[0].length
	}
	RedoCount() {
		return this.buffer[1].length
	}
	
	Add(current) {
		let undo = this.buffer[0]
		this.buffer[0].push(current)
		this.buffer[1] = []
		while (undo.length > this.maxSize)
			undo.shift()
		this.DoUndoStateChange()
		return undo.length
	}
	
	_do(current, redo) {
		if (!this.buffer[redo?1:0].length)
			return null
		this.buffer[redo?0:1].push(current)
		let data = this.buffer[redo?1:0].pop()
		this.DoUndoStateChange()
		return data
	}
	
	Undo(current) {
		return this._do(current, false)
	}
	
	Redo(current) {
		return this._do(current, true)
	}
	
	ClearRedos() {
		this.buffer[1] = []
		this.DoUndoStateChange()
	}
	
	DoUndoStateChange() {
		if (this.OnUndoStateChange)
			this.OnUndoStateChange()
	}
}
