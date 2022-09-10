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
		context.restore()
	},
	Clear(context, color=null) {
		context.save()
		let op = 'clearRect'
		if (color) {
			context.globalAlpha = 1
			context.fillStyle = color
			op = 'fillRect'
		}
		context[op](0, 0, context.canvas.width, context.canvas.height)
		context.restore()
	},
	DrawSolidCenteredRectangle(ctx, cx, cy, width, height, clear=null) {
		cx = Math.round(cx - width / 2)
		cy = Math.round(cy - height / 2)
		if (clear)
			ctx.clearRect(cx, cy, Math.round(width), Math.round(height))
		else
			ctx.fillRect(cx, cy, Math.round(width), Math.round(height))
		return [cx, cy, width, height]
	},
	// todo: optimize this, since there's a fixed set of shapes
	DrawSolidEllipse(ctx, cx, cy, radius1, radius2=radius1, clear) {
		let rs1 = radius1 * radius1
		let rs2 = radius2 * radius2
		let rss = rs1 * rs2
		radius2 -= 0.5
		radius1 -= 0.5
		for (let y=-radius2; y<=radius2; y++) {
			for (let x=-radius1; x<=radius1; x++) {
				if (x*x*rs2+y*y*rs1 <= rss) {
					ctx.fillRect(Math.floor(cx+x), Math.floor(cy+y), Math.floor(-x*2)+1, 1)
					break
				}
			}
		}
		return [Math.floor(cx-radius1), Math.floor(cy-radius2), radius1*2+1, radius2*2+1]
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
	GetColor(context, x, y) {
		let data = context.getImageData(x, y, 1, 1).data
		return new Color(data[0], data[1], data[2], data[3])
	},
	//Convert x and y into an ImageDataCoordinate. Returns -1 if the coordinate falls outside the data
	ImageDataCoordinate({width, height}, x, y) {
		if (x<0 || x>=width || y<0 || y>=height)
			return -1
		return (x + y * width) * 4
	},
	GenericFlood(context, x, y, func) {
		x = Math.floor(x)
		y = Math.floor(y)
		let data = CanvasUtilities.GetAllData(context)
		let {width, height} = data
		let queue = []
		let check3 = (ok=func(data, x, y))=>{
			if (ok) {
				if (y+1<height && func(data, x, y+1)) queue.push([x, y+1])
				if (y-1>=0 && func(data, x, y-1)) queue.push([x, y-1])
				return true
			}
		}
		if (!check3())
			return
		do {
			let s = x
			do;while (--x>=0 && check3())
			x = s
			do;while (++x<width && check3())
		} while (queue.length && check3([x,y]=queue.shift()))
		context.putImageData(data, 0, 0)
	},
	SwapColor(context, original, newColor) {
		let iData = CanvasUtilities.GetAllData(context)
		let data = iData.data
		for (let i=0; i<data.length; i+=4) {
			if (original.compare_data(data, i))
				newColor.write_data(data, i)
		}
		context.putImageData(iData, 0, 0)
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
